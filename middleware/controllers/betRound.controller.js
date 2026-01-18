/**
 * Bet Round Controller
 * Handles betting round API endpoints
 */

const BetRound = require('../models/BetRound.model');
const GameRound = require('../models/GameRound.model');
const User = require('../models/User.model');
const { processBetRound } = require('../services/betRound.service');
const gameRoundService = require('../services/gameRound.service');

// -------------------------------------------
// @desc    Place a bet on a round
// @route   POST /api/bet-rounds/place
// @access  Private
// -------------------------------------------
exports.placeBet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameRoundId, roundNumber, betAmount, percentage } = req.body;

    // Validation
    if (!betAmount || percentage === undefined) {
      return res.status(400).json({
        message: 'Missing required fields: betAmount, percentage',
      });
    }

    // gameRoundId or roundNumber must be provided
    if (!gameRoundId && !roundNumber) {
      // Try to get current active round
      const currentRound = await gameRoundService.getCurrentRound();
      if (!currentRound) {
        return res.status(400).json({
          message: 'No active round found. Please provide gameRoundId or roundNumber, or wait for a round to start.',
        });
      }
      // Use current round
      var targetRound = currentRound._id;
    } else if (gameRoundId) {
      var targetRound = gameRoundId;
    } else {
      var targetRound = roundNumber;
    }

    if (typeof betAmount !== 'number' || betAmount <= 0) {
      return res.status(400).json({
        message: 'betAmount must be a positive number',
      });
    }

    if (typeof percentage !== 'number') {
      return res.status(400).json({
        message: 'percentage must be a number',
      });
    }

    // Process the bet round
    const result = await processBetRound(userId, targetRound, betAmount, percentage);

    res.status(201).json({
      message: 'Bet placed successfully',
      betRound: {
        id: result.betRound._id,
        gameRoundId: result.gameRound.id,
        roundNumber: result.betRound.roundNumber,
        betAmount: result.betRound.betAmount,
        percentage: result.betRound.percentage,
        resultType: result.betRound.resultType,
        amountChange: result.betRound.amountChange,
        balanceBefore: result.betRound.balanceBefore,
        balanceAfter: result.betRound.balanceAfter,
        createdAt: result.betRound.createdAt,
      },
      gameRound: result.gameRound,
      balance: result.balanceAfter,
    });
  } catch (error) {
    console.error('Place bet error:', error);
    res.status(400).json({
      message: error.message || 'Failed to place bet',
    });
  }
};

// -------------------------------------------
// @desc    Get betting history
// @route   GET /api/bet-rounds/history
// @access  Private
// -------------------------------------------
exports.getBettingHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      resultType,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = { user: userId };

    // Filter by result type
    if (resultType && ['win', 'loss', 'neutral'].includes(resultType)) {
      query.resultType = resultType;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get betting rounds with gameRound populated
    const betRounds = await BetRound.find(query)
      .populate('gameRound', 'roundNumber status multiplier')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count
    const total = await BetRound.countDocuments(query);

    // Format response
    const formattedRounds = betRounds.map((round) => ({
      id: round._id,
      gameRoundId: round.gameRound?._id || null,
      roundNumber: round.roundNumber,
      betAmount: round.betAmount,
      percentage: round.percentage,
      resultType: round.resultType,
      amountChange: round.amountChange,
      balanceBefore: round.balanceBefore,
      balanceAfter: round.balanceAfter,
      gameRound: round.gameRound ? {
        id: round.gameRound._id,
        roundNumber: round.gameRound.roundNumber,
        status: round.gameRound.status,
        multiplier: round.gameRound.multiplier,
      } : null,
      createdAt: round.createdAt,
    }));

    res.json({
      betRounds: formattedRounds,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get betting history error:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch betting history',
    });
  }
};

