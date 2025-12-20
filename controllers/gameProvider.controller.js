const axios = require('axios');
const User = require('../models/User.model');
const Game = require('../models/Game.model');
const Transaction = require('../models/Transaction.model');
const mongoose = require('mongoose');

// Get provider settings from environment
const getProviderConfig = () => {
  return {
    apiKey: process.env.GAME_PROVIDER_API_KEY,
    apiUrl: process.env.GAME_PROVIDER_API_URL || 'https://api.rapidapi.com',
    providerName: process.env.GAME_PROVIDER_NAME || 'rapidapi',
  };
};

// -------------------------------------------
// @desc    Get game list from provider
// @route   GET /api/games/provider/list
// @access  Private
// -------------------------------------------
exports.getGameList = async (req, res) => {
  try {
    const { category, search, limit = 50, page = 1 } = req.query;
    const config = getProviderConfig();

    if (!config.apiKey) {
      return res.status(500).json({
        message: 'Game provider API key not configured',
      });
    }

    // Build query parameters
    const params = {
      limit: parseInt(limit),
      page: parseInt(page),
    };
    if (category) params.category = category;
    if (search) params.search = search;

    // Call provider API
    const response = await axios.get(`${config.apiUrl}/games`, {
      params,
      headers: {
        'X-RapidAPI-Key': config.apiKey,
        'X-RapidAPI-Host': config.apiUrl.replace('https://', '').split('/')[0],
      },
    });

    res.json({
      games: response.data.games || response.data,
      total: response.data.total || response.data.games?.length || 0,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('Game provider API error:', error.message);
    res.status(500).json({
      message: 'Game provider API error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// -------------------------------------------
// @desc    Create game session
// @route   POST /api/games/provider/session
// @access  Private
// -------------------------------------------
exports.createGameSession = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { gameId, gameName } = req.body;
    const userId = req.user.id;
    const config = getProviderConfig();

    if (!gameId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Game ID gereklidir' });
    }

    // Get user
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Check if user is banned or self-excluded
    if (user.status === 'banned' || user.status === 'self_excluded') {
      await session.abortTransaction();
      return res.status(403).json({
        message: 'Hesabınız oyun oynayamaz durumda',
      });
    }

    // Create session with provider
    const sessionResponse = await axios.post(
      `${config.apiUrl}/games/${gameId}/session`,
      {
        userId: userId.toString(),
        username: user.username,
        currency: user.currency,
        balance: user.balance + user.bonusBalance,
      },
      {
        headers: {
          'X-RapidAPI-Key': config.apiKey,
          'X-RapidAPI-Host': config.apiUrl.replace('https://', '').split('/')[0],
        },
      }
    );

    const sessionToken = sessionResponse.data.sessionToken || sessionResponse.data.token;
    const gameUrl = sessionResponse.data.gameUrl || sessionResponse.data.url;

    await session.commitTransaction();

    res.json({
      message: 'Oyun oturumu oluşturuldu',
      sessionToken,
      gameUrl,
      gameId,
      gameName: gameName || 'Unknown Game',
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Game session creation error:', error.message);
    res.status(500).json({
      message: 'Oyun oturumu oluşturulamadı',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Webhook to receive game results from provider
// @route   POST /api/games/provider/webhook
// @access  Public (should be secured with provider signature)
// -------------------------------------------
exports.gameWebhook = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, gameId, gameName, betAmount, winAmount, transactionId } = req.body;

    // Verify webhook signature (implement based on provider)
    // const signature = req.headers['x-provider-signature'];
    // if (!verifySignature(signature, req.body)) {
    //   return res.status(401).json({ message: 'Invalid signature' });
    // }

    if (!userId || !gameId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get user
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate net result
    const netResult = winAmount - betAmount;

    // Update user balance
    if (netResult > 0) {
      user.balance += netResult;
      user.totalWinnings += winAmount;
    } else {
      user.balance += netResult; // netResult is negative
    }

    await user.save({ session });

    // Create game record
    const game = await Game.create(
      [
        {
          user: userId,
          gameType: 'slots',
          gameId,
          betAmount,
          winAmount,
          status: winAmount > 0 ? 'won' : 'lost',
          result: {
            providerTransactionId: transactionId,
            netResult,
          },
        },
      ],
      { session }
    );

    // Create transaction
    if (betAmount > 0) {
      await Transaction.create(
        [
          {
            user: userId,
            type: 'bet',
            amount: betAmount,
            status: 'completed',
            paymentMethod: 'internal',
            description: `Game Bet - ${gameName || gameId}`,
            transactionId: transactionId || `GAME-BET-${Date.now()}`,
            metadata: {
              gameId,
              gameName,
              provider: config.providerName,
            },
          },
        ],
        { session }
      );
    }

    if (winAmount > 0) {
      await Transaction.create(
        [
          {
            user: userId,
            type: 'win',
            amount: winAmount,
            status: 'completed',
            paymentMethod: 'internal',
            description: `Game Win - ${gameName || gameId}`,
            transactionId: `GAME-WIN-${Date.now()}`,
            metadata: {
              gameId,
              gameName,
              provider: config.providerName,
            },
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();

    res.json({
      message: 'Webhook processed successfully',
      gameId: game[0]._id,
      newBalance: user.balance,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Game webhook error:', error.message);
    res.status(500).json({
      message: 'Webhook processing failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Get game categories
// @route   GET /api/games/provider/categories
// @access  Private
// -------------------------------------------
exports.getGameCategories = async (req, res) => {
  try {
    const config = getProviderConfig();

    if (!config.apiKey) {
      return res.status(500).json({
        message: 'Game provider API key not configured',
      });
    }

    // Call provider API
    const response = await axios.get(`${config.apiUrl}/games/categories`, {
      headers: {
        'X-RapidAPI-Key': config.apiKey,
        'X-RapidAPI-Host': config.apiUrl.replace('https://', '').split('/')[0],
      },
    });

    res.json({
      categories: response.data.categories || response.data,
    });
  } catch (error) {
    console.error('Game provider API error:', error.message);
    res.status(500).json({
      message: 'Game provider API error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

