/**
 * Dashboard Controller
 * Handles user dashboard statistics and data
 */

const mongoose = require('mongoose');
const User = require('../models/User.model');
const Bet = require('../models/Bet.model');
const Transaction = require('../models/Transaction.model');
const Bonus = require('../models/Bonus.model');

// -------------------------------------------
// @desc    Get user dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
// -------------------------------------------
exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get betting statistics
    const totalBets = await Bet.countDocuments({ user: userId });
    const activeBets = await Bet.countDocuments({ user: userId, status: 'pending' });
    const wonBets = await Bet.countDocuments({ user: userId, status: 'won' });
    const lostBets = await Bet.countDocuments({ user: userId, status: 'lost' });

    // Get betting amounts
    const bettingStats = await Bet.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalStake: { $sum: '$stake' },
          totalWinnings: { $sum: '$winAmount' },
        },
      },
    ]);

    const bettingData = bettingStats[0] || { totalStake: 0, totalWinnings: 0 };

    // Get transaction statistics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
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

    // Get active bonuses count
    const activeBonuses = await Bonus.countDocuments({
      user: userId,
      status: 'active',
    });

    // Calculate win rate
    const totalSettledBets = wonBets + lostBets;
    const winRate = totalSettledBets > 0 ? (wonBets / totalSettledBets) * 100 : 0;

    // Calculate profit/loss
    const profitLoss = bettingData.totalWinnings - bettingData.totalStake;

    res.json({
      stats: {
        balance: user.balance || 0,
        totalBets,
        activeBets,
        wonBets,
        lostBets,
        totalStake: bettingData.totalStake,
        totalWinnings: bettingData.totalWinnings,
        winRate: parseFloat(winRate.toFixed(2)),
        profitLoss,
        activeBonuses,
        totalDeposits: transactionData.deposit?.totalAmount || 0,
        totalWithdrawals: transactionData.withdrawal?.totalAmount || 0,
        recentDeposits: transactionData.deposit?.count || 0,
        recentWithdrawals: transactionData.withdrawal?.count || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get recent activity
// @route   GET /api/dashboard/recent-activity
// @access  Private
// -------------------------------------------
exports.getRecentActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, type } = req.query;

    const activities = [];

    // Get recent transactions
    if (!type || type === 'transaction' || type === 'all') {
      const transactionQuery = { user: userId };
      const transactions = await Transaction.find(transactionQuery)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      transactions.forEach((transaction) => {
        activities.push({
          id: transaction._id,
          type: 'transaction',
          action: transaction.type,
          description: transaction.description,
          amount: transaction.amount,
          status: transaction.status,
          createdAt: transaction.createdAt,
        });
      });
    }

    // Get recent bets
    if (!type || type === 'bet' || type === 'all') {
      const betQuery = { user: userId };
      const bets = await Bet.find(betQuery)
        .populate('match', 'teamA teamB league matchDate')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      bets.forEach((bet) => {
        activities.push({
          id: bet._id,
          type: 'bet',
          action: 'bet_placed',
          description: `${bet.marketName} - ${bet.selection}`,
          amount: bet.stake,
          status: bet.status,
          match: bet.match
            ? {
                teamA: bet.match.teamA,
                teamB: bet.match.teamB,
                league: bet.match.league,
              }
            : null,
          createdAt: bet.createdAt,
        });
      });
    }

    // Get recent bonuses
    if (!type || type === 'bonus' || type === 'all') {
      const bonusQuery = { user: userId };
      const bonuses = await Bonus.find(bonusQuery)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      bonuses.forEach((bonus) => {
        activities.push({
          id: bonus._id,
          type: 'bonus',
          action: 'bonus_awarded',
          description: `${bonus.type === 'deposit_bonus' ? 'Deposit' : 'Loss'} Bonus`,
          amount: bonus.amount,
          status: bonus.status,
          createdAt: bonus.createdAt,
        });
      });
    }

    // Sort all activities by date and limit
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const limitedActivities = activities.slice(0, parseInt(limit));

    res.json({
      activities: limitedActivities,
      total: limitedActivities.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get betting summary
// @route   GET /api/dashboard/betting-summary
// @access  Private
// -------------------------------------------
exports.getBettingSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query; // days

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    const query = {
      user: userId,
      createdAt: { $gte: daysAgo },
    };

    // Get betting statistics for period
    const bettingStats = await Bet.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalStake: { $sum: '$stake' },
          totalWinnings: { $sum: '$winAmount' },
        },
      },
    ]);

    // Get daily betting summary
    const dailySummary = await Bet.aggregate([
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
      { $sort: { _id: 1 } },
    ]);

    // Format status stats
    const statusStats = {};
    bettingStats.forEach((stat) => {
      statusStats[stat._id] = {
        count: stat.count,
        totalStake: stat.totalStake,
        totalWinnings: stat.totalWinnings,
      };
    });

    const totalBets = Object.values(statusStats).reduce((sum, stat) => sum + stat.count, 0);
    const totalStake = Object.values(statusStats).reduce((sum, stat) => sum + stat.totalStake, 0);
    const totalWinnings = Object.values(statusStats).reduce((sum, stat) => sum + stat.totalWinnings, 0);
    const profitLoss = totalWinnings - totalStake;

    res.json({
      period: parseInt(period),
      summary: {
        totalBets,
        totalStake,
        totalWinnings,
        profitLoss,
        winRate:
          statusStats.won && statusStats.lost
            ? ((statusStats.won.count / (statusStats.won.count + statusStats.lost.count)) * 100).toFixed(2)
            : 0,
      },
      statusStats,
      dailySummary,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get balance history
// @route   GET /api/dashboard/balance-history
// @access  Private
// -------------------------------------------
exports.getBalanceHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30', interval = 'day' } = req.query; // days, interval: day/week/month

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    // Get transactions that affect balance
    const transactions = await Transaction.find({
      user: userId,
      createdAt: { $gte: daysAgo },
      type: { $in: ['deposit', 'withdrawal', 'win', 'bet', 'refund'] },
    })
      .sort({ createdAt: 1 })
      .select('type amount createdAt');

    // Calculate balance over time
    let runningBalance = 0;
    const balanceHistory = [];

    // Group by interval
    let dateFormat = '%Y-%m-%d';
    if (interval === 'week') {
      dateFormat = '%Y-W%V';
    } else if (interval === 'month') {
      dateFormat = '%Y-%m';
    }

    const groupedTransactions = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          createdAt: { $gte: daysAgo },
          type: { $in: ['deposit', 'withdrawal', 'win', 'bet', 'refund'] },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$createdAt' },
          },
          deposits: {
            $sum: {
              $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0],
            },
          },
          withdrawals: {
            $sum: {
              $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0],
            },
          },
          wins: {
            $sum: {
              $cond: [{ $eq: ['$type', 'win'] }, '$amount', 0],
            },
          },
          bets: {
            $sum: {
              $cond: [{ $eq: ['$type', 'bet'] }, '$amount', 0],
            },
          },
          refunds: {
            $sum: {
              $cond: [{ $eq: ['$type', 'refund'] }, '$amount', 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get current balance
    const user = await User.findById(userId);
    const currentBalance = user?.balance || 0;

    // Calculate running balance (reverse from current)
    let balance = currentBalance;
    const history = [];

    // Process transactions in reverse to calculate historical balance
    for (let i = transactions.length - 1; i >= 0; i--) {
      const tx = transactions[i];
      let adjustment = 0;

      if (tx.type === 'deposit' || tx.type === 'win' || tx.type === 'refund') {
        adjustment = -tx.amount; // Subtract because we're going backwards
      } else if (tx.type === 'withdrawal' || tx.type === 'bet') {
        adjustment = tx.amount; // Add because we're going backwards
      }

      balance += adjustment;
      history.unshift({
        date: tx.createdAt,
        balance: balance,
        transaction: {
          type: tx.type,
          amount: tx.amount,
        },
      });
    }

    // Add current balance point
    if (transactions.length > 0) {
      history.push({
        date: new Date(),
        balance: currentBalance,
        transaction: null,
      });
    }

    res.json({
      period: parseInt(period),
      interval,
      currentBalance,
      history: history.slice(-parseInt(period) * (interval === 'day' ? 1 : interval === 'week' ? 7 : 30)),
      groupedData: groupedTransactions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
