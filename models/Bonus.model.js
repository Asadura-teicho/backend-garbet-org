const mongoose = require('mongoose');

const bonusSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['deposit_bonus', 'loss_bonus'],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    originalAmount: {
      type: Number,
      required: true,
      min: 0,
      // The original bonus amount (before any deductions)
    },
    principalAmount: {
      type: Number,
      default: 0,
      min: 0,
      // The principal (deposit) amount related to this bonus
    },
    usedAmount: {
      type: Number,
      default: 0,
      min: 0,
      // Amount of bonus that has been used
    },
    unlockedAmount: {
      type: Number,
      default: 0,
      min: 0,
      // Amount that has been unlocked and moved to main balance
    },
    turnover: {
      type: Number,
      default: 0,
      min: 0,
      // Total turnover achieved with this bonus
    },
    requiredTurnover: {
      type: Number,
      required: true,
      min: 0,
      // Required turnover (e.g., 5× the bonus amount)
    },
    principalLost: {
      type: Boolean,
      default: false,
      // Whether the principal has been lost
    },
    isUnlocked: {
      type: Number,
      default: 0,
      min: 0,
      // Amount that is currently unlocked (can be withdrawn)
    },
    status: {
      type: String,
      enum: ['active', 'unlocked', 'expired', 'cancelled'],
      default: 'active',
    },
    // Related transaction/request
    relatedDepositRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DepositRequest',
      default: null,
    },
    relatedMatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      default: null,
    },
    // Dates
    expiresAt: {
      type: Date,
      default: null,
    },
    unlockedAt: {
      type: Date,
      default: null,
    },
    // Admin
    createdBy: {
      type: String,
      enum: ['system', 'admin'],
      default: 'system',
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
bonusSchema.index({ user: 1, status: 1 });
bonusSchema.index({ user: 1, createdAt: -1 });
bonusSchema.index({ status: 1 });
bonusSchema.index({ type: 1 });

module.exports = mongoose.model('Bonus', bonusSchema);

