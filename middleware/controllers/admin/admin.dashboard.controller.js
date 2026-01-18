/**
 * Admin Dashboard Controller
 * Handles dashboard statistics and data
 */

const User = require('../../models/User.model');
const Bet = require('../../models/Bet.model');
const WithdrawalRequest = require('../../models/WithdrawalRequest.model');
const Transaction = require('../../models/Transaction.model');
const Game = require('../../models/Game.model');

// -------------------------------------------
// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard/stats
// @access  Private (Admin only)
// -------------------------------------------
exports.getDashboardStats = async (req, res) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();

    // Get active bets (pending status)
    const activeBets = await Bet.countDocuments({ status: 'pending' });

    // Get pending withdrawals total amount
    const pendingWithdrawals = await WithdrawalRequest.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const pendingWithdrawalsAmount = pendingWithdrawals[0]?.total || 0;

    // Get new registrations in last 24 hours
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const newRegistrations24h = await User.countDocuments({
      createdAt: { $gte: yesterday },
    });

    // Get previous period for comparison (24-48 hours ago)
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
    const previousRegistrations = await User.countDocuments({
      createdAt: { $gte: twoDaysAgo, $lt: yesterday },
    });

    // Calculate percentage change
    const registrationChange = previousRegistrations > 0
      ? ((newRegistrations24h - previousRegistrations) / previousRegistrations) * 100
      : newRegistrations24h > 0 ? 100 : 0;

    // Get revenue (completed deposits - completed withdrawals) in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deposits = await Transaction.aggregate([
      {
        $match: {
          type: 'deposit',
          status: 'completed',
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const withdrawals = await Transaction.aggregate([
      {
        $match: {
          type: 'withdrawal',
          status: 'completed',
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const revenue = (deposits[0]?.total || 0) - (withdrawals[0]?.total || 0);

    // Get previous period revenue for comparison
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const previousDeposits = await Transaction.aggregate([
      {
        $match: {
          type: 'deposit',
          status: 'completed',
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const previousWithdrawals = await Transaction.aggregate([
      {
        $match: {
          type: 'withdrawal',
          status: 'completed',
          createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const previousRevenue = (previousDeposits[0]?.total || 0) - (previousWithdrawals[0]?.total || 0);
    const revenueChange = previousRevenue !== 0
      ? ((revenue - previousRevenue) / Math.abs(previousRevenue)) * 100
      : revenue > 0 ? 100 : 0;

    // Get popular games (last 30 days)
    // const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const gameStats = await Game.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          status: { $in: ['completed', 'won', 'lost'] }
        }
      },
      {
        $group: {
          _id: '$gameType',
          count: { $sum: 1 },
          totalBetAmount: { $sum: '$betAmount' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ]);

    // Calculate percentages
    const totalGames = gameStats.reduce((sum, game) => sum + game.count, 0);
    const popularGames = gameStats.map((game) => {
      const gameTypeNames = {
        'slots': 'Slots',
        'live_casino': 'Live Casino',
        'crash': 'Crash',
        'sports': 'Sports',
        'live_betting': 'Live Betting'
      };
      
      return {
        name: gameTypeNames[game._id] || game._id,
        percentage: totalGames > 0 ? (game.count / totalGames) * 100 : 0,
        count: game.count,
        totalBetAmount: game.totalBetAmount
      };
    });

    res.json({
      stats: {
        totalUsers: {
          value: totalUsers,
          change: '0', // Can be calculated if needed
        },
        activeBets: {
          value: activeBets,
          change: '0',
        },
        pendingWithdrawals: {
          value: pendingWithdrawalsAmount,
          change: '0',
        },
        newRegistrations24h: {
          value: newRegistrations24h,
          change: registrationChange.toFixed(1),
        },
        revenue: {
          value: revenue,
          change: revenueChange.toFixed(1),
        },
      },
      popularGames: popularGames.length > 0 ? popularGames : [
        { name: 'Slots', percentage: 0, count: 0, totalBetAmount: 0 },
        { name: 'Live Casino', percentage: 0, count: 0, totalBetAmount: 0 },
        { name: 'Sports', percentage: 0, count: 0, totalBetAmount: 0 }
      ],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get recent transactions
// @route   GET /api/admin/dashboard/recent-transactions
// @access  Private (Admin only)
// -------------------------------------------
exports.getRecentTransactions = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const transactions = await Transaction.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Format transactions for frontend
    const formattedTransactions = transactions.map(tx => ({
      id: tx._id,
      _id: tx._id,
      user: tx.user,
      amount: tx.amount,
      type: tx.type,
      status: tx.status,
      currency: tx.currency,
      date: tx.createdAt,
      createdAt: tx.createdAt,
      description: tx.description
    }));

    res.json({
      transactions: formattedTransactions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get revenue chart data (time-series)
// @route   GET /api/admin/dashboard/revenue-chart
// @access  Private (Admin only)
// -------------------------------------------
exports.getRevenueChartData = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const daysCount = parseInt(days);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysCount);
    
    // Generate date array for the period
    const dateArray = [];
    for (let i = 0; i < daysCount; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dateArray.push(date);
    }
    
    // Get daily deposits
    const dailyDeposits = await Transaction.aggregate([
      {
        $match: {
          type: 'deposit',
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          total: { $sum: '$amount' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);
    
    // Get daily withdrawals
    const dailyWithdrawals = await Transaction.aggregate([
      {
        $match: {
          type: 'withdrawal',
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          total: { $sum: '$amount' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);
    
    // Create maps for quick lookup
    const depositsMap = {};
    dailyDeposits.forEach(item => {
      depositsMap[item._id] = item.total;
    });
    
    const withdrawalsMap = {};
    dailyWithdrawals.forEach(item => {
      withdrawalsMap[item._id] = item.total;
    });
    
    // Build chart data array
    const chartData = dateArray.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const deposits = depositsMap[dateStr] || 0;
      const withdrawals = withdrawalsMap[dateStr] || 0;
      const revenue = deposits - withdrawals;
      
      // Format date for display (MMM DD)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const displayDate = `${monthNames[date.getMonth()]} ${date.getDate()}`;
      
      return {
        date: dateStr,
        displayDate,
        deposits,
        withdrawals,
        revenue,
      };
    });
    
    res.json({
      chartData,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days: daysCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

