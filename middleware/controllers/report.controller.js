const DepositRequest = require('../models/DepositRequest.model');
const WithdrawalRequest = require('../models/WithdrawalRequest.model');
const User = require('../models/User.model');
const Bet = require('../models/Bet.model');
const Match = require('../models/Match.model');
const Transaction = require('../models/Transaction.model');
const Game = require('../models/Game.model');

// -------------------------------------------
// @desc    Get deposits report
// @route   GET /api/reports/deposits
// @access  Private (Admin only)
// -------------------------------------------
exports.getDepositsReport = async (req, res) => {
  try {
    const { startDate, endDate, status, format } = req.query;

    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    const deposits = await DepositRequest.find(query)
      .populate('user', 'username firstName lastName email')
      .populate('approvedBy', 'username')
      .sort({ createdAt: -1 });

    // Calculate totals
    const totals = {
      totalAmount: 0,
      approvedAmount: 0,
      pendingAmount: 0,
      cancelledAmount: 0,
      count: deposits.length,
    };

    deposits.forEach((deposit) => {
      totals.totalAmount += deposit.amount;
      if (deposit.status === 'approved') {
        totals.approvedAmount += deposit.adjustedAmount || deposit.amount;
      } else if (deposit.status === 'pending') {
        totals.pendingAmount += deposit.amount;
      } else if (deposit.status === 'cancelled') {
        totals.cancelledAmount += deposit.amount;
      }
    });

    // CSV export
    if (format === 'csv') {
      const csv = convertDepositsToCSV(deposits);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=deposits-${Date.now()}.csv`);
      return res.send(csv);
    }

    res.json({
      deposits,
      totals,
      count: deposits.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get withdrawals report
// @route   GET /api/reports/withdrawals
// @access  Private (Admin only)
// -------------------------------------------
exports.getWithdrawalsReport = async (req, res) => {
  try {
    const { startDate, endDate, status, format } = req.query;

    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    const withdrawals = await WithdrawalRequest.find(query)
      .populate('user', 'username firstName lastName email')
      .populate('approvedBy', 'username')
      .populate('paidBy', 'username')
      .sort({ createdAt: -1 });

    // Calculate totals
    const totals = {
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      rejectedAmount: 0,
      count: withdrawals.length,
    };

    withdrawals.forEach((withdrawal) => {
      totals.totalAmount += withdrawal.amount;
      if (withdrawal.status === 'paid') {
        totals.paidAmount += withdrawal.amount;
      } else if (withdrawal.status === 'pending' || withdrawal.status === 'approved') {
        totals.pendingAmount += withdrawal.amount;
      } else if (withdrawal.status === 'rejected') {
        totals.rejectedAmount += withdrawal.amount;
      }
    });

    // CSV export
    if (format === 'csv') {
      const csv = convertWithdrawalsToCSV(withdrawals);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=withdrawals-${Date.now()}.csv`);
      return res.send(csv);
    }

    res.json({
      withdrawals,
      totals,
      count: withdrawals.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get registrations report
// @route   GET /api/reports/registrations
// @access  Private (Admin only)
// -------------------------------------------
exports.getRegistrationsReport = async (req, res) => {
  try {
    const { startDate, endDate, status, format } = req.query;

    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    const users = await User.find(query)
      .select('-password -__v')
      .sort({ createdAt: -1 });

    // Calculate totals
    const totals = {
      total: users.length,
      active: users.filter((u) => u.status === 'active').length,
      suspended: users.filter((u) => u.status === 'suspended').length,
      banned: users.filter((u) => u.status === 'banned').length,
      selfExcluded: users.filter((u) => u.status === 'self_excluded').length,
    };

    // CSV export
    if (format === 'csv') {
      const csv = convertRegistrationsToCSV(users);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=registrations-${Date.now()}.csv`);
      return res.send(csv);
    }

    res.json({
      users,
      totals,
      count: users.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get turnover report
// @route   GET /api/reports/turnover
// @access  Private (Admin only)
// -------------------------------------------
exports.getTurnoverReport = async (req, res) => {
  try {
    const { startDate, endDate, type, format } = req.query;

    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    let gameTurnover = 0;
    let gamePayouts = 0;
    let matchTurnover = 0;
    let matchPayouts = 0;

    // Game turnover (from Game model)
    if (!type || type === 'games') {
      const gameQuery = { ...query };
      const games = await Game.find(gameQuery);
      games.forEach((game) => {
        gameTurnover += game.betAmount;
        if (game.status === 'won') {
          gamePayouts += game.winAmount;
        }
      });
    }

    // Match turnover (from Bet model)
    if (!type || type === 'matches') {
      const betQuery = { ...query };
      const bets = await Bet.find(betQuery);
      bets.forEach((bet) => {
        matchTurnover += bet.stake;
        if (bet.status === 'won') {
          matchPayouts += bet.winAmount;
        }
      });
    }

    const totals = {
      gameTurnover,
      gamePayouts,
      gameNet: gameTurnover - gamePayouts,
      matchTurnover,
      matchPayouts,
      matchNet: matchTurnover - matchPayouts,
      totalTurnover: gameTurnover + matchTurnover,
      totalPayouts: gamePayouts + matchPayouts,
      totalNet: gameTurnover + matchTurnover - gamePayouts - matchPayouts,
    };

    res.json({
      totals,
      breakdown: {
        games: {
          turnover: gameTurnover,
          payouts: gamePayouts,
          net: gameTurnover - gamePayouts,
        },
        matches: {
          turnover: matchTurnover,
          payouts: matchPayouts,
          net: matchTurnover - matchPayouts,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Export data to CSV
// @route   GET /api/reports/export
// @access  Private (Admin only)
// -------------------------------------------
exports.exportData = async (req, res) => {
  try {
    const { type, startDate, endDate, status } = req.query;

    if (!type) {
      return res.status(400).json({ message: 'Export type gereklidir (deposits, withdrawals, registrations)' });
    }

    // Redirect to appropriate report endpoint with CSV format
    if (type === 'deposits') {
      req.query.format = 'csv';
      return exports.getDepositsReport(req, res);
    } else if (type === 'withdrawals') {
      req.query.format = 'csv';
      return exports.getWithdrawalsReport(req, res);
    } else if (type === 'registrations') {
      req.query.format = 'csv';
      return exports.getRegistrationsReport(req, res);
    } else {
      return res.status(400).json({ message: 'Geçersiz export type' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper functions for CSV conversion
function convertDepositsToCSV(deposits) {
  const headers = [
    'ID',
    'User',
    'Email',
    'Amount',
    'Adjusted Amount',
    'Status',
    'Payment Method',
    'Created At',
    'Approved At',
    'Approved By',
  ];

  const rows = deposits.map((deposit) => {
    const user = deposit.user;
    return [
      deposit._id,
      user ? `${user.firstName} ${user.lastName}` : 'N/A',
      user?.email || 'N/A',
      deposit.amount,
      deposit.adjustedAmount || deposit.amount,
      deposit.status,
      deposit.paymentMethod,
      deposit.createdAt.toISOString(),
      deposit.approvedAt ? deposit.approvedAt.toISOString() : '',
      deposit.approvedBy?.username || '',
    ];
  });

  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
}

function convertWithdrawalsToCSV(withdrawals) {
  const headers = [
    'ID',
    'User',
    'Email',
    'Amount',
    'IBAN',
    'Status',
    'Created At',
    'Paid At',
    'Paid By',
  ];

  const rows = withdrawals.map((withdrawal) => {
    const user = withdrawal.user;
    return [
      withdrawal._id,
      user ? `${user.firstName} ${user.lastName}` : 'N/A',
      user?.email || 'N/A',
      withdrawal.amount,
      withdrawal.iban,
      withdrawal.status,
      withdrawal.createdAt.toISOString(),
      withdrawal.paidAt ? withdrawal.paidAt.toISOString() : '',
      withdrawal.paidBy?.username || '',
    ];
  });

  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
}

function convertRegistrationsToCSV(users) {
  const headers = [
    'ID',
    'Username',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Status',
    'Balance',
    'Bonus Balance',
    'Total Deposits',
    'Total Withdrawals',
    'Registration Date',
  ];

  const rows = users.map((user) => {
    return [
      user._id,
      user.username,
      user.firstName,
      user.lastName,
      user.email,
      user.phone,
      user.status,
      user.balance,
      user.bonusBalance,
      user.totalDeposits,
      user.totalWithdrawals,
      user.createdAt.toISOString(),
    ];
  });

  return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
}

