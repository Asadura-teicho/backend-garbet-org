const mongoose = require('mongoose');

const { Schema } = mongoose;

const adminWalletSchema = new Schema(
  {
    balance: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    currency: {
      type: String,
      enum: ['TRY', 'USD', 'EUR'],
      default: 'TRY',
    },
    // Track total deposits and withdrawals
    totalDeposits: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalWithdrawals: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const Transaction = require('./Transaction.model');

// Ensure only one admin wallet document exists
adminWalletSchema.statics.getAdminWallet = async function () {
  let wallet = await this.findOne();
  if (!wallet) {
    wallet = await this.create({ balance: 0, currency: 'TRY' });
  }
  return wallet;
};

// Static method to add profit to admin wallet
adminWalletSchema.statics.addProfit = async function (amount, gameId = null, session = null) {
  let adminWallet = await this.findOne().session(session);
  if (!adminWallet) {
    adminWallet = await this.create([{ balance: 0, currency: 'TRY' }], { session });
    adminWallet = adminWallet[0];
  }

  adminWallet.balance = (adminWallet.balance || 0) + amount;
  await adminWallet.save({ session });

  // Create a transaction record for admin profit
  if (Transaction) {
    const transaction = await Transaction.create([{
      user: null, // No specific user for admin wallet transactions
      type: 'admin_profit',
      amount: amount,
      currency: 'TRY',
      status: 'completed',
      description: `Admin profit from Dice Roll Game ${gameId ? `(#${gameId})` : ''}`,
      metadata: { gameId: gameId, adminWalletId: adminWallet._id },
    }], { session });
  }

  return adminWallet;
};

module.exports = mongoose.model('AdminWallet', adminWalletSchema);

