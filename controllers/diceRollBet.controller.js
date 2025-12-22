/**
 * Dice Roll Bet Controller
 * Handles betting on dice roll games (Users)
 */

const DiceRollGame = require('../models/DiceRollGame.model');
const DiceRollBet = require('../models/DiceRollBet.model');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/error.middleware').asyncHandler;
const AppError = require('../middleware/error.middleware').AppError;

// -------------------------------------------
// @desc    Place a bet on a dice roll game
// @route   POST /api/dice-roll-bets
// @access  Private
// -------------------------------------------
exports.placeBet = asyncHandler(async (req, res) => {
  const { gameId, selectedOption, betAmount } = req.body;
  const userId = req.user.id;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validation
    if (!gameId || !selectedOption || !betAmount) {
      await session.abortTransaction();
      throw new AppError('Missing required fields: gameId, selectedOption, betAmount', 400);
    }

    if (!['player1', 'player2'].includes(selectedOption)) {
      await session.abortTransaction();
      throw new AppError('Invalid option. Must be player1 or player2', 400);
    }

    if (typeof betAmount !== 'number' || betAmount <= 0) {
      await session.abortTransaction();
      throw new AppError('Bet amount must be a positive number', 400);
    }

    // Get game
    const game = await DiceRollGame.findById(gameId).session(session);
    if (!game) {
      await session.abortTransaction();
      throw new AppError('Game not found', 404);
    }

    // Check if game is accepting bets (betting games) or is in-progress (PvP games for betting)
    if (game.gameType === 'betting' && game.status !== 'accepting-bets') {
      await session.abortTransaction();
      throw new AppError(`Game is ${game.status}. Cannot place bets.`, 400);
    }
    
    // For PvP games, allow betting only when in-progress (not when waiting-for-admin or completed)
    if (game.gameType === 'player-vs-player' && game.status !== 'in-progress') {
      await session.abortTransaction();
      throw new AppError(`PvP game is ${game.status}. Can only bet on in-progress matches.`, 400);
    }

    // Get user
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      throw new AppError('User not found', 404);
    }

    // Check balance
    const balance = user.balance || 0;
    if (balance < betAmount) {
      await session.abortTransaction();
      throw new AppError('Insufficient balance', 400);
    }

    // For PvP games, check if user is one of the players (they can't bet on their own game)
    if (game.gameType === 'player-vs-player') {
      const isPlayer1 = game.players.player1.user?.toString() === userId.toString();
      const isPlayer2 = game.players.player2.user?.toString() === userId.toString();
      if (isPlayer1 || isPlayer2) {
        await session.abortTransaction();
        throw new AppError('Players cannot bet on their own match', 400);
      }
    }

    // Check if user already bet on this game
    const existingBet = await DiceRollBet.findOne({
      user: userId,
      game: gameId,
      status: 'pending',
    }).session(session);

    if (existingBet) {
      await session.abortTransaction();
      throw new AppError('You have already placed a bet on this game', 400);
    }

    const balanceBefore = balance;
    const balanceAfter = balance - betAmount;

    // Deduct bet amount from user balance
    user.balance = balanceAfter;
    await user.save({ session });

    // Calculate potential win
    const potentialWin = betAmount * game.payoutMultiplier;

    // Create bet
    const bet = await DiceRollBet.create(
      [
        {
          user: userId,
          game: gameId,
          gameNumber: game.gameNumber,
          selectedOption,
          betAmount,
          potentialWin,
          balanceBefore,
          balanceAfter,
        },
      ],
      { session }
    );

    // Create bet transaction
    const transaction = await Transaction.create(
      [
        {
          user: userId,
          type: 'bet',
          amount: betAmount,
          currency: user.currency || 'TRY',
          status: 'completed',
          description: `Dice Roll Game #${game.gameNumber} - Bet on ${selectedOption}`,
          metadata: {
            gameId: game._id,
            gameNumber: game.gameNumber,
            betId: bet[0]._id,
            selectedOption,
          },
        },
      ],
      { session }
    );

    bet[0].betTransaction = transaction[0]._id;
    await bet[0].save({ session });

    // Update game stats
    game.totalBets += 1;
    game.totalBetAmount += betAmount;
    game.totalPlayers += 1;

    // Update option-specific stats (only for betting games, PvP games need options initialized)
    if (game.gameType === 'betting') {
      if (selectedOption === 'player1') {
        game.options.player1.totalBets += 1;
        game.options.player1.totalBetAmount += betAmount;
        game.options.player1.betCount += 1;
      } else {
        game.options.player2.totalBets += 1;
        game.options.player2.totalBetAmount += betAmount;
        game.options.player2.betCount += 1;
      }
    } else if (game.gameType === 'player-vs-player') {
      // For PvP games, initialize options if not exists and track bets
      if (!game.options) {
        game.options = {
          player1: { 
            name: game.players.player1.username || 'Player 1', 
            totalBets: 0, 
            totalBetAmount: 0, 
            betCount: 0,
            diceRange: { min: 1, max: 3 }
          },
          player2: { 
            name: game.players.player2.username || 'Player 2', 
            totalBets: 0, 
            totalBetAmount: 0, 
            betCount: 0,
            diceRange: { min: 4, max: 6 }
          },
        };
      }
      if (selectedOption === 'player1') {
        game.options.player1.totalBets += 1;
        game.options.player1.totalBetAmount += betAmount;
        game.options.player1.betCount += 1;
      } else {
        game.options.player2.totalBets += 1;
        game.options.player2.totalBetAmount += betAmount;
        game.options.player2.betCount += 1;
      }
    }

    await game.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Bet placed successfully',
      data: {
        bet: bet[0],
        game: {
          gameNumber: game.gameNumber,
          status: game.status,
          totalBets: game.totalBets,
          totalBetAmount: game.totalBetAmount,
        },
        userBalance: balanceAfter,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// -------------------------------------------
// @desc    Get user's bets
// @route   GET /api/dice-roll-bets/my-bets
// @access  Private
// -------------------------------------------
exports.getMyBets = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status, page = 1, limit = 20 } = req.query;

  const query = { user: userId };
  if (status) {
    query.status = status;
  }

  const bets = await DiceRollBet.find(query)
    .populate('game', 'gameNumber status selectedWinner diceResult')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await DiceRollBet.countDocuments(query);

  res.json({
    success: true,
    data: {
      bets,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    },
  });
});

