const DepositRequest = require('../models/DepositRequest.model');
const WithdrawalRequest = require('../models/WithdrawalRequest.model');
const AdminLog = require('../models/AdminLog.model');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const Bet = require('../models/Bet.model');
const Match = require('../models/Match.model');
const { createDepositBonus } = require('./bonus.controller');
const { logAdminAction, getIpAddress, getUserAgent } = require('../utils/adminLogger');
const { sendWithdrawalApprovedEmail, sendWithdrawalRejectedEmail } = require('../utils/emailService');
const mongoose = require('mongoose');

// -------------------------------------------
// @desc    Get deposit pool (pending deposits)
// @route   GET /api/admin/deposit-pool
// @access  Private (Admin only)
// -------------------------------------------
exports.getDepositPool = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 50 } = req.query;

    const query = { status };
    const deposits = await DepositRequest.find(query)
      .populate('user', 'username email firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DepositRequest.countDocuments(query);

    res.json({
      deposits,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get deposit request by ID
// @route   GET /api/admin/deposit-pool/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.getDepositRequestById = async (req, res) => {
  try {
    const deposit = await DepositRequest.findById(req.params.id).populate(
      'user',
      'username email firstName lastName balance'
    );

    if (!deposit) {
      return res.status(404).json({ message: 'Deposit request not found' });
    }

    res.json({ deposit });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Approve deposit
// @route   POST /api/admin/deposit-pool/:id/approve
// @access  Private (Admin only)
// -------------------------------------------
exports.approveDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { adjustedAmount, adminNotes } = req.body;
    const depositId = req.params.id;
    const adminId = req.user.id;

    const deposit = await DepositRequest.findById(depositId).session(session);
    if (!deposit) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Deposit request not found' });
    }

    if (deposit.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Deposit request is not pending' });
    }

    // Use adjusted amount if provided, otherwise use original amount
    const finalAmount = adjustedAmount || deposit.amount;

    // Get user
    const user = await User.findById(deposit.user).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // Update deposit request
    deposit.status = 'approved';
    deposit.adjustedAmount = adjustedAmount || null;
    deposit.approvedBy = adminId;
    deposit.approvedAt = new Date();
    deposit.adminNotes = adminNotes || null;
    await deposit.save({ session });

    // Update user balance
    user.balance = (user.balance || 0) + finalAmount;
    await user.save({ session });

    // Create transaction
    const transaction = await Transaction.create(
      [
        {
          user: deposit.user,
          type: 'deposit',
          amount: finalAmount,
          status: 'completed',
          description: `Deposit approved - ${deposit.paymentMethod}`,
          metadata: {
            depositRequestId: deposit._id,
            approvedBy: adminId,
          },
        },
      ],
      { session }
    );

    // Create deposit bonus if applicable
    await createDepositBonus(deposit.user, finalAmount, deposit._id, session);

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'approve_deposit',
      targetType: 'deposit',
      targetId: deposit._id.toString(),
      description: `Approved deposit of ₺${finalAmount} for user ${user.username}`,
      before: { status: 'pending', userBalance: user.balance - finalAmount },
      after: { status: 'approved', userBalance: user.balance },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
      metadata: { adjustedAmount, originalAmount: deposit.amount },
    });

    await session.commitTransaction();
    res.json({
      message: 'Deposit approved successfully',
      deposit,
      transaction: transaction[0],
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Cancel deposit
// @route   POST /api/admin/deposit-pool/:id/cancel
// @access  Private (Admin only)
// -------------------------------------------
exports.cancelDeposit = async (req, res) => {
  try {
    const { adminNotes } = req.body;
    const depositId = req.params.id;
    const adminId = req.user.id;

    const deposit = await DepositRequest.findById(depositId);
    if (!deposit) {
      return res.status(404).json({ message: 'Deposit request not found' });
    }

    if (deposit.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending deposits can be cancelled' });
    }

    deposit.status = 'cancelled';
    deposit.cancelledBy = adminId;
    deposit.cancelledAt = new Date();
    deposit.adminNotes = adminNotes || null;
    await deposit.save();

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'cancel_deposit',
      targetType: 'deposit',
      targetId: deposit._id.toString(),
      description: `Cancelled deposit of ₺${deposit.amount}`,
      before: { status: 'pending' },
      after: { status: 'cancelled' },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
      metadata: { adminNotes },
    });

    res.json({ message: 'Deposit cancelled successfully', deposit });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get withdrawal pool (pending withdrawals)
// @route   GET /api/admin/withdrawal-pool
// @access  Private (Admin only)
// -------------------------------------------
exports.getWithdrawalPool = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 50 } = req.query;

    const query = { status };
    const withdrawals = await WithdrawalRequest.find(query)
      .populate('user', 'username email firstName lastName balance')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await WithdrawalRequest.countDocuments(query);

    res.json({
      withdrawals,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get withdrawal request by ID
// @route   GET /api/admin/withdrawal-pool/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.getWithdrawalRequestById = async (req, res) => {
  try {
    const withdrawal = await WithdrawalRequest.findById(req.params.id).populate(
      'user',
      'username email firstName lastName balance'
    );

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal request not found' });
    }

    res.json({ withdrawal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Approve withdrawal
// @route   POST /api/admin/withdrawal-pool/:id/approve
// @access  Private (Admin only)
// -------------------------------------------
exports.approveWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { adminNotes } = req.body;
    const withdrawalId = req.params.id;
    const adminId = req.user.id;

    const withdrawal = await WithdrawalRequest.findById(withdrawalId).session(session);
    if (!withdrawal) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Withdrawal request not found' });
    }

    if (withdrawal.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Withdrawal request is not pending' });
    }

    // Get user
    const user = await User.findById(withdrawal.user).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // NOTE: Balance was already deducted when withdrawal request was created
    // We just need to mark it as approved - DO NOT deduct again!

    // Update withdrawal request
    withdrawal.status = 'approved';
    withdrawal.approvedBy = adminId;
    withdrawal.approvedAt = new Date();
    withdrawal.adminNotes = adminNotes || null;
    await withdrawal.save({ session });

    // Update existing transaction record (created when withdrawal request was made)
    const transaction = await Transaction.findOne({
      user: withdrawal.user,
      'metadata.withdrawalRequestId': withdrawal._id,
    }).session(session);

    if (transaction) {
      transaction.status = 'completed';
      transaction.description = `Withdrawal approved - ${withdrawal.paymentMethod}`;
      transaction.metadata = {
        ...transaction.metadata,
        approvedBy: adminId,
        iban: withdrawal.iban,
      };
      await transaction.save({ session });
    }

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'approve_withdrawal',
      targetType: 'withdrawal',
      targetId: withdrawal._id.toString(),
      description: `Approved withdrawal of ₺${withdrawal.amount} for user ${user.username}`,
      before: { status: 'pending', userBalance: user.balance },
      after: { status: 'approved', userBalance: user.balance },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
      metadata: { iban: withdrawal.iban },
    });

    await session.commitTransaction();

    // Send email notification (async, don't wait)
    sendWithdrawalApprovedEmail(user, withdrawal.amount, withdrawal.iban).catch((err) => {
      console.error('Withdrawal approval email error:', err);
    });

    res.json({
      message: 'Withdrawal approved successfully',
      withdrawal,
      transaction: transaction[0],
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Reject withdrawal
// @route   POST /api/admin/withdrawal-pool/:id/reject
// @access  Private (Admin only)
// -------------------------------------------
exports.rejectWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { rejectionReason, adminNotes } = req.body;
    const withdrawalId = req.params.id;
    const adminId = req.user.id;

    const withdrawal = await WithdrawalRequest.findById(withdrawalId).session(session);
    if (!withdrawal) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Withdrawal request not found' });
    }

    if (withdrawal.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Only pending withdrawals can be rejected' });
    }

    // Get user to refund balance
    const user = await User.findById(withdrawal.user).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // Refund the amount back to user balance (it was deducted when request was created)
    user.balance = (user.balance || 0) + withdrawal.amount;
    await user.save({ session });

    // Update withdrawal request
    withdrawal.status = 'rejected';
    withdrawal.rejectedBy = adminId;
    withdrawal.rejectedAt = new Date();
    withdrawal.rejectionReason = rejectionReason || null;
    withdrawal.adminNotes = adminNotes || null;
    await withdrawal.save({ session });

    // Update transaction status
    const transaction = await Transaction.findOne({
      user: withdrawal.user,
      'metadata.withdrawalRequestId': withdrawalId,
    }).session(session);

    if (transaction) {
      transaction.status = 'rejected';
      await transaction.save({ session });
    }

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'reject_withdrawal',
      targetType: 'withdrawal',
      targetId: withdrawal._id.toString(),
      description: `Rejected withdrawal of ₺${withdrawal.amount} for user ${user.username}`,
      before: { status: 'pending', userBalance: user.balance - withdrawal.amount },
      after: { status: 'rejected', userBalance: user.balance },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
      metadata: { rejectionReason, adminNotes },
    });

    await session.commitTransaction();

    // Send email notification (async, don't wait)
    sendWithdrawalRejectedEmail(user, withdrawal.amount, rejectionReason).catch((err) => {
      console.error('Withdrawal rejection email error:', err);
    });

    res.json({
      message: 'Withdrawal rejected successfully and balance refunded',
      withdrawal,
      newBalance: user.balance,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Get admin logs
// @route   GET /api/admin/logs
// @access  Private (Admin only)
// -------------------------------------------
exports.getAdminLogs = async (req, res) => {
  try {
    const {
      adminId,
      action,
      targetType,
      startDate,
      endDate,
      limit = 50,
      page = 1,
    } = req.query;

    const query = {};

    // Admin filter
    if (adminId) {
      query.admin = adminId;
    }

    // Action filter
    if (action) {
      query.action = action;
    }

    // Target type filter
    if (targetType) {
      query.targetType = targetType;
    }

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

    const logs = await AdminLog.find(query)
      .populate('admin', 'username firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AdminLog.countDocuments(query);

    res.json({
      logs,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

    // Get revenue (total deposits - total withdrawals) for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const deposits30d = await Transaction.aggregate([
      {
        $match: {
          type: 'deposit',
          status: 'completed',
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const depositsAmount = deposits30d[0]?.total || 0;

    const withdrawals30d = await Transaction.aggregate([
      {
        $match: {
          type: 'withdrawal',
          status: 'completed',
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const withdrawalsAmount = withdrawals30d[0]?.total || 0;

    const revenue = depositsAmount - withdrawalsAmount;

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
    const previousDepositsAmount = previousDeposits[0]?.total || 0;

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
    const previousWithdrawalsAmount = previousWithdrawals[0]?.total || 0;

    const previousRevenue = previousDepositsAmount - previousWithdrawalsAmount;
    const revenueChange = previousRevenue > 0
      ? ((revenue - previousRevenue) / previousRevenue) * 100
      : revenue > 0 ? 100 : 0;

    // Get user count change
    const previousTotalUsers = await User.countDocuments({
      createdAt: { $lt: yesterday },
    });
    const userChange = previousTotalUsers > 0
      ? ((totalUsers - previousTotalUsers) / previousTotalUsers) * 100
      : totalUsers > 0 ? 100 : 0;

    // Get active bets change (compare with previous period)
    const previousActiveBets = await Bet.countDocuments({
      status: 'pending',
      createdAt: { $lt: yesterday },
    });
    const activeBetsChange = previousActiveBets > 0
      ? ((activeBets - previousActiveBets) / previousActiveBets) * 100
      : activeBets > 0 ? 100 : 0;

    // Get pending withdrawals change
    const previousPendingWithdrawals = await WithdrawalRequest.aggregate([
      {
        $match: {
          status: 'pending',
          createdAt: { $lt: yesterday },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const previousPendingAmount = previousPendingWithdrawals[0]?.total || 0;
    const pendingWithdrawalsChange = previousPendingAmount > 0
      ? ((pendingWithdrawalsAmount - previousPendingAmount) / previousPendingAmount) * 100
      : pendingWithdrawalsAmount > 0 ? 100 : 0;

    res.json({
      stats: {
        totalUsers: {
          value: totalUsers,
          change: userChange.toFixed(1),
        },
        activeBets: {
          value: activeBets,
          change: activeBetsChange.toFixed(1),
        },
        pendingWithdrawals: {
          value: pendingWithdrawalsAmount,
          change: pendingWithdrawalsChange.toFixed(1),
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
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get recent transactions for dashboard
// @route   GET /api/admin/dashboard/recent-transactions
// @access  Private (Admin only)
// -------------------------------------------
exports.getRecentTransactions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get recent deposits and withdrawals
    const deposits = await DepositRequest.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit);

    const withdrawals = await WithdrawalRequest.find()
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Combine and sort by date
    const allTransactions = [
      ...deposits.map((d) => ({
        id: d._id,
        user: d.user,
        date: d.createdAt,
        amount: d.amount,
        type: 'Deposit',
        status: d.status,
        paymentMethod: d.paymentMethod,
      })),
      ...withdrawals.map((w) => ({
        id: w._id,
        user: w.user,
        date: w.createdAt,
        amount: w.amount,
        type: 'Withdrawal',
        status: w.status,
        paymentMethod: w.paymentMethod,
        iban: w.iban,
      })),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);

    res.json({ transactions: allTransactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get users list with pagination and filters
// @route   GET /api/admin/users
// @access  Private (Admin only)
// -------------------------------------------
exports.getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      role,
      startDate,
      endDate,
    } = req.query;

    const query = {};

    // Search filter (username, email)
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Status filter
    if (status && status !== 'All') {
      query.status = status;
    }

    // Role filter
    if (role) {
      query.role = role;
    }

    // Date range filter (registration date)
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const users = await User.find(query)
      .select('-password -__v -refreshToken')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get all bets with pagination and filters (Admin)
// @route   GET /api/admin/bets
// @access  Private (Admin only)
// -------------------------------------------
exports.getBets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      startDate,
      endDate,
      userId,
      matchId,
    } = req.query;

    const query = {};

    // User filter
    if (userId) {
      query.user = userId;
    }

    // Match filter
    if (matchId) {
      query.match = matchId;
    }

    // Status filter
    if (status && status !== 'Status') {
      query.status = status;
    }

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

    // Search filter (user username/email or bet ID)
    let betsQuery = Bet.find(query)
      .populate('user', 'username email')
      .populate('match', 'homeTeam awayTeam league category matchDate')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const bets = await betsQuery;

    // Filter by search if provided (after population)
    let filteredBets = bets;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredBets = bets.filter(
        (bet) =>
          bet.user?.username?.toLowerCase().includes(searchLower) ||
          bet.user?.email?.toLowerCase().includes(searchLower) ||
          bet._id.toString().toLowerCase().includes(searchLower) ||
          bet.match?.homeTeam?.toLowerCase().includes(searchLower) ||
          bet.match?.awayTeam?.toLowerCase().includes(searchLower)
      );
    }

    const total = await Bet.countDocuments(query);

    res.json({
      bets: filteredBets,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Update user status (Admin)
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin only)
// -------------------------------------------
exports.updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const userId = req.params.id;
    const adminId = req.user.id;

    if (!['active', 'blocked', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldStatus = user.status;
    user.status = status;
    await user.save();

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'update_user_status',
      targetType: 'user',
      targetId: userId,
      description: `Updated user status from ${oldStatus} to ${status}`,
      before: { status: oldStatus },
      after: { status },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.json({ message: 'User status updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
