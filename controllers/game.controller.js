const Game = require('../models/Game.model');
const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');
const mongoose = require('mongoose');

// @desc    Place a bet
// @route   POST /api/games/bet
// @access  Private
exports.placeBet = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { gameType, gameId, betAmount, multiplier } = req.body;
    const userId = req.user.id;

    // Validate bet amount
    if (!betAmount || betAmount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid bet amount' });
    }

    // Check user balance
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.balance < betAmount) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Create bet transaction
    const betTransaction = await Transaction.create(
      [
        {
          user: userId,
          type: 'bet',
          amount: betAmount,
          status: 'completed',
          paymentMethod: 'internal',
          description: `Bet on ${gameType}`,
          transactionId: `BET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
      ],
      { session }
    );

    // Deduct bet amount from balance
    user.balance -= betAmount;
    await user.save({ session });

    // Create game record
    const game = await Game.create(
      [
        {
          user: userId,
          gameType,
          gameId,
          betAmount,
          multiplier: multiplier || 1,
          status: 'pending',
          transaction: betTransaction[0]._id,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    res.status(201).json({
      message: 'Bet placed successfully',
      game: game[0],
      newBalance: user.balance,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// @desc    Process game result (win/loss)
// @route   POST /api/games/:id/result
// @access  Private
exports.processGameResult = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { result, winAmount, multiplier } = req.body;
    const gameId = req.params.id;
    const userId = req.user.id;

    // Find game
    const game = await Game.findOne({
      _id: gameId,
      user: userId,
      status: 'pending',
    }).session(session);

    if (!game) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Game not found or already processed' });
    }

    // Calculate win amount
    const calculatedWinAmount = winAmount || game.betAmount * (multiplier || 1);

    // Update game
    game.status = calculatedWinAmount > 0 ? 'won' : 'lost';
    game.winAmount = calculatedWinAmount;
    game.result = result;
    game.multiplier = multiplier || 1;
    await game.save({ session });

    // If won, create win transaction and update balance
    if (calculatedWinAmount > 0) {
      const winTransaction = await Transaction.create(
        [
          {
            user: userId,
            type: 'win',
            amount: calculatedWinAmount,
            status: 'completed',
            paymentMethod: 'internal',
            description: `Win from ${game.gameType}`,
            transactionId: `WIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        ],
        { session }
      );

      // Update user balance and total winnings
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $inc: {
            balance: calculatedWinAmount,
            totalWinnings: calculatedWinAmount,
          },
        },
        { session, new: true }
      );

      await session.commitTransaction();

      res.json({
        message: 'Game result processed',
        game,
        winAmount: calculatedWinAmount,
        newBalance: user.balance,
      });
    } else {
      await session.commitTransaction();
      res.json({
        message: 'Game result processed',
        game,
        winAmount: 0,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// @desc    Get user games
// @route   GET /api/games
// @access  Private
exports.getGames = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameType, status, limit = 50, page = 1 } = req.query;

    const query = { user: userId };
    if (gameType) query.gameType = gameType;
    if (status) query.status = status;

    const games = await Game.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('user', 'name email')
      .populate('transaction');

    const total = await Game.countDocuments(query);

    res.json({
      games,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get game by ID
// @route   GET /api/games/:id
// @access  Private
exports.getGame = async (req, res) => {
  try {
    const game = await Game.findOne({
      _id: req.params.id,
      user: req.user.id,
    })
      .populate('user', 'name email')
      .populate('transaction');

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

