/**
 * Statistics Controller
 * Handles statistics and analytics operations
 */

const mongoose = require('mongoose');
const Match = require('../models/Match.model');
const Bet = require('../models/Bet.model');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');

// -------------------------------------------
// @desc    Get match results
// @route   GET /api/stats/results
// @access  Public/Private
// -------------------------------------------
exports.getMatchResults = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      league,
      category,
      startDate,
      endDate,
      status = 'finished',
    } = req.query;

    const query = {
      status: status === 'all' ? { $in: ['finished', 'cancelled'] } : status,
      'result.isSettled': true,
    };

    // Filter by league
    if (league) {
      query.league = { $regex: league, $options: 'i' };
    }

    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.matchDate = {};
      if (startDate) {
        query.matchDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.matchDate.$lte = new Date(endDate);
      }
    }

    const matches = await Match.find(query)
      .sort({ matchDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Match.countDocuments(query);

    // Format results
    const results = matches.map((match) => ({
      id: match._id,
      league: match.league,
      category: match.category,
      teamA: match.teamA,
      teamB: match.teamB,
      matchDate: match.matchDate,
      result: {
        teamAScore: match.result.teamAScore,
        teamBScore: match.result.teamBScore,
        winner: match.result.winner,
        isSettled: match.result.isSettled,
        settledAt: match.result.settledAt,
      },
      status: match.status,
    }));

    res.json({
      results,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get user statistics
// @route   GET /api/stats/statistics
// @access  Private
// -------------------------------------------
exports.getUserStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get betting statistics
    const totalBets = await Bet.countDocuments({ user: userId });
    const wonBets = await Bet.countDocuments({ user: userId, status: 'won' });
    const lostBets = await Bet.countDocuments({ user: userId, status: 'lost' });
    const pendingBets = await Bet.countDocuments({ user: userId, status: 'pending' });

    // Calculate betting amounts
    const bettingStats = await Bet.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalStake: { $sum: '$stake' },
          totalWinnings: { $sum: '$winAmount' },
          totalPotentialWin: { $sum: '$potentialWin' },
        },
      },
    ]);

    const bettingData = bettingStats[0] || {
      totalStake: 0,
      totalWinnings: 0,
      totalPotentialWin: 0,
    };

    // Get transaction statistics
    const transactionStats = await Transaction.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const transactionData = {};
    transactionStats.forEach((stat) => {
      transactionData[stat._id] = {
        totalAmount: stat.totalAmount,
        count: stat.count,
      };
    });

    // Calculate win rate
    const winRate =
      totalBets > 0 ? ((wonBets / (wonBets + lostBets)) * 100).toFixed(2) : 0;

    // Calculate profit/loss
    const profitLoss = bettingData.totalWinnings - bettingData.totalStake;

    res.json({
      user: {
        id: user._id,
        username: user.username,
        balance: user.balance || 0,
        totalDeposits: user.totalDeposits || 0,
        totalWithdrawals: user.totalWithdrawals || 0,
        totalWinnings: user.totalWinnings || 0,
      },
      betting: {
        totalBets,
        wonBets,
        lostBets,
        pendingBets,
        cancelledBets: totalBets - wonBets - lostBets - pendingBets,
        totalStake: bettingData.totalStake,
        totalWinnings: bettingData.totalWinnings,
        totalPotentialWin: bettingData.totalPotentialWin,
        winRate: parseFloat(winRate),
        profitLoss,
      },
      transactions: transactionData,
      summary: {
        totalDeposits: transactionData.deposit?.totalAmount || 0,
        totalWithdrawals: transactionData.withdrawal?.totalAmount || 0,
        totalWins: transactionData.win?.totalAmount || 0,
        totalBets: transactionData.bet?.totalAmount || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get betting history statistics
// @route   GET /api/stats/betting-history
// @access  Private
// -------------------------------------------
exports.getBettingHistoryStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, status } = req.query;

    const query = { user: userId };

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
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

    // Get betting statistics
    const stats = await Bet.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalStake: { $sum: '$stake' },
          totalWinnings: { $sum: '$winAmount' },
          totalPotentialWin: { $sum: '$potentialWin' },
        },
      },
    ]);

    // Get daily betting stats
    const dailyStats = await Bet.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
          totalStake: { $sum: '$stake' },
          totalWinnings: { $sum: '$winAmount' },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 30 },
    ]);

    // Get market type distribution
    const marketStats = await Bet.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$marketType',
          count: { $sum: 1 },
          totalStake: { $sum: '$stake' },
        },
      },
    ]);

    // Format status stats
    const statusStats = {};
    stats.forEach((stat) => {
      statusStats[stat._id] = {
        count: stat.count,
        totalStake: stat.totalStake,
        totalWinnings: stat.totalWinnings,
        totalPotentialWin: stat.totalPotentialWin,
      };
    });

    res.json({
      statusStats,
      dailyStats,
      marketStats,
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
