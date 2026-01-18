const mongoose = require('mongoose');

const promotionClaimSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['claimed', 'active', 'completed', 'expired', 'cancelled'],
      default: 'claimed',
    },
    bonusAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    bonusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bonus',
      default: null,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
promotionClaimSchema.index({ user: 1, promotion: 1 });
promotionClaimSchema.index({ user: 1, status: 1 });
promotionClaimSchema.index({ promotion: 1, status: 1 });
promotionClaimSchema.index({ user: 1, createdAt: -1 });

// Prevent duplicate claims (user can only claim same promotion once)

module.exports = mongoose.model('PromotionClaim', promotionClaimSchema);
