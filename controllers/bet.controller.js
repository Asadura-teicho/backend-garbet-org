/**
 * Bet Controller (User-facing)
 * Handles betting history and bet details
 */

const Bet = require('../models/Bet.model');
const Match = require('../models/Match.model');

// -------------------------------------------
// @desc    Get betting history with advanced filters
// @route   GET /api/bets/history
// @access  Private
// -------------------------------------------
exports.getBettingHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      status,
      marketType,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = { user: userId };

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by market type
    if (marketType && marketType !== 'all') {
      query.marketType = marketType;
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

    // Search filter (match teams or bet ID)
    let betsQuery = Bet.find(query)
      .populate('match', 'teamA teamB league category matchDate result')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const bets = await betsQuery;

    // Filter by search if provided (after population)
    let filteredBets = bets;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredBets = bets.filter(
        (bet) =>
          bet.match?.teamA?.toLowerCase().includes(searchLower) ||
          bet.match?.teamB?.toLowerCase().includes(searchLower) ||
          bet.match?.league?.toLowerCase().includes(searchLower) ||
          bet._id.toString().toLowerCase().includes(searchLower) ||
          bet.marketName?.toLowerCase().includes(searchLower) ||
          bet.selection?.toLowerCase().includes(searchLower)
      );
    }

    const total = await Bet.countDocuments(query);

    // Format bets for response
    const formattedBets = filteredBets.map((bet) => ({
      id: bet._id,
      match: bet.match
        ? {
            id: bet.match._id,
            teamA: bet.match.teamA,
            teamB: bet.match.teamB,
            league: bet.match.league,
            category: bet.match.category,
            matchDate: bet.match.matchDate,
            result: bet.match.result,
          }
        : null,
      marketType: bet.marketType,
      marketName: bet.marketName,
      selection: bet.selection,
      odds: bet.odds,
      stake: bet.stake,
      potentialWin: bet.potentialWin,
      winAmount: bet.winAmount,
      status: bet.status,
      settledAt: bet.settledAt,
      createdAt: bet.createdAt,
    }));

    res.json({
      bets: formattedBets,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get bet details
// @route   GET /api/bets/:id
// @access  Private
// -------------------------------------------
exports.getBetDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const bet = await Bet.findOne({
      _id: id,
      user: userId,
    })
      .populate('match')
      .populate('transaction')
      .populate('winTransaction');

    if (!bet) {
      return res.status(404).json({ message: 'Bet not found' });
    }

    res.json({
      bet: {
        id: bet._id,
        match: bet.match,
        marketType: bet.marketType,
        marketName: bet.marketName,
        selection: bet.selection,
        odds: bet.odds,
        stake: bet.stake,
        potentialWin: bet.potentialWin,
        winAmount: bet.winAmount,
        status: bet.status,
        settledAt: bet.settledAt,
        createdAt: bet.createdAt,
        transaction: bet.transaction,
        winTransaction: bet.winTransaction,
        usedBonusBalance: bet.usedBonusBalance,
        usedMainBalance: bet.usedMainBalance,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get betting statistics
// @route   GET /api/bets/statistics
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
    const totalBets = await Bet.countDocuments(query);
    const wonBets = await Bet.countDocuments({ ...query, status: 'won' });
    const lostBets = await Bet.countDocuments({ ...query, status: 'lost' });
    const pendingBets = await Bet.countDocuments({ ...query, status: 'pending' });
    const cancelledBets = await Bet.countDocuments({ ...query, status: 'cancelled' });

    // Get aggregated statistics
    const stats = await Bet.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalStake: { $sum: '$stake' },
          totalWinnings: { $sum: '$winAmount' },
          totalPotentialWin: { $sum: '$potentialWin' },
          avgOdds: { $avg: '$odds' },
          maxStake: { $max: '$stake' },
          minStake: { $min: '$stake' },
        },
      },
    ]);

    const aggregatedStats = stats[0] || {
      totalStake: 0,
      totalWinnings: 0,
      totalPotentialWin: 0,
      avgOdds: 0,
      maxStake: 0,
      minStake: 0,
    };

    // Get statistics by status
    const statusStats = await Bet.aggregate([
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

    // Get statistics by market type
    const marketStats = await Bet.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$marketType',
          count: { $sum: 1 },
          totalStake: { $sum: '$stake' },
          totalWinnings: { $sum: '$winAmount' },
        },
      },
    ]);

    // Calculate win rate
    const settledBets = wonBets + lostBets;
    const winRate = settledBets > 0 ? (wonBets / settledBets) * 100 : 0;

    // Calculate profit/loss
    const profitLoss = aggregatedStats.totalWinnings - aggregatedStats.totalStake;

    res.json({
      overview: {
        totalBets,
        wonBets,
        lostBets,
        pendingBets,
        cancelledBets,
        settledBets,
        winRate: parseFloat(winRate.toFixed(2)),
      },
      financial: {
        totalStake: aggregatedStats.totalStake,
        totalWinnings: aggregatedStats.totalWinnings,
        totalPotentialWin: aggregatedStats.totalPotentialWin,
        profitLoss,
        roi: aggregatedStats.totalStake > 0
          ? ((profitLoss / aggregatedStats.totalStake) * 100).toFixed(2)
          : 0,
      },
      averages: {
        avgOdds: parseFloat(aggregatedStats.avgOdds.toFixed(2)),
        avgStake: totalBets > 0 ? aggregatedStats.totalStake / totalBets : 0,
        maxStake: aggregatedStats.maxStake,
        minStake: aggregatedStats.minStake,
      },
      statusBreakdown: statusStats,
      marketBreakdown: marketStats,
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get betting summary
// @route   GET /api/bets/summary
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

    // Get summary statistics
    const summary = await Bet.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalStake: { $sum: '$stake' },
          totalWinnings: { $sum: '$winAmount' },
          wonBets: {
            $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] },
          },
          lostBets: {
            $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] },
          },
        },
      },
    ]);

    const summaryData = summary[0] || {
      totalBets: 0,
      totalStake: 0,
      totalWinnings: 0,
      wonBets: 0,
      lostBets: 0,
    };

    const winRate =
      summaryData.wonBets + summaryData.lostBets > 0
        ? (summaryData.wonBets / (summaryData.wonBets + summaryData.lostBets)) * 100
        : 0;

    const profitLoss = summaryData.totalWinnings - summaryData.totalStake;

    res.json({
      period: parseInt(period),
      summary: {
        totalBets: summaryData.totalBets,
        totalStake: summaryData.totalStake,
        totalWinnings: summaryData.totalWinnings,
        wonBets: summaryData.wonBets,
        lostBets: summaryData.lostBets,
        winRate: parseFloat(winRate.toFixed(2)),
        profitLoss,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