// -------------------------------------------
// @desc    Get bets for a specific game
// @route   GET /api/dice-roll-bets/game/:gameId OR /api/dice-roll-games/:gameId/bets
// @access  Public
// -------------------------------------------
exports.getGameBets = asyncHandler(async (req, res) => {
  // Support both route patterns: /game/:gameId and /:gameId/bets
  const gameId = req.params.gameId || req.params.id;
  const { page = 1, limit = 50 } = req.query;

  const bets = await DiceRollBet.find({ game: gameId })
    .populate('user', 'username email')
    .populate('game', 'gameNumber status selectedWinner')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await DiceRollBet.countDocuments({ game: gameId });

  // Calculate stats
  const player1Bets = bets.filter(b => b.selectedOption === 'player1');
  const player2Bets = bets.filter(b => b.selectedOption === 'player2');

  res.json({
    success: true,
    data: {
      bets,
      stats: {
        total: bets.length,
        player1: {
          count: player1Bets.length,
          totalAmount: player1Bets.reduce((sum, b) => sum + b.betAmount, 0),
        },
        player2: {
          count: player2Bets.length,
          totalAmount: player2Bets.reduce((sum, b) => sum + b.betAmount, 0),
        },
      },
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    },
  });
});

// -------------------------------------------
// @desc    Get single bet
// @route   GET /api/dice-roll-bets/:id
// @access  Private (user's own bet or admin)
// -------------------------------------------
exports.getBet = asyncHandler(async (req, res) => {
  const bet = await DiceRollBet.findById(req.params.id)
    .populate('user', 'username email')
    .populate('game', 'gameNumber status selectedWinner diceResult');

  if (!bet) {
    throw new AppError('Bet not found', 404);
  }

  // Check if user owns this bet or is admin
  if (bet.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AppError('Not authorized to view this bet', 403);
  }

  res.json({
    success: true,
    data: { bet },
  });
});

