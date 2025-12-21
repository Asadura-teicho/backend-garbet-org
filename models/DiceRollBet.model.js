const mongoose = require('mongoose');

const { Schema } = mongoose;

const diceRollBetSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    game: {
      type: Schema.Types.ObjectId,
      ref: 'DiceRollGame',
      required: true,
    },
    gameNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    // Which option the user bet on
    selectedOption: {
      type: String,
      enum: ['player1', 'player2'],
      required: true,
    },
    betAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Potential win amount (betAmount * payoutMultiplier)
    potentialWin: {
      type: Number,
      required: true,
      min: 0,
    },
    // Actual win amount (0 if lost)
    winAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'won', 'lost', 'cancelled', 'refunded'],
      default: 'pending',
    },
    // Balance tracking
    balanceBefore: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    // Transaction references
    betTransaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    winTransaction: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    // Settled timestamp
    settledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
diceRollBetSchema.index({ user: 1, createdAt: -1 });
diceRollBetSchema.index({ game: 1, status: 1 });
diceRollBetSchema.index({ gameNumber: 1 });
diceRollBetSchema.index({ status: 1 });

module.exports = mongoose.model('DiceRollBet', diceRollBetSchema);

