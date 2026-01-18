const Transaction = require('../models/Transaction.model');
const User = require('../models/User.model');
const mongoose = require('mongoose');

// @desc    Create a deposit transaction
// @route   POST /api/transactions/deposit
// @access  Private
exports.createDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, paymentMethod, description } = req.body;
    const userId = req.user.id;

    // Validate amount
    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Create transaction record
    const transaction = await Transaction.create(
      [
        {
          user: userId,
          type: 'deposit',
          amount,
          status: 'pending',
          paymentMethod: paymentMethod || 'internal',
          description: description || 'Deposit',
          transactionId: `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
      ],
      { session }
    );

    // Update user balance and total deposits
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          balance: amount,
          totalDeposits: amount,
        },
      },
      { session, new: true }
    );

    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // Update transaction status to completed
    transaction[0].status = 'completed';
    await transaction[0].save({ session });

    await session.commitTransaction();

    res.status(201).json({
      message: 'Deposit successful',
      transaction: transaction[0],
      newBalance: user.balance,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// @desc    Create a withdrawal transaction
// @route   POST /api/transactions/withdraw
// @access  Private
exports.createWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, paymentMethod, description } = req.body;
    const userId = req.user.id;

    // Validate amount
    if (!amount || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Check user balance
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.balance < amount) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Create transaction record
    const transaction = await Transaction.create(
      [
        {
          user: userId,
          type: 'withdrawal',
          amount,
          status: 'pending',
          paymentMethod: paymentMethod || 'bank_transfer',
          description: description || 'Withdrawal',
          transactionId: `WD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
      ],
      { session }
    );

    // Update user balance
    user.balance -= amount;
    user.totalWithdrawals += amount;
    await user.save({ session });

    // Update transaction status to completed
    transaction[0].status = 'completed';
    await transaction[0].save({ session });

    await session.commitTransaction();

    res.status(201).json({
      message: 'Withdrawal successful',
      transaction: transaction[0],
      newBalance: user.balance,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// @desc    Get user transactions
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, status, limit = 50, page = 1 } = req.query;

    const query = { user: userId };
    if (type) query.type = type;
    if (status) query.status = status;

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('user', 'name email');

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get transaction by ID
// @route   GET /api/transactions/:id
// @access  Private
exports.getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).populate('user', 'name email');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

