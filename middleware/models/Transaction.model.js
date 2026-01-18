const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Can be null for admin wallet transactions
      default: null,
    },
    type: {
      type: String,
      enum: ['deposit', 'withdrawal', 'bet', 'win', 'refund', 'bet_round', 'admin_credit', 'admin_debit', 'admin_profit', 'rejected', 'game_win', 'game_loss'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'TRY'],
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'rejected'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'crypto', 'e_wallet', 'internal'],
    },
    transactionId: {
      type: String,
      unique: true, 
      sparse: true,
    },
    description: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
