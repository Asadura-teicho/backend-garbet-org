const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gameType: {
      type: String,
      enum: ['slots', 'live_casino', 'crash', 'sports', 'live_betting'],
      required: true,
    },
    gameId: {
      type: String,
      required: true,
    },
    betAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    winAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled', 'won', 'lost'],
      default: 'pending',
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
    },
    multiplier: {
      type: Number,
      default: 1,
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'TRY'],
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
gameSchema.index({ user: 1, createdAt: -1 });
gameSchema.index({ gameType: 1, status: 1 });

module.exports = mongoose.model('Game', gameSchema);

