const mongoose = require('mongoose');

const { Schema } = mongoose;

const betRoundSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gameRound: {
      type: Schema.Types.ObjectId,
      ref: 'GameRound',
      required: true,
    },
    roundNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    betAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    percentage: {
      type: Number, // e.g. -40, +5, -12
      required: true,
    },
    resultType: {
      type: String,
      enum: ['win', 'loss', 'neutral'],
      required: true,
    },
    amountChange: {
      type: Number, // negative for loss, positive for win
      required: true,
    },
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true } // createdAt = time of round
);

// Indexes for faster queries
betRoundSchema.index({ user: 1, createdAt: -1 });
betRoundSchema.index({ roundNumber: 1 });
betRoundSchema.index({ user: 1, roundNumber: 1 });
betRoundSchema.index({ gameRound: 1 });
betRoundSchema.index({ gameRound: 1, user: 1 }); // Multiple bets per user per round

module.exports = mongoose.model('BetRound', betRoundSchema);

