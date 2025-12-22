/**
 * Dice Roll Game Controller
 * Handles dice roll game management (Admin)
 */

const DiceRollGame = require('../models/DiceRollGame.model');
const DiceRollBet = require('../models/DiceRollBet.model');
const MatchmakingQueue = require('../models/MatchmakingQueue.model');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const AdminWallet = require('../models/AdminWallet.model');
const BalanceHistory = require('../models/BalanceHistory.model');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/error.middleware').asyncHandler;
const AppError = require('../middleware/error.middleware').AppError;

// -------------------------------------------
// @desc    Create a new dice roll game
// @route   POST /api/dice-roll-games
// @access  Admin
// -------------------------------------------
exports.createGame = asyncHandler(async (req, res) => {
  const { player1Name, player2Name, payoutMultiplier } = req.body;
  const adminId = req.user.id;

  // Get next game number
  const nextGameNumber = await DiceRollGame.getNextGameNumber();

  // Create game
  const game = await DiceRollGame.create({
    gameNumber: nextGameNumber,
    status: 'accepting-bets',
    options: {
      player1: {
        name: player1Name || 'Player 1',
        diceRange: { min: 1, max: 3 },
      },
      player2: {
        name: player2Name || 'Player 2',
        diceRange: { min: 4, max: 6 },
      },
    },
    payoutMultiplier: payoutMultiplier || 2.0,
    startedAt: new Date(),
    createdBy: adminId,
  });

  res.status(201).json({
    success: true,
    message: 'Dice roll game created successfully',
    data: { game },
  });
});

// -------------------------------------------
// @desc    Get all dice roll games
// @route   GET /api/dice-roll-games
// @access  Public (both admin and users)
// -------------------------------------------
exports.getAllGames = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = {};

  if (status) {
    query.status = status;
  }

  const games = await DiceRollGame.find(query)
    .populate('createdBy', 'username email')
    .populate('winnerSelectedBy', 'username email')
    .sort({ gameNumber: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await DiceRollGame.countDocuments(query);

  res.json({
    success: true,
    data: {
      games,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    },
  });
});

// -------------------------------------------
// @desc    Get single dice roll game with bets
// @route   GET /api/dice-roll-games/:id
// @access  Public
// -------------------------------------------
exports.getGame = asyncHandler(async (req, res) => {
  const game = await DiceRollGame.findById(req.params.id)
    .populate('createdBy', 'username email')
    .populate('winnerSelectedBy', 'username email');

  if (!game) {
    throw new AppError('Game not found', 404);
  }

  // Get bets for this game
  const bets = await DiceRollBet.find({ game: game._id })
    .populate('user', 'username email')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      game,
      bets,
      betStats: {
        player1Bets: bets.filter(b => b.selectedOption === 'player1').length,
        player2Bets: bets.filter(b => b.selectedOption === 'player2').length,
        player1Total: bets
          .filter(b => b.selectedOption === 'player1')
          .reduce((sum, b) => sum + b.betAmount, 0),
        player2Total: bets
          .filter(b => b.selectedOption === 'player2')
          .reduce((sum, b) => sum + b.betAmount, 0),
      },
    },
  });
});

