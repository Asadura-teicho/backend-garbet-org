/**
 * Admin Withdrawal Management Controller
 * Handles withdrawal pool operations
 */

const WithdrawalRequest = require('../../models/WithdrawalRequest.model');
const User = require('../../models/User.model');
const Transaction = require('../../models/Transaction.model');
const { logAdminAction, getIpAddress, getUserAgent } = require('../../utils/adminLogger');
const { sendWithdrawalApprovedEmail, sendWithdrawalRejectedEmail } = require('../../utils/emailService');
const { createNotification } = require('../../utils/notificationHelper');
const mongoose = require('mongoose');

// -------------------------------------------
// @desc    Get withdrawal pool (pending withdrawals)
// @route   GET /api/admin/withdrawal-pool
// @access  Private (Admin only)
// -------------------------------------------
exports.getWithdrawalPool = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 50, startDate, endDate, paymentMethod } = req.query;

    const query = { status };
    
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }
    
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

    // Create in-app notification (async, don't wait)
    createNotification({
      userId: withdrawal.user,
      type: 'withdrawal_approved',
      title: 'Withdrawal Approved',
      message: `Your withdrawal request of ₺${withdrawal.amount} has been approved and will be processed.`,
      link: '/withdraw',
      metadata: { withdrawalId: withdrawal._id, amount: withdrawal.amount },
    }).catch((err) => console.error('Notification creation error:', err));

    res.json({
      message: 'Withdrawal approved successfully',
      withdrawal,
      transaction,
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
      transaction.status = 'cancelled';
      transaction.description = `Withdrawal rejected - ${withdrawal.paymentMethod}`;
      transaction.metadata = {
        ...transaction.metadata,
        rejectedBy: adminId,
        rejectionReason,
      };
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
      metadata: { rejectionReason, iban: withdrawal.iban },
    });

    await session.commitTransaction();

    // Send email notification (async, don't wait)
    sendWithdrawalRejectedEmail(user, withdrawal.amount, rejectionReason).catch((err) => {
      console.error('Withdrawal rejection email error:', err);
    });

    // Create in-app notification (async, don't wait)
    createNotification({
      userId: withdrawal.user,
      type: 'withdrawal_rejected',
      title: 'Withdrawal Rejected',
      message: `Your withdrawal request of ₺${withdrawal.amount} has been rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : ''}`,
      link: '/withdraw',
      metadata: { withdrawalId: withdrawal._id, amount: withdrawal.amount, rejectionReason },
    }).catch((err) => console.error('Notification creation error:', err));

    res.json({
      message: 'Withdrawal rejected successfully',
      withdrawal,
      transaction,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Bulk approve withdrawals
// @route   POST /api/admin/withdrawal-pool/bulk-approve
// @access  Private (Admin only)
// -------------------------------------------
exports.bulkApproveWithdrawals = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { withdrawalIds, adminNotes } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Withdrawal IDs array is required' });
    }

    const withdrawals = await WithdrawalRequest.find({
      _id: { $in: withdrawalIds },
      status: 'pending',
    })
      .populate('user')
      .session(session);

    if (withdrawals.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No pending withdrawals found to approve' });
    }

    let approvedCount = 0;
    let totalAmount = 0;

    for (const withdrawal of withdrawals) {
      withdrawal.status = 'approved';
      withdrawal.approvedBy = adminId;
      withdrawal.approvedAt = new Date();
      withdrawal.adminNotes = adminNotes || null;
      await withdrawal.save({ session });

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

      approvedCount++;
      totalAmount += withdrawal.amount;
    }

    await session.commitTransaction();

    await logAdminAction({
      adminId,
      action: 'bulk_approve_withdrawals',
      targetType: 'withdrawal',
      targetId: null,
      description: `Bulk approved ${approvedCount} withdrawals`,
      metadata: { withdrawalIds, approvedCount, totalAmount },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    // Create notifications for bulk approved withdrawals (async, don't wait)
    const notificationPromises = withdrawals.map(withdrawal => 
      createNotification({
        userId: withdrawal.user._id || withdrawal.user,
        type: 'withdrawal_approved',
        title: 'Withdrawal Approved',
        message: `Your withdrawal request of ₺${withdrawal.amount} has been approved and will be processed.`,
        link: '/withdraw',
        metadata: { withdrawalId: withdrawal._id, amount: withdrawal.amount },
      })
    );
    
    Promise.all(notificationPromises).catch((err) => 
      console.error('Bulk withdrawal notification creation error:', err)
    );

    res.json({
      message: `Successfully approved ${approvedCount} withdrawals`,
      approvedCount,
      totalAmount,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Bulk reject withdrawals
// @route   POST /api/admin/withdrawal-pool/bulk-reject
// @access  Private (Admin only)
// -------------------------------------------
exports.bulkRejectWithdrawals = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { withdrawalIds, rejectionReason, adminNotes } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(withdrawalIds) || withdrawalIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Withdrawal IDs array is required' });
    }

    const withdrawals = await WithdrawalRequest.find({
      _id: { $in: withdrawalIds },
      status: 'pending',
    })
      .populate('user')
      .session(session);

    if (withdrawals.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No pending withdrawals found to reject' });
    }

    let rejectedCount = 0;

    for (const withdrawal of withdrawals) {
      const user = await User.findById(withdrawal.user).session(session);
      if (!user) continue;

      user.balance = (user.balance || 0) + withdrawal.amount;
      await user.save({ session });

      withdrawal.status = 'rejected';
      withdrawal.rejectedBy = adminId;
      withdrawal.rejectedAt = new Date();
      withdrawal.rejectionReason = rejectionReason || null;
      withdrawal.adminNotes = adminNotes || null;
      await withdrawal.save({ session });

      const transaction = await Transaction.findOne({
        user: withdrawal.user,
        'metadata.withdrawalRequestId': withdrawal._id,
      }).session(session);

      if (transaction) {
        transaction.status = 'cancelled';
        transaction.description = `Withdrawal rejected - ${withdrawal.paymentMethod}`;
        transaction.metadata = {
          ...transaction.metadata,
          rejectedBy: adminId,
          rejectionReason,
        };
        await transaction.save({ session });
      }

      rejectedCount++;
    }

    await session.commitTransaction();

    await logAdminAction({
      adminId,
      action: 'bulk_reject_withdrawals',
      targetType: 'withdrawal',
      targetId: null,
      description: `Bulk rejected ${rejectedCount} withdrawals`,
      metadata: { withdrawalIds, rejectedCount, rejectionReason },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    // Create notifications for bulk rejected withdrawals (async, don't wait)
    const notificationPromises = withdrawals.map(withdrawal => 
      createNotification({
        userId: withdrawal.user._id || withdrawal.user,
        type: 'withdrawal_rejected',
        title: 'Withdrawal Rejected',
        message: `Your withdrawal request of ₺${withdrawal.amount} has been rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : ''}`,
        link: '/withdraw',
        metadata: { withdrawalId: withdrawal._id, amount: withdrawal.amount, rejectionReason },
      })
    );
    
    Promise.all(notificationPromises).catch((err) => 
      console.error('Bulk withdrawal rejection notification error:', err)
    );

    res.json({
      message: `Successfully rejected ${rejectedCount} withdrawals`,
      rejectedCount,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Export withdrawals to CSV
// @route   GET /api/admin/withdrawal-pool/export
// @access  Private (Admin only)
// -------------------------------------------
exports.exportWithdrawals = async (req, res) => {
  try {
    const { status, startDate, endDate, paymentMethod } = req.query;

    const query = {};
    if (status && status !== 'Status: All') {
      query.status = status;
    }
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const withdrawals = await WithdrawalRequest.find(query)
      .populate('user', 'username email firstName lastName')
      .sort({ createdAt: -1 });

    const csvRows = [];
    csvRows.push([
      'ID',
      'User',
      'Email',
      'Amount',
      'Payment Method',
      'IBAN',
      'Status',
      'Created At',
      'Approved At',
      'Rejected At',
      'Rejection Reason',
      'Admin Notes',
    ].join(','));

    withdrawals.forEach((withdrawal) => {
      csvRows.push([
        withdrawal._id || '',
        withdrawal.user?.username || '',
        withdrawal.user?.email || '',
        withdrawal.amount || 0,
        withdrawal.paymentMethod || '',
        withdrawal.iban || '',
        withdrawal.status || '',
        withdrawal.createdAt ? withdrawal.createdAt.toISOString() : '',
        withdrawal.approvedAt ? withdrawal.approvedAt.toISOString() : '',
        withdrawal.rejectedAt ? withdrawal.rejectedAt.toISOString() : '',
        withdrawal.rejectionReason || '',
        withdrawal.adminNotes || '',
      ].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','));
    });

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=withdrawals-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

