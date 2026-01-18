const mongoose = require('mongoose');

const betSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
    },
    marketType: {
      type: String,
      required: true,
      enum: ['1X2', 'over_under', 'both_teams_score', 'handicap', 'custom'],
    },
    marketName: {
      type: String,
      required: true,
    },
    selection: {
      type: String,
      required: true, // e.g., "Team A Win", "Over 2.5"
    },
    odds: {
      type: Number,
      required: true,
      min: 1.0,
    },
    stake: {
      type: Number,
      required: true,
      min: 0,
    },
    potentialWin: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'won', 'lost', 'cancelled', 'refunded'],
      default: 'pending',
    },
    winAmount: {
      type: Number,
      default: 0,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    winTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    // Track if bonus balance was used
    usedBonusBalance: {
      type: Number,
      default: 0,
    },
    usedMainBalance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
betSchema.index({ user: 1, createdAt: -1 });
betSchema.index({ match: 1, status: 1 });
betSchema.index({ status: 1 });

module.exports = mongoose.model('Bet', betSchema);

