/**
 * Balance History Model
 * Tracks all balance changes with win/loss percentages
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const balanceHistorySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    previousBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    newBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    change: {
      type: Number,
      required: true,
      default: 0,
    },
    percentageChange: {
      type: Number,
      default: 0,
    },
    changeType: {
      type: String,
      enum: ['win', 'loss', 'gain', 'bet', 'deposit', 'withdrawal', 'admin_adjustment', 'game_outcome'],
      required: true,
    },
    // Reference to related entity (game, transaction, etc.)
    referenceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    referenceType: {
      type: String,
      enum: ['game', 'transaction', 'bet', 'withdrawal', 'deposit'],
      default: null,
    },
    // Game outcome details (if applicable)
    gameOutcome: {
      gameType: String,
      gameId: Schema.Types.ObjectId,
      outcome: String, // 'win', 'loss', 'draw'
      amount: Number,
      percentage: Number,
    },
    // Financial flow calculation (if applicable)
    financialFlow: {
      startingBalance: Number,
      operations: [{
        type: String,
        amount: Number,
        percentage: Number,
      }],
      netChange: Number,
      netPercentageChange: Number,
    },
    description: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
balanceHistorySchema.index({ user: 1, createdAt: -1 });
balanceHistorySchema.index({ changeType: 1, createdAt: -1 });
balanceHistorySchema.index({ referenceId: 1, referenceType: 1 });

module.exports = mongoose.model('BalanceHistory', balanceHistorySchema);

