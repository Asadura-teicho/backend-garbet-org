/**
 * Admin Deposit Management Controller
 * Handles deposit pool operations
 */

const DepositRequest = require('../../models/DepositRequest.model');
const User = require('../../models/User.model');
const Transaction = require('../../models/Transaction.model');
const { createDepositBonus } = require('../bonus.controller');
const { logAdminAction, getIpAddress, getUserAgent } = require('../../utils/adminLogger');
const { createNotification } = require('../../utils/notificationHelper');
const mongoose = require('mongoose');

// -------------------------------------------
// @desc    Get deposit pool (pending deposits)
// @route   GET /api/admin/deposit-pool
// @access  Private (Admin only)
// -------------------------------------------
exports.getDepositPool = async (req, res) => {
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

    // Create notification (async, don't wait)
    createNotification({
      userId: deposit.user,
      type: 'deposit_approved',
      title: 'Deposit Approved',
      message: `Your deposit of ₺${finalAmount} has been approved and added to your account.`,
      link: '/dashboard',
      metadata: { depositId: deposit._id, amount: finalAmount },
    }).catch((err) => console.error('Notification creation error:', err));

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

    // Create notification (async, don't wait)
    createNotification({
      userId: deposit.user,
      type: 'deposit_rejected',
      title: 'Deposit Cancelled',
      message: `Your deposit request of ₺${deposit.amount} has been cancelled.`,
      link: '/deposit',
      metadata: { depositId: deposit._id, amount: deposit.amount },
    }).catch((err) => console.error('Notification creation error:', err));

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
// @desc    Bulk approve deposits
// @route   POST /api/admin/deposit-pool/bulk-approve
// @access  Private (Admin only)
// -------------------------------------------
exports.bulkApproveDeposits = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { depositIds, adminNotes } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(depositIds) || depositIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Deposit IDs array is required' });
    }

    const deposits = await DepositRequest.find({
      _id: { $in: depositIds },
      status: 'pending',
    })
      .populate('user')
      .session(session);

    if (deposits.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'No pending deposits found to approve' });
    }

    let approvedCount = 0;
    let totalAmount = 0;

    for (const deposit of deposits) {
      const finalAmount = deposit.adjustedAmount || deposit.amount;
      const user = await User.findById(deposit.user).session(session);

      if (!user) continue;

      deposit.status = 'approved';
      deposit.approvedBy = adminId;
      deposit.approvedAt = new Date();
      deposit.adminNotes = adminNotes || null;
      await deposit.save({ session });

      user.balance = (user.balance || 0) + finalAmount;
      await user.save({ session });

      await Transaction.create(
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

      await createDepositBonus(deposit.user, finalAmount, deposit._id, session);

      approvedCount++;
      totalAmount += finalAmount;
    }

    await session.commitTransaction();

    await logAdminAction({
      adminId,
      action: 'bulk_approve_deposits',
      targetType: 'deposit',
      targetId: null,
      description: `Bulk approved ${approvedCount} deposits`,
      metadata: { depositIds, approvedCount, totalAmount },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    // Create notifications for bulk approved deposits (async, don't wait)
    const notificationPromises = deposits.map(deposit => {
      const finalAmount = deposit.adjustedAmount || deposit.amount;
      return createNotification({
        userId: deposit.user._id || deposit.user,
        type: 'deposit_approved',
        title: 'Deposit Approved',
        message: `Your deposit of ₺${finalAmount} has been approved and added to your account.`,
        link: '/dashboard',
        metadata: { depositId: deposit._id, amount: finalAmount },
      });
    });
    
    Promise.all(notificationPromises).catch((err) => 
      console.error('Bulk deposit notification creation error:', err)
    );

    res.json({
      message: `Successfully approved ${approvedCount} deposits`,
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
// @desc    Bulk cancel deposits
// @route   POST /api/admin/deposit-pool/bulk-cancel
// @access  Private (Admin only)
// -------------------------------------------
exports.bulkCancelDeposits = async (req, res) => {
  try {
    const { depositIds, adminNotes } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(depositIds) || depositIds.length === 0) {
      return res.status(400).json({ message: 'Deposit IDs array is required' });
    }

    const result = await DepositRequest.updateMany(
      { _id: { $in: depositIds }, status: 'pending' },
      {
        $set: {
          status: 'cancelled',
          cancelledBy: adminId,
          cancelledAt: new Date(),
          adminNotes: adminNotes || null,
        },
      }
    );

    await logAdminAction({
      adminId,
      action: 'bulk_cancel_deposits',
      targetType: 'deposit',
      targetId: null,
      description: `Bulk cancelled ${result.modifiedCount} deposits`,
      metadata: { depositIds, cancelledCount: result.modifiedCount },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    // Create notifications for bulk cancelled deposits (async, don't wait)
    const cancelledDeposits = await DepositRequest.find({
      _id: { $in: depositIds },
      status: 'cancelled',
    }).populate('user', '_id');
    
    const notificationPromises = cancelledDeposits.map(deposit => 
      createNotification({
        userId: deposit.user._id || deposit.user,
        type: 'deposit_rejected',
        title: 'Deposit Cancelled',
        message: `Your deposit request of ₺${deposit.amount} has been cancelled.`,
        link: '/deposit',
        metadata: { depositId: deposit._id, amount: deposit.amount },
      })
    );
    
    Promise.all(notificationPromises).catch((err) => 
      console.error('Bulk deposit cancellation notification error:', err)
    );

    res.json({
      message: `Successfully cancelled ${result.modifiedCount} deposits`,
      cancelledCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Export deposits to CSV
// @route   GET /api/admin/deposit-pool/export
// @access  Private (Admin only)
// -------------------------------------------
exports.exportDeposits = async (req, res) => {
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

    const deposits = await DepositRequest.find(query)
      .populate('user', 'username email firstName lastName')
      .sort({ createdAt: -1 });

    const csvRows = [];
    csvRows.push([
      'ID',
      'User',
      'Email',
      'Amount',
      'Adjusted Amount',
      'Payment Method',
      'Status',
      'Created At',
      'Approved At',
      'Admin Notes',
    ].join(','));

    deposits.forEach((deposit) => {
      csvRows.push([
        deposit._id || '',
        deposit.user?.username || '',
        deposit.user?.email || '',
        deposit.amount || 0,
        deposit.adjustedAmount || deposit.amount || 0,
        deposit.paymentMethod || '',
        deposit.status || '',
        deposit.createdAt ? deposit.createdAt.toISOString() : '',
        deposit.approvedAt ? deposit.approvedAt.toISOString() : '',
        deposit.adminNotes || '',
      ].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','));
    });

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=deposits-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

