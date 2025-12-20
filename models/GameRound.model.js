const mongoose = require('mongoose');

const { Schema } = mongoose;

const gameRoundSchema = new Schema(
  {
    roundNumber: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['waiting', 'in-progress', 'crashed', 'completed'],
      default: 'waiting',
      required: true,
    },
    multiplier: {
      type: Number,
      default: 1.0,
      min: 1.0,
    },
    crashedAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    totalBets: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalBetAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPlayers: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Admin who started the round
    },
    crashedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Admin who crashed the round (optional)
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
gameRoundSchema.index({ roundNumber: 1 });
gameRoundSchema.index({ status: 1 });
gameRoundSchema.index({ createdAt: -1 });
gameRoundSchema.index({ status: 1, createdAt: -1 });

// Static method to get current active round
gameRoundSchema.statics.getCurrentRound = async function () {
  return await this.findOne({ status: 'in-progress' }).sort({ roundNumber: -1 });
};

// Static method to get next round number
gameRoundSchema.statics.getNextRoundNumber = async function () {
  const lastRound = await this.findOne().sort({ roundNumber: -1 });
  return lastRound ? lastRound.roundNumber + 1 : 1;
};

module.exports = mongoose.model('GameRound', gameRoundSchema);


