const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['welcome', 'deposit', 'cashback', 'reload', 'free_spins', 'tournament', 'other'],
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired', 'scheduled'],
      default: 'active',
    },
    // Promotion rules
    minDeposit: {
      type: Number,
      default: 0,
    },
    maxDeposit: {
      type: Number,
      default: null,
    },
    bonusPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    bonusAmount: {
      type: Number,
      default: 0,
    },
    maxBonus: {
      type: Number,
      default: null,
    },
    rolloverMultiplier: {
      type: Number,
      default: 5,
      min: 1,
    },
    // Eligibility
    eligibleUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    excludedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    // Usage limits
    maxUses: {
      type: Number,
      default: null, // null = unlimited
    },
    maxUsesPerUser: {
      type: Number,
      default: 1,
    },
    // Tracking
    totalUses: {
      type: Number,
      default: 0,
    },
    totalBonusGiven: {
      type: Number,
      default: 0,
    },
    // Display
    bannerImage: {
      type: String,
      default: null,
    },
    termsAndConditions: {
      type: String,
      default: '',
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
promotionSchema.index({ status: 1, startDate: 1, endDate: 1 });
promotionSchema.index({ type: 1 });
promotionSchema.index({ startDate: 1, endDate: 1 });

// Virtual for checking if promotion is currently active
promotionSchema.virtual('isActive').get(function() {
  const now = new Date();
  return (
    this.status === 'active' &&
    this.startDate <= now &&
    this.endDate >= now
  );
});

module.exports = mongoose.model('Promotion', promotionSchema);
