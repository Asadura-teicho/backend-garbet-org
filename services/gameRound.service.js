/**
 * Game Round Service
 * Handles game round lifecycle: start, crash, complete
 */

const GameRound = require('../models/GameRound.model');
const BetRound = require('../models/BetRound.model');
const mongoose = require('mongoose');

/**
 * Start a new game round
 * @param {ObjectId} adminId - Admin user who starts the round
 * @returns {Promise<GameRound>} The created game round
 */
async function startRound(adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if there's an active round
    const activeRound = await GameRound.findOne({ status: 'in-progress' }).session(session);
    if (activeRound) {
      await session.abortTransaction();
      throw new Error(`Round #${activeRound.roundNumber} is already in progress. Please crash it first.`);
    }

    // Get next round number
    const nextRoundNumber = await GameRound.getNextRoundNumber();

    // Create new round
    const gameRound = await GameRound.create(
      [
        {
          roundNumber: nextRoundNumber,
          status: 'in-progress',
          multiplier: 1.0,
          startedAt: new Date(),
          createdBy: adminId,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return gameRound[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Crash the current active round
 * This will cause all players who haven't cashed out to lose
 * @param {ObjectId} adminId - Admin user who crashes the round
 * @param {Number} multiplier - Optional multiplier at crash (default: current multiplier)
 * @returns {Promise<GameRound>} The crashed game round
 */
async function crashRound(adminId, multiplier = null) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const User = require('../models/User.model');
    const Transaction = require('../models/Transaction.model');
    
    // Find active round
    const gameRound = await GameRound.findOne({ status: 'in-progress' }).session(session);
    if (!gameRound) {
      await session.abortTransaction();
      throw new Error('No active round found to crash.');
    }

    // Get all bets for this round that are wins or neutral (not already losses)
    // When round crashes, all bets become losses
    const activeBets = await BetRound.find({
      gameRound: gameRound._id,
      resultType: { $in: ['win', 'neutral'] }, // Only process bets that are wins or neutral
    }).populate('user').session(session);

    // Update round status
    gameRound.status = 'crashed';
    gameRound.crashedAt = new Date();
    gameRound.endedAt = new Date();
    gameRound.crashedBy = adminId;
    if (multiplier !== null) {
      gameRound.multiplier = multiplier;
    }

    // Process each bet: convert wins/neutral to losses
    for (const bet of activeBets) {
      // Calculate loss: user loses their bet amount (already deducted, but they don't get any win)
      // The bet amount was already deducted when placed, so we just need to mark it as loss
      // If it was a win, we need to reverse the win amount
      
      if (bet.resultType === 'win') {
        // Reverse the win: deduct the win amount from balance
        const winAmount = bet.amountChange; // This is positive for wins
        const user = await User.findById(bet.user._id).session(session);
        if (user) {
          user.balance = Math.max(0, (user.balance || 0) - winAmount);
          await user.save({ session });
        }

        // Create transaction for loss reversal
        await Transaction.create(
          [
            {
              user: bet.user._id,
              type: 'bet_round',
              amount: winAmount,
              status: 'completed',
              description: `Round #${gameRound.roundNumber} crashed - win reversed`,
              metadata: {
                betRoundId: bet._id,
                gameRoundId: gameRound._id,
                roundNumber: gameRound.roundNumber,
                action: 'crash_reversal',
              },
            },
          ],
          { session }
        );
      }

      // Update bet to loss
      bet.resultType = 'loss';
      bet.amountChange = -bet.betAmount; // Full loss of bet amount
      bet.balanceAfter = bet.balanceBefore - bet.betAmount; // Final balance after loss
      await bet.save({ session });
    }

    await gameRound.save({ session });
    await session.commitTransaction();

    return gameRound;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Complete a round (when all bets are settled)
 * @param {ObjectId} roundId - The round ID to complete
 * @returns {Promise<GameRound>} The completed game round
 */
async function completeRound(roundId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const gameRound = await GameRound.findById(roundId).session(session);
    if (!gameRound) {
      await session.abortTransaction();
      throw new Error('Round not found.');
    }

    if (gameRound.status === 'completed') {
      await session.abortTransaction();
      return gameRound; // Already completed
    }

    gameRound.status = 'completed';
    gameRound.endedAt = new Date();

    await gameRound.save({ session });
    await session.commitTransaction();

    return gameRound;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Get current active round
 * @returns {Promise<GameRound|null>} The current active round or null
 */
async function getCurrentRound() {
  return await GameRound.getCurrentRound();
}

/**
 * Get round statistics
 * @param {ObjectId} roundId - The round ID
 * @returns {Promise<Object>} Round statistics
 */
async function getRoundStatistics(roundId) {
  const gameRound = await GameRound.findById(roundId);
  if (!gameRound) {
    throw new Error('Round not found.');
  }

  const bets = await BetRound.find({ gameRound: roundId }).populate('user', 'username email');

  const stats = {
    roundNumber: gameRound.roundNumber,
    status: gameRound.status,
    multiplier: gameRound.multiplier,
    totalBets: bets.length,
    totalBetAmount: bets.reduce((sum, bet) => sum + bet.betAmount, 0),
    totalPlayers: new Set(bets.map(bet => bet.user._id.toString())).size,
    wins: bets.filter(bet => bet.resultType === 'win').length,
    losses: bets.filter(bet => bet.resultType === 'loss').length,
    totalWinAmount: bets
      .filter(bet => bet.resultType === 'win')
      .reduce((sum, bet) => sum + bet.amountChange, 0),
    totalLossAmount: Math.abs(
      bets
        .filter(bet => bet.resultType === 'loss')
        .reduce((sum, bet) => sum + bet.amountChange, 0)
    ),
    startedAt: gameRound.startedAt,
    endedAt: gameRound.endedAt,
    crashedAt: gameRound.crashedAt,
  };

  return stats;
}

/**
 * Get recent rounds with pagination
 * @param {Object} options - Query options
 * @param {Number} options.page - Page number
 * @param {Number} options.limit - Items per page
 * @param {String} options.status - Filter by status
 * @returns {Promise<Object>} Paginated rounds
 */
async function getRecentRounds(options = {}) {
  const { page = 1, limit = 20, status } = options;

  const query = {};
  if (status) {
    query.status = status;
  }

  const rounds = await GameRound.find(query)
    .populate('createdBy', 'username email')
    .populate('crashedBy', 'username email')
    .sort({ roundNumber: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await GameRound.countDocuments(query);

  return {
    rounds,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    total,
  };
}

/**
 * Update round statistics (called when a bet is placed)
 * @param {ObjectId} roundId - The round ID
 * @param {Number} betAmount - The bet amount
 * @param {ObjectId} userId - The user ID
 * @returns {Promise<void>}
 */
async function updateRoundStats(roundId, betAmount, userId) {
  const gameRound = await GameRound.findById(roundId);
  if (!gameRound) {
    throw new Error('Round not found.');
  }

  // Count unique players
  const uniquePlayers = await BetRound.distinct('user', { gameRound: roundId });
  
  gameRound.totalBets += 1;
  gameRound.totalBetAmount += betAmount;
  gameRound.totalPlayers = uniquePlayers.length;

  await gameRound.save();
}

module.exports = {
  startRound,
  crashRound,
  completeRound,
  getCurrentRound,
  getRoundStatistics,
  getRecentRounds,
  updateRoundStats,
};