// -------------------------------------------
// @desc    Get active game (accepting bets or in-progress PvP matches)
// @route   GET /api/dice-roll-games/active
// @access  Public
// -------------------------------------------
exports.getActiveGame = asyncHandler(async (req, res) => {
  // Get betting games (accepting bets)
  const bettingGame = await DiceRollGame.findOne({ 
    status: 'accepting-bets',
    gameType: 'betting'
  })
    .populate('createdBy', 'username email')
    .sort({ gameNumber: -1 });

  // Get active PvP matches (in-progress or waiting-for-admin)
  const pvpGames = await DiceRollGame.find({ 
    status: { $in: ['in-progress', 'waiting-for-admin'] },
    gameType: 'player-vs-player'
  })
    .populate('players.player1.user', 'username')
    .populate('players.player2.user', 'username')
    .sort({ gameNumber: -1 });

  // If we have a betting game, return it with bets
  if (bettingGame) {
    const bets = await DiceRollBet.find({ game: bettingGame._id, status: 'pending' })
      .populate('user', 'username email')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: {
        game: bettingGame,
        bets,
        betStats: {
          player1Bets: bets.filter(b => b.selectedOption === 'player1').length,
          player2Bets: bets.filter(b => b.selectedOption === 'player2').length,
          player1Total: bets
            .filter(b => b.selectedOption === 'player1')
            .reduce((sum, b) => sum + b.betAmount, 0),
          player2Total: bets
            .filter(b => b.selectedOption === 'player2')
            .reduce((sum, b) => sum + b.betAmount, 0),
        },
        pvpGames: pvpGames.map(game => ({
          _id: game._id,
          gameNumber: game.gameNumber,
          status: game.status,
          players: {
            player1: {
              username: game.players.player1.username,
              diceRoll: game.players.player1.diceRoll,
              betAmount: game.players.player1.betAmount,
            },
            player2: {
              username: game.players.player2.username,
              diceRoll: game.players.player2.diceRoll,
              betAmount: game.players.player2.betAmount,
            },
          },
        })),
      },
    });
  }

  // If no betting game but we have PvP games, return those
  if (pvpGames.length > 0) {
    // Get bets for all PvP games
    const allBets = await DiceRollBet.find({ 
      game: { $in: pvpGames.map(g => g._id) },
      status: 'pending'
    })
      .populate('user', 'username email')
      .sort({ createdAt: -1 });

    const pvpGamesWithBets = pvpGames.map(game => {
      const gameBets = allBets.filter(b => b.game.toString() === game._id.toString());
      return {
        _id: game._id,
        gameNumber: game.gameNumber,
        status: game.status,
        gameType: 'player-vs-player',
        players: {
          player1: {
            username: game.players.player1.username,
            diceRoll: game.players.player1.diceRoll,
            betAmount: game.players.player1.betAmount,
          },
          player2: {
            username: game.players.player2.username,
            diceRoll: game.players.player2.diceRoll,
            betAmount: game.players.player2.betAmount,
          },
        },
        betStats: {
          player1Bets: gameBets.filter(b => b.selectedOption === 'player1').length,
          player2Bets: gameBets.filter(b => b.selectedOption === 'player2').length,
          player1Total: gameBets
            .filter(b => b.selectedOption === 'player1')
            .reduce((sum, b) => sum + b.betAmount, 0),
          player2Total: gameBets
            .filter(b => b.selectedOption === 'player2')
            .reduce((sum, b) => sum + b.betAmount, 0),
        },
      };
    });

    return res.json({
      success: true,
      data: {
        game: null,
        pvpGames: pvpGamesWithBets,
      },
    });
  }

  // No active games
  return res.json({
    success: true,
    data: { game: null, pvpGames: [], message: 'No active game' },
  });
});

// -------------------------------------------
// @desc    Close game (stop accepting bets)
// @route   PATCH /api/dice-roll-games/:id/close
// @access  Admin
// -------------------------------------------
exports.closeGame = asyncHandler(async (req, res) => {
  const game = await DiceRollGame.findById(req.params.id);

  if (!game) {
    throw new AppError('Game not found', 404);
  }

  if (game.status !== 'accepting-bets') {
    throw new AppError('Game is not accepting bets', 400);
  }

  game.status = 'closed';
  game.closedAt = new Date();
  await game.save();

  res.json({
    success: true,
    message: 'Game closed. No longer accepting bets.',
    data: { game },
  });
});

