/**
 * Balance Tracking Service
 * Handles automatic balance adjustments and tracking
 */

const User = require('../models/User.model');
const BalanceHistory = require('../models/BalanceHistory.model');
const Transaction = require('../models/Transaction.model');
const { applyGameOutcome, calculateFinancialFlow } = require('./financialCalculator.service');
const mongoose = require('mongoose');

/**
 * Apply game outcome and update balance automatically
 * @param {string} userId - User ID
 * @param {Object} gameOutcome - Game outcome {type: 'win'|'loss'|'draw', amount?: number, percentage?: number}
 * @param {Object} options - Additional options {gameId, gameType, description, metadata}
 * @returns {Promise<Object>} - Balance update result
 */
async function applyGameOutcomeToBalance(userId, gameOutcome, options = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      throw new Error('User not found');
    }

    const previousBalance = user.balance || 0;
    const result = applyGameOutcome(previousBalance, gameOutcome);
    
    // Update user balance
    user.balance = result.newBalance;
    await user.save({ session });

    // Create balance history record
    const balanceHistory = await BalanceHistory.create([{
      user: userId,
      previousBalance: result.previousBalance,
      newBalance: result.newBalance,
      change: result.change,
      percentageChange: result.percentageChange,
      changeType: 'game_outcome',
      referenceId: options.gameId || null,
      referenceType: options.gameId ? 'game' : null,
      gameOutcome: {
        gameType: options.gameType || null,
        gameId: options.gameId || null,
        outcome: gameOutcome.type,
        amount: gameOutcome.amount || null,
        percentage: gameOutcome.percentage || null,
      },
      description: options.description || `Game outcome: ${gameOutcome.type}`,
      metadata: options.metadata || {},
    }], { session });

    // Create transaction record
    if (result.change !== 0) {
      await Transaction.create([{
        user: userId,
        type: result.type === 'win' || result.type === 'gain' ? 'win' : 'bet',
        amount: Math.abs(result.change),
        status: 'completed',
        description: options.description || `Game outcome: ${gameOutcome.type}`,
        metadata: {
          gameId: options.gameId,
          gameType: options.gameType,
          balanceChange: result.change,
          percentageChange: result.percentageChange,
          balanceHistoryId: balanceHistory[0]._id,
        },
      }], { session });
    }

    // Update user metrics
    if (result.type === 'win' || result.type === 'gain') {
      user.totalWinnings = (user.totalWinnings || 0) + Math.abs(result.change);
    }

    await user.save({ session });
    await session.commitTransaction();

    return {
      success: true,
      balance: {
        previous: result.previousBalance,
        current: result.newBalance,
        change: result.change,
        percentageChange: result.percentageChange,
      },
      balanceHistory: balanceHistory[0],
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Apply financial flow calculation to user balance
 * @param {string} userId - User ID
 * @param {number} startingBalance - Starting balance
 * @param {Array} operations - Array of operations
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Financial flow result
 */
async function applyFinancialFlowToBalance(userId, startingBalance, operations, options = {}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      throw new Error('User not found');
    }

    // Calculate financial flow
    const flowResult = calculateFinancialFlow(startingBalance, operations);
    
    // Update user balance to final balance
    user.balance = flowResult.finalBalance;
    await user.save({ session });

    // Create balance history record
    const balanceHistory = await BalanceHistory.create([{
      user: userId,
      previousBalance: flowResult.startingBalance,
      newBalance: flowResult.finalBalance,
      change: flowResult.netChange,
      percentageChange: flowResult.netPercentageChange,
      changeType: 'game_outcome',
      financialFlow: {
        startingBalance: flowResult.startingBalance,
        operations: operations,
        netChange: flowResult.netChange,
        netPercentageChange: flowResult.netPercentageChange,
      },
      description: options.description || 'Financial flow calculation',
      metadata: {
        totalOperations: flowResult.totalOperations,
        summary: flowResult.summary,
        ...options.metadata,
      },
    }], { session });

    await session.commitTransaction();

    return {
      success: true,
      flow: flowResult,
      balance: {
        previous: flowResult.startingBalance,
        current: flowResult.finalBalance,
        change: flowResult.netChange,
        percentageChange: flowResult.netPercentageChange,
      },
      balanceHistory: balanceHistory[0],
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Get user balance history with win/loss statistics
 * @param {string} userId - User ID
 * @param {Object} filters - Filters {startDate, endDate, changeType, limit, page}
 * @returns {Promise<Object>} - Balance history and statistics
 */
async function getBalanceHistory(userId, filters = {}) {
  const query = { user: userId };
  
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
  }
  
  if (filters.changeType) {
    query.changeType = filters.changeType;
  }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 50;
  const skip = (page - 1) * limit;

  const [history, total] = await Promise.all([
    BalanceHistory.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean(),
    BalanceHistory.countDocuments(query),
  ]);

  // Calculate statistics
  const wins = history.filter(h => h.changeType === 'win' || h.change > 0);
  const losses = history.filter(h => h.changeType === 'loss' || h.change < 0);
  
  const totalWins = wins.reduce((sum, h) => sum + Math.abs(h.change), 0);
  const totalLosses = Math.abs(losses.reduce((sum, h) => sum + h.change, 0));
  const netProfit = totalWins - totalLosses;

  return {
    history,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    statistics: {
      totalWins,
      totalLosses,
      netProfit,
      winCount: wins.length,
      lossCount: losses.length,
      winRate: history.length > 0 ? (wins.length / history.length) * 100 : 0,
      lossRate: history.length > 0 ? (losses.length / history.length) * 100 : 0,
    },
  };
}

module.exports = {
  applyGameOutcomeToBalance,
  applyFinancialFlowToBalance,
  getBalanceHistory,
};