// -------------------------------------------
// @desc    Get specific round details
// @route   GET /api/bet-rounds/:id
// @access  Private
// -------------------------------------------
exports.getBetRoundDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const betRound = await BetRound.findOne({
      _id: id,
      user: userId,
    }).lean();

    if (!betRound) {
      return res.status(404).json({
        message: 'Bet round not found',
      });
    }

    res.json({
      betRound: {
        id: betRound._id,
        roundNumber: betRound.roundNumber,
        betAmount: betRound.betAmount,
        percentage: betRound.percentage,
        resultType: betRound.resultType,
        amountChange: betRound.amountChange,
        balanceBefore: betRound.balanceBefore,
        balanceAfter: betRound.balanceAfter,
        createdAt: betRound.createdAt,
        updatedAt: betRound.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get bet round details error:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch bet round details',
    });
  }
};

// -------------------------------------------
// @desc    Get betting statistics
// @route   GET /api/bet-rounds/statistics
// @access  Private
// -------------------------------------------
exports.getBettingStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    const query = { user: userId };

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Get overall statistics
    const totalRounds = await BetRound.countDocuments(query);
    const wonRounds = await BetRound.countDocuments({ ...query, resultType: 'win' });
    const lostRounds = await BetRound.countDocuments({ ...query, resultType: 'loss' });
    const neutralRounds = await BetRound.countDocuments({ ...query, resultType: 'neutral' });

    // Get aggregated statistics
    const stats = await BetRound.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalBetAmount: { $sum: '$betAmount' },
          totalAmountChange: { $sum: '$amountChange' },
          avgPercentage: { $avg: '$percentage' },
          maxBetAmount: { $max: '$betAmount' },
          minBetAmount: { $min: '$betAmount' },
          totalWins: {
            $sum: { $cond: [{ $eq: ['$resultType', 'win'] }, 1, 0] },
          },
          totalLosses: {
            $sum: { $cond: [{ $eq: ['$resultType', 'loss'] }, 1, 0] },
          },
          totalWinsAmount: {
            $sum: {
              $cond: [
                { $eq: ['$resultType', 'win'] },
                '$amountChange',
                0,
              ],
            },
          },
          totalLossesAmount: {
            $sum: {
              $cond: [
                { $eq: ['$resultType', 'loss'] },
                '$amountChange',
                0,
              ],
            },
          },
        },
      },
    ]);

    const aggregatedStats = stats[0] || {
      totalBetAmount: 0,
      totalAmountChange: 0,
      avgPercentage: 0,
      maxBetAmount: 0,
      minBetAmount: 0,
      totalWins: 0,
      totalLosses: 0,
      totalWinsAmount: 0,
      totalLossesAmount: 0,
    };

    // Calculate win rate
    const settledRounds = wonRounds + lostRounds;
    const winRate = settledRounds > 0 ? (wonRounds / settledRounds) * 100 : 0;

    // Calculate profit/loss
    const profitLoss = aggregatedStats.totalAmountChange;

    // Get statistics by result type
    const resultTypeStats = await BetRound.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$resultType',
          count: { $sum: 1 },
          totalBetAmount: { $sum: '$betAmount' },
          totalAmountChange: { $sum: '$amountChange' },
        },
      },
    ]);

    res.json({
      overview: {
        totalRounds,
        wonRounds,
        lostRounds,
        neutralRounds,
        settledRounds,
        winRate: parseFloat(winRate.toFixed(2)),
      },
      financial: {
        totalBetAmount: aggregatedStats.totalBetAmount,
        totalAmountChange: aggregatedStats.totalAmountChange,
        profitLoss,
        roi:
          aggregatedStats.totalBetAmount > 0
            ? ((profitLoss / aggregatedStats.totalBetAmount) * 100).toFixed(2)
            : 0,
        totalWinsAmount: aggregatedStats.totalWinsAmount,
        totalLossesAmount: Math.abs(aggregatedStats.totalLossesAmount),
      },
      averages: {
        avgPercentage: parseFloat(aggregatedStats.avgPercentage.toFixed(2)),
        avgBetAmount:
          totalRounds > 0
            ? aggregatedStats.totalBetAmount / totalRounds
            : 0,
        maxBetAmount: aggregatedStats.maxBetAmount,
        minBetAmount: aggregatedStats.minBetAmount,
      },
      resultTypeBreakdown: resultTypeStats,
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    console.error('Get betting statistics error:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch betting statistics',
    });
  }
};