// -------------------------------------------
// @desc    Select winner and calculate payouts
// @route   PATCH /api/dice-roll-games/:id/select-winner
// @access  Admin
// -------------------------------------------
exports.selectWinner = asyncHandler(async (req, res) => {
  const { winner, diceResult, adminSetResult } = req.body;
  const adminId = req.user.id;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const game = await DiceRollGame.findById(req.params.id).session(session);

    if (!game) {
      await session.abortTransaction();
      throw new AppError('Game not found', 404);
    }

    if (game.status === 'completed') {
      await session.abortTransaction();
      throw new AppError('Game already completed', 400);
    }

    // Prevent admin from manipulating in-progress matches (but allow waiting-for-admin)
    if (game.status === 'in-progress') {
      await session.abortTransaction();
      throw new AppError('Cannot manipulate results of in-progress matches. Wait for players to finish.', 400);
    }

    if (!['player1', 'player2'].includes(winner)) {
      await session.abortTransaction();
      throw new AppError('Invalid winner. Must be player1 or player2', 400);
    }

    // Set winner and result
    game.selectedWinner = winner;
    game.winnerSelectedBy = adminId;

    // Set dice result (admin can override)
    if (adminSetResult !== undefined) {
      if (adminSetResult < 1 || adminSetResult > 6) {
        await session.abortTransaction();
        throw new AppError('Dice result must be between 1 and 6', 400);
      }
      game.adminSetResult = adminSetResult;
      game.diceResult = adminSetResult;
    } else if (diceResult !== undefined) {
      if (diceResult < 1 || diceResult > 6) {
        await session.abortTransaction();
        throw new AppError('Dice result must be between 1 and 6', 400);
      }
      game.diceResult = diceResult;
    }

    // Handle PvP games differently
    if (game.gameType === 'player-vs-player') {
      // Process player payouts: winner gets 2x their bet, rest goes to admin wallet
      const winnerUser = winner === 'player1' ? game.players.player1.user : game.players.player2.user;
      const loserUser = winner === 'player1' ? game.players.player2.user : game.players.player1.user;
      const winnerBetAmount = winner === 'player1' ? game.players.player1.betAmount : game.players.player2.betAmount;
      const loserBetAmount = winner === 'player1' ? game.players.player2.betAmount : game.players.player1.betAmount;
      const totalPot = game.players.player1.betAmount + game.players.player2.betAmount;
      
      // Winner gets 2x their bet amount
      const winnerPayout = winnerBetAmount * 2;
      // Remaining goes to admin wallet
      const adminProfit = totalPot - winnerPayout;

      const winnerUserDoc = await User.findById(winnerUser).session(session);
      if (winnerUserDoc) {
        const previousBalance = winnerUserDoc.balance || 0;
        winnerUserDoc.balance = previousBalance + winnerPayout;
        await winnerUserDoc.save({ session });

        // Create win transaction for player
        await Transaction.create([{
          user: winnerUser,
          type: 'win',
          amount: winnerPayout,
          currency: 'TRY',
          status: 'completed',
          description: `Dice Roll PvP Game #${game.gameNumber} - Win (2x bet)`,
          metadata: { gameId: game._id, gameType: 'player-vs-player', betAmount: winnerBetAmount },
        }], { session });

        // Track balance change with percentage
        const percentageChange = previousBalance > 0 ? (winnerPayout / previousBalance) * 100 : 0;
        await BalanceHistory.create([{
          user: winnerUser,
          previousBalance,
          newBalance: winnerUserDoc.balance,
          change: winnerPayout,
          percentageChange: parseFloat(percentageChange.toFixed(2)),
          changeType: 'game_outcome',
          referenceId: game._id,
          referenceType: 'game',
          gameOutcome: {
            gameType: 'player-vs-player',
            gameId: game._id,
            outcome: 'win',
            amount: winnerPayout,
          },
          description: `Dice Roll PvP Game #${game.gameNumber} - Win (2x bet: ₺${winnerBetAmount})`,
          metadata: { gameNumber: game.gameNumber },
        }], { session });
      }

      // Add remaining to admin wallet
      if (adminProfit > 0) {
        const adminWallet = await AdminWallet.getAdminWallet();
        adminWallet.balance = (adminWallet.balance || 0) + adminProfit;
        await adminWallet.save({ session });

        // Create transaction record for admin wallet
        await Transaction.create([{
          user: null, // Admin wallet transaction
          type: 'admin_profit',
          amount: adminProfit,
          currency: 'TRY',
          status: 'completed',
          description: `Dice Roll PvP Game #${game.gameNumber} - Admin profit`,
          metadata: { 
            gameId: game._id, 
            gameType: 'player-vs-player',
            totalPot,
            winnerPayout,
            adminProfit,
          },
        }], { session });
      }

      // Process bets from other users
      const bets = await DiceRollBet.find({
        game: game._id,
        status: 'pending',
      }).session(session);

      let totalBetPayout = 0;
      let winningBetsCount = 0;
      let losingBetsCount = 0;

      for (const bet of bets) {
        const user = await User.findById(bet.user).session(session);
        if (!user) continue;

        if (bet.selectedOption === winner) {
          const betWinAmount = bet.betAmount * (game.payoutMultiplier || 2.0);
          bet.winAmount = betWinAmount;
          bet.status = 'won';
          bet.settledAt = new Date();

          user.balance = (user.balance || 0) + betWinAmount;
          await user.save({ session });

          const winTransaction = await Transaction.create([{
            user: user._id,
            type: 'win',
            amount: betWinAmount,
            currency: user.currency || 'TRY',
            status: 'completed',
            description: `Dice Roll PvP Game #${game.gameNumber} - Bet win`,
            metadata: { gameId: game._id, gameNumber: game.gameNumber, betId: bet._id },
          }], { session });

          bet.winTransaction = winTransaction[0]._id;
          totalBetPayout += betWinAmount;
          winningBetsCount++;
        } else {
          bet.status = 'lost';
          bet.winAmount = 0;
          bet.settledAt = new Date();
          losingBetsCount++;
        }

        await bet.save({ session });
      }

      game.status = 'completed';
      game.completedAt = new Date();
      game.totalPayout = totalBetPayout;
      game.adminProfit = (game.totalBetAmount || 0) - totalBetPayout;
      await game.save({ session });

      await session.commitTransaction();

      return res.json({
        success: true,
        message: 'Winner selected and payouts processed',
        data: {
          game,
          stats: {
            playerPayout: winnerPayout,
            adminProfit: adminProfit,
            totalBets: bets.length,
            winningBets: winningBetsCount,
            losingBets: losingBetsCount,
            totalBetPayout,
            betAdminProfit: game.adminProfit,
          },
        },
      });
    }

    // Handle betting games (original logic)
    const bets = await DiceRollBet.find({
      game: game._id,
      status: 'pending',
    }).session(session);

    let totalPayout = 0;
    let winningBetsCount = 0;
    let losingBetsCount = 0;

    // Process each bet
    for (const bet of bets) {
      const user = await User.findById(bet.user).session(session);
      if (!user) continue;

      if (bet.selectedOption === winner) {
        // Winner - calculate payout
        const winAmount = bet.betAmount * game.payoutMultiplier;
        bet.winAmount = winAmount;
        bet.status = 'won';
        bet.settledAt = new Date();

        // Update user balance
        user.balance = (user.balance || 0) + winAmount;
        await user.save({ session });

        // Create win transaction
        const winTransaction = await Transaction.create(
          [
            {
              user: user._id,
              type: 'win',
              amount: winAmount,
              currency: user.currency || 'TRY',
              status: 'completed',
              description: `Dice Roll Game #${game.gameNumber} - Winner payout`,
              metadata: {
                gameId: game._id,
                gameNumber: game.gameNumber,
                betId: bet._id,
              },
            },
          ],
          { session }
        );

        bet.winTransaction = winTransaction[0]._id;
        totalPayout += winAmount;
        winningBetsCount++;
      } else {
        // Loser
        bet.status = 'lost';
        bet.winAmount = 0;
        bet.settledAt = new Date();
        losingBetsCount++;
      }

      await bet.save({ session });
    }

    // Update game stats
    game.status = 'completed';
    game.completedAt = new Date();
    game.totalPayout = totalPayout;
    game.adminProfit = game.totalBetAmount - totalPayout;
    await game.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Winner selected and payouts processed',
      data: {
        game,
        stats: {
          totalBets: bets.length,
          winningBets: winningBetsCount,
          losingBets: losingBetsCount,
          totalPayout,
          adminProfit: game.adminProfit,
        },
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
// @desc    Change game outcome (admin can change winner)
// @route   PATCH /api/dice-roll-games/:id/change-outcome
// @access  Admin
// -------------------------------------------
exports.changeOutcome = asyncHandler(async (req, res) => {
  const { newWinner, newDiceResult } = req.body;
  const adminId = req.user.id;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const game = await DiceRollGame.findById(req.params.id).session(session);

    if (!game) {
      await session.abortTransaction();
      throw new AppError('Game not found', 404);
    }

    if (game.status !== 'completed') {
      await session.abortTransaction();
      throw new AppError('Can only change outcome of completed games', 400);
    }

    if (!['player1', 'player2'].includes(newWinner)) {
      await session.abortTransaction();
      throw new AppError('Invalid winner. Must be player1 or player2', 400);
    }

    // If winner is the same, just update dice result if provided
    if (game.selectedWinner === newWinner) {
      if (newDiceResult !== undefined) {
        if (newDiceResult < 1 || newDiceResult > 6) {
          await session.abortTransaction();
          throw new AppError('Dice result must be between 1 and 6', 400);
        }
        game.adminSetResult = newDiceResult;
        game.diceResult = newDiceResult;
        await game.save({ session });
        await session.commitTransaction();

        return res.json({
          success: true,
          message: 'Dice result updated',
          data: { game },
        });
      }
    }

    // Get all bets
    const bets = await DiceRollBet.find({
      game: game._id,
      status: { $in: ['won', 'lost'] },
    }).session(session);

    const oldWinner = game.selectedWinner;
    let totalPayout = 0;
    let refundAmount = 0;

    // Reverse previous payouts
    for (const bet of bets) {
      const user = await User.findById(bet.user).session(session);
      if (!user) continue;

      if (bet.status === 'won') {
        // Refund the win amount (deduct from user)
        const winAmount = bet.winAmount;
        user.balance = Math.max(0, (user.balance || 0) - winAmount);
        await user.save({ session });
        refundAmount += winAmount;

        // Reverse win transaction
        if (bet.winTransaction) {
          await Transaction.findByIdAndUpdate(
            bet.winTransaction,
            { status: 'cancelled' },
            { session }
          );
        }
      }

      // Reset bet status
      bet.status = 'pending';
      bet.winAmount = 0;
      bet.settledAt = null;
      bet.winTransaction = null;
      await bet.save({ session });
    }

    // Set new winner
    game.selectedWinner = newWinner;
    game.winnerSelectedBy = adminId;
    if (newDiceResult !== undefined) {
      game.adminSetResult = newDiceResult;
      game.diceResult = newDiceResult;
    }

    // Process new payouts
    let winningBetsCount = 0;
    for (const bet of bets) {
      const user = await User.findById(bet.user).session(session);
      if (!user) continue;

      if (bet.selectedOption === newWinner) {
        const winAmount = bet.betAmount * game.payoutMultiplier;
        bet.winAmount = winAmount;
        bet.status = 'won';
        bet.settledAt = new Date();

        user.balance = (user.balance || 0) + winAmount;
        await user.save({ session });

        const winTransaction = await Transaction.create(
          [
            {
              user: user._id,
              type: 'win',
              amount: winAmount,
              currency: user.currency || 'TRY',
              status: 'completed',
              description: `Dice Roll Game #${game.gameNumber} - Winner payout (changed)`,
              metadata: {
                gameId: game._id,
                gameNumber: game.gameNumber,
                betId: bet._id,
                previousWinner: oldWinner,
              },
            },
          ],
          { session }
        );

        bet.winTransaction = winTransaction[0]._id;
        totalPayout += winAmount;
        winningBetsCount++;
      } else {
        bet.status = 'lost';
        bet.winAmount = 0;
        bet.settledAt = new Date();
      }

      await bet.save({ session });
    }

    // Update game stats
    game.totalPayout = totalPayout;
    game.adminProfit = game.totalBetAmount - totalPayout;
    await game.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Game outcome changed and payouts updated',
      data: {
        game,
        stats: {
          previousWinner: oldWinner,
          newWinner,
          totalBets: bets.length,
          winningBets: winningBetsCount,
          totalPayout,
          refundAmount,
          adminProfit: game.adminProfit,
        },
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
// @desc    Get game statistics for admin
// @route   GET /api/dice-roll-games/:id/stats
// @access  Admin
// -------------------------------------------
exports.getGameStats = asyncHandler(async (req, res) => {
  const game = await DiceRollGame.findById(req.params.id);

  if (!game) {
    throw new AppError('Game not found', 404);
  }

  const bets = await DiceRollBet.find({ game: game._id })
    .populate('user', 'username email');

  const player1Bets = bets.filter(b => b.selectedOption === 'player1');
  const player2Bets = bets.filter(b => b.selectedOption === 'player2');

  const stats = {
    game: {
      gameNumber: game.gameNumber,
      status: game.status,
      selectedWinner: game.selectedWinner,
      diceResult: game.diceResult,
    },
    bets: {
      total: bets.length,
      player1: {
        count: player1Bets.length,
        totalAmount: player1Bets.reduce((sum, b) => sum + b.betAmount, 0),
        potentialPayout: player1Bets.reduce((sum, b) => sum + b.potentialWin, 0),
      },
      player2: {
        count: player2Bets.length,
        totalAmount: player2Bets.reduce((sum, b) => sum + b.betAmount, 0),
        potentialPayout: player2Bets.reduce((sum, b) => sum + b.potentialWin, 0),
      },
    },
    financials: {
      totalBetAmount: game.totalBetAmount,
      totalPayout: game.totalPayout || 0,
      adminProfit: game.adminProfit || 0,
      potentialProfitIfPlayer1Wins:
        game.totalBetAmount -
        player1Bets.reduce((sum, b) => sum + b.potentialWin, 0),
      potentialProfitIfPlayer2Wins:
        game.totalBetAmount -
        player2Bets.reduce((sum, b) => sum + b.potentialWin, 0),
    },
  };

  res.json({
    success: true,
    data: stats,
  });
});

// -------------------------------------------
// @desc    Join matchmaking queue (Player vs Player)
// @route   POST /api/dice-roll-games/join-queue
// @access  Private
// -------------------------------------------
exports.joinMatchmakingQueue = asyncHandler(async (req, res) => {
  const { betAmount } = req.body;
  const userId = req.user.id;

  if (!betAmount || betAmount <= 0) {
    throw new AppError('Bet amount is required and must be greater than 0', 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if user is already in queue with waiting status
    const existingQueue = await MatchmakingQueue.findOne({ user: userId, status: 'waiting' }).session(session);
    if (existingQueue) {
      // Check if expired
      if (new Date() > existingQueue.expiresAt) {
        // Refund and remove expired entry
        const user = await User.findById(userId).session(session);
        if (user) {
          user.balance += existingQueue.betAmount;
          await user.save({ session });
        }
        await MatchmakingQueue.deleteOne({ _id: existingQueue._id }).session(session);
      } else {
        // Still in queue, return existing
        await session.abortTransaction();
        return res.json({
          success: true,
          message: 'Already in queue',
          data: { queue: existingQueue },
        });
      }
    }

    // Clean up any old entries (matched or expired) for this user
    const oldEntries = await MatchmakingQueue.find({ 
      user: userId, 
      status: { $in: ['matched', 'expired'] } 
    }).session(session);
    
    for (const oldEntry of oldEntries) {
      // Refund if not already refunded
      if (oldEntry.status === 'expired') {
        const user = await User.findById(userId).session(session);
        if (user) {
          user.balance += oldEntry.betAmount;
          await user.save({ session });
        }
      }
      await MatchmakingQueue.deleteOne({ _id: oldEntry._id }).session(session);
    }

    // Check user balance
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.balance < betAmount) {
      throw new AppError('Insufficient balance', 400);
    }

    // Reserve bet amount (deduct from balance)
    user.balance -= betAmount;
    await user.save({ session });

    // Delete any remaining entries for this user (safety check)
    await MatchmakingQueue.deleteMany({ user: userId }).session(session);

    // Create queue entry
    const queueEntry = await MatchmakingQueue.create([{
      user: userId,
      username: user.username,
      betAmount,
      status: 'waiting',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    }], { session });

    await session.commitTransaction();

    // Try to find a match immediately
    const match = await findMatchForUser(userId, betAmount);
    if (match) {
      return res.json({
        success: true,
        message: 'Match found!',
        data: { game: match, matched: true },
      });
    }

    res.json({
      success: true,
      message: 'Joined matchmaking queue',
      data: { queue: queueEntry[0], matched: false },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// -------------------------------------------
// @desc    Check matchmaking status
// @route   GET /api/dice-roll-games/matchmaking-status
// @access  Private
// -------------------------------------------
exports.getMatchmakingStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // First check if user is already in an active PvP game
  const activeGame = await DiceRollGame.findOne({
    $or: [
      { 'players.player1.user': userId },
      { 'players.player2.user': userId }
    ],
    status: { $in: ['in-progress', 'completed'] },
    gameType: 'player-vs-player'
  })
    .populate('players.player1.user', 'username')
    .populate('players.player2.user', 'username')
    .sort({ createdAt: -1 });

  if (activeGame) {
    return res.json({
      success: true,
      data: { 
        inQueue: false, 
        matched: true, 
        game: activeGame,
        status: activeGame.status === 'completed' ? 'completed' : 'in-game'
      },
    });
  }

  const queueEntry = await MatchmakingQueue.findOne({ user: userId, status: 'waiting' });
  if (!queueEntry) {
    return res.json({
      success: true,
      data: { inQueue: false },
    });
  }

  // Check if expired
  if (new Date() > queueEntry.expiresAt) {
    queueEntry.status = 'expired';
    await queueEntry.save();
    
    // Refund bet amount
    const user = await User.findById(userId);
    if (user) {
      user.balance += queueEntry.betAmount;
      await user.save();
    }
    await MatchmakingQueue.deleteOne({ _id: queueEntry._id });

    return res.json({
      success: true,
      data: { inQueue: false, expired: true },
    });
  }

  // Try to find match
  const match = await findMatchForUser(userId, queueEntry.betAmount);
  if (match) {
    return res.json({
      success: true,
      data: { inQueue: false, matched: true, game: match },
    });
  }

  res.json({
    success: true,
    data: { inQueue: true, queue: queueEntry },
  });
});

// -------------------------------------------
// @desc    Leave matchmaking queue
// @route   POST /api/dice-roll-games/leave-queue
// @access  Private
// -------------------------------------------
exports.leaveMatchmakingQueue = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const queueEntry = await MatchmakingQueue.findOne({ user: userId, status: 'waiting' }).session(session);
    if (!queueEntry) {
      await session.abortTransaction();
      return res.json({
        success: true,
        message: 'Not in queue',
      });
    }

    // Refund bet amount
    const user = await User.findById(userId).session(session);
    if (user) {
      user.balance += queueEntry.betAmount;
      await user.save({ session });
    }

    await MatchmakingQueue.deleteOne({ _id: queueEntry._id }).session(session);
    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Left matchmaking queue',
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// -------------------------------------------
// @desc    Roll dice for player vs player game
// @route   POST /api/dice-roll-games/:id/roll-dice
// @access  Private
// -------------------------------------------
exports.rollDice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const game = await DiceRollGame.findById(id).session(session);
    if (!game) {
      throw new AppError('Game not found', 404);
    }

    if (game.gameType !== 'player-vs-player') {
      throw new AppError('This is not a player vs player game', 400);
    }

    if (game.status !== 'in-progress') {
      throw new AppError('Game is not in progress', 400);
    }

    // Check if user is a player in this game
    const isPlayer1 = game.players.player1.user?.toString() === userId.toString();
    const isPlayer2 = game.players.player2.user?.toString() === userId.toString();

    if (!isPlayer1 && !isPlayer2) {
      throw new AppError('You are not a player in this game', 403);
    }

    // Check if player already rolled
    if (isPlayer1 && game.players.player1.diceRoll !== null) {
      throw new AppError('You have already rolled', 400);
    }
    if (isPlayer2 && game.players.player2.diceRoll !== null) {
      throw new AppError('You have already rolled', 400);
    }

    // Roll dice (random 1-6)
    const diceRoll = Math.floor(Math.random() * 6) + 1;

    // Update player's dice roll
    if (isPlayer1) {
      game.players.player1.diceRoll = diceRoll;
    } else {
      game.players.player2.diceRoll = diceRoll;
    }

    // Check if both players have rolled
    if (game.players.player1.diceRoll !== null && game.players.player2.diceRoll !== null) {
      const player1Roll = game.players.player1.diceRoll;
      const player2Roll = game.players.player2.diceRoll;
      
      // Check for draw/tie
      if (player1Roll === player2Roll) {
        // Draw - reset dice rolls and let players try again
        game.players.player1.diceRoll = null;
        game.players.player2.diceRoll = null;
        game.diceResult = null;
        // Keep status as in-progress for players to roll again
        await game.save({ session });
        await session.commitTransaction();
        
        return res.json({
          success: true,
          message: 'Draw! Both players rolled the same number. Please roll again.',
          data: {
            game,
            diceRoll,
            isDraw: true,
            isComplete: false,
            bothRolled: false,
            winner: null,
          },
        });
      }
      
      // Both players have rolled different numbers - automatically determine winner
      // Higher roll wins (or use financial calculator logic)
      const automaticWinner = player1Roll > player2Roll ? 'player1' : 'player2';
      game.selectedWinner = automaticWinner;
      game.diceResult = player1Roll > player2Roll ? player1Roll : player2Roll;
      
      // Process automatic payouts using the same logic as selectWinner
      const winnerUser = automaticWinner === 'player1' ? game.players.player1.user : game.players.player2.user;
      const winnerBetAmount = automaticWinner === 'player1' ? game.players.player1.betAmount : game.players.player2.betAmount;
      const totalPot = game.players.player1.betAmount + game.players.player2.betAmount;
      
      // Winner gets 2x their bet amount
      const winnerPayout = winnerBetAmount * 2;
      // Remaining goes to admin wallet
      const adminProfit = totalPot - winnerPayout;

      const winnerUserDoc = await User.findById(winnerUser).session(session);
      if (winnerUserDoc) {
        const previousBalance = winnerUserDoc.balance || 0;
        winnerUserDoc.balance = previousBalance + winnerPayout;
        await winnerUserDoc.save({ session });

        // Create win transaction for player
        await Transaction.create([{
          user: winnerUser,
          type: 'win',
          amount: winnerPayout,
          currency: 'TRY',
          status: 'completed',
          description: `Dice Roll PvP Game #${game.gameNumber} - Win (2x bet) - Auto`,
          metadata: { gameId: game._id, gameType: 'player-vs-player', betAmount: winnerBetAmount, autoSelected: true },
        }], { session });

        // Track balance change with percentage
        const percentageChange = previousBalance > 0 ? (winnerPayout / previousBalance) * 100 : 0;
        await BalanceHistory.create([{
          user: winnerUser,
          previousBalance,
          newBalance: winnerUserDoc.balance,
          change: winnerPayout,
          percentageChange: parseFloat(percentageChange.toFixed(2)),
          changeType: 'game_outcome',
          referenceId: game._id,
          referenceType: 'game',
          gameOutcome: {
            gameType: 'player-vs-player',
            gameId: game._id,
            outcome: 'win',
            amount: winnerPayout,
          },
          description: `Dice Roll PvP Game #${game.gameNumber} - Win (2x bet: ₺${winnerBetAmount}) - Auto`,
          metadata: { gameNumber: game.gameNumber, autoSelected: true },
        }], { session });
      }

      // Add remaining to admin wallet
      if (adminProfit !== 0) {
        await AdminWallet.addProfit(adminProfit, game._id, session);
      }

      // Process bets from other users
      const bets = await DiceRollBet.find({
        game: game._id,
        status: 'pending',
      }).session(session);

      let totalBetPayout = 0;
      let winningBetsCount = 0;
      let losingBetsCount = 0;

      for (const bet of bets) {
        const user = await User.findById(bet.user).session(session);
        if (!user) continue;

        if (bet.selectedOption === automaticWinner) {
          const betWinAmount = bet.betAmount * (game.payoutMultiplier || 2.0);
          bet.winAmount = betWinAmount;
          bet.status = 'won';
          bet.settledAt = new Date();

          user.balance = (user.balance || 0) + betWinAmount;
          await user.save({ session });

          const winTransaction = await Transaction.create([{
            user: user._id,
            type: 'win',
            amount: betWinAmount,
            currency: user.currency || 'TRY',
            status: 'completed',
            description: `Dice Roll PvP Game #${game.gameNumber} - Bet win (auto)`,
            metadata: { gameId: game._id, gameNumber: game.gameNumber, betId: bet._id, autoSelected: true },
          }], { session });

          bet.winTransaction = winTransaction[0]._id;
          totalBetPayout += betWinAmount;
          winningBetsCount++;
        } else {
          bet.status = 'lost';
          bet.winAmount = 0;
          bet.settledAt = new Date();
          losingBetsCount++;
        }

        await bet.save({ session });
      }

      // Update game stats
      game.totalPayout = (game.totalPayout || 0) + winnerPayout + totalBetPayout;
      game.adminProfit = (game.adminProfit || 0) + adminProfit;
      game.status = 'completed';
      game.completedAt = new Date();
    }

    await game.save({ session });
    await session.commitTransaction();
    
    // Get updated user balance after session commit
    let userBalance = null;
    try {
      const currentUser = await User.findById(userId);
      if (currentUser) {
        userBalance = currentUser.balance || 0;
      }
    } catch (err) {
      // Silently fail - balance will be fetched separately
    }

    res.json({
      success: true,
      message: 'Dice rolled successfully',
      data: {
        game,
        diceRoll,
        isComplete: game.status === 'completed',
        bothRolled: game.status === 'completed' || game.status === 'waiting-for-admin',
        isDraw: false,
        winner: game.selectedWinner,
        userBalance,
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
// @desc    End game session (after both players finish)
// @route   POST /api/dice-roll-games/:id/end-session
// @access  Private
// -------------------------------------------
exports.endGameSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const game = await DiceRollGame.findById(id).session(session);
    if (!game) {
      throw new AppError('Game not found', 404);
    }

    if (game.gameType !== 'player-vs-player') {
      throw new AppError('This is not a player vs player game', 400);
    }

    // Check if user is a player in this game
    const isPlayer1 = game.players.player1.user?.toString() === userId.toString();
    const isPlayer2 = game.players.player2.user?.toString() === userId.toString();

    if (!isPlayer1 && !isPlayer2) {
      throw new AppError('You are not a player in this game', 403);
    }

    // Check if game is completed
    if (game.status === 'completed') {
      // Game is already completed, just return success
      await session.commitTransaction();
      
      // Return updated game with user balance info
      const user = await User.findById(userId);
      return res.json({
        success: true,
        message: 'Game session ended. You can now play again or place bets!',
        data: {
          game,
          canPlayAgain: true,
          canBet: true,
          userBalance: user?.balance || 0,
        },
      });
    }

    // If game is waiting-for-admin, it should have been auto-completed by now
    // But if not, trigger auto-completion
    if (game.status === 'waiting-for-admin') {
      // Auto-select winner based on dice rolls if both have rolled
      if (game.players.player1.diceRoll !== null && game.players.player2.diceRoll !== null && !game.selectedWinner) {
        const player1Roll = game.players.player1.diceRoll;
        const player2Roll = game.players.player2.diceRoll;
        
        if (player1Roll !== player2Roll) {
          // This should have been handled in rollDice, but handle it here as fallback
          const automaticWinner = player1Roll > player2Roll ? 'player1' : 'player2';
          game.selectedWinner = automaticWinner;
          game.diceResult = player1Roll > player2Roll ? player1Roll : player2Roll;
          game.status = 'completed';
          game.completedAt = new Date();
          await game.save({ session });
        }
      }
    }

    if (game.status !== 'waiting-for-admin' && game.status !== 'completed' && game.status !== 'in-progress') {
      throw new AppError('Game is not in a valid state to end session', 400);
    }

    await session.commitTransaction();
    
    // Get updated user balance
    const user = await User.findById(userId);

    res.json({
      success: true,
      message: 'Game session ended. You can now play again or place bets!',
      data: {
        game,
        canPlayAgain: true,
        canBet: true,
        userBalance: user?.balance || 0,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// Helper function to find match for user
async function findMatchForUser(userId, betAmount) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find another player waiting with similar bet amount (within 20% difference)
    const minBet = betAmount * 0.8;
    const maxBet = betAmount * 1.2;

    const opponent = await MatchmakingQueue.findOne({
      user: { $ne: userId },
      status: 'waiting',
      betAmount: { $gte: minBet, $lte: maxBet },
      expiresAt: { $gt: new Date() },
    }).populate('user', 'username').session(session);

    if (!opponent) {
      await session.abortTransaction();
      return null;
    }

    // Get both users
    const player1 = await User.findById(userId).session(session);
    const player2 = await User.findById(opponent.user._id).session(session);

    if (!player1 || !player2) {
      await session.abortTransaction();
      return null;
    }

    // Randomize player order (50/50 chance) so it's fair
    const randomOrder = Math.random() > 0.5;
    const player1User = randomOrder ? userId : opponent.user._id;
    const player1Username = randomOrder ? player1.username : player2.username;
    const player1Bet = randomOrder ? betAmount : opponent.betAmount;
    const player2User = randomOrder ? opponent.user._id : userId;
    const player2Username = randomOrder ? player2.username : player1.username;
    const player2Bet = randomOrder ? opponent.betAmount : betAmount;

    // Create game
    const nextGameNumber = await DiceRollGame.getNextGameNumber();
    const game = await DiceRollGame.create([{
      gameNumber: nextGameNumber,
      status: 'in-progress',
      gameType: 'player-vs-player',
      players: {
        player1: {
          user: player1User,
          username: player1Username,
          betAmount: player1Bet,
        },
        player2: {
          user: player2User,
          username: player2Username,
          betAmount: player2Bet,
        },
      },
      startedAt: new Date(),
      createdBy: userId, // First player creates the game
    }], { session });

    // Update queue entries
    await MatchmakingQueue.updateOne(
      { _id: opponent._id },
      { status: 'matched', matchedAt: new Date() }
    ).session(session);
    await MatchmakingQueue.deleteOne({ user: userId }).session(session);

    await session.commitTransaction();

    return game[0];
  } catch (error) {
    await session.abortTransaction();
    return null;
  } finally {
    session.endSession();
  }
}

