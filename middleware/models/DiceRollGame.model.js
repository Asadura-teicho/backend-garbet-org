const mongoose = require('mongoose');

const { Schema } = mongoose;

const diceRollGameSchema = new Schema(
  {
    gameNumber: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['waiting', 'matchmaking', 'accepting-bets', 'in-progress', 'waiting-for-admin', 'closed', 'completed', 'cancelled'],
      default: 'waiting',
      required: true,
    },
    gameType: {
      type: String,
      enum: ['player-vs-player', 'betting'],
      default: 'betting',
      required: true,
    },
    // For player vs player matches
    players: {
      player1: {
        user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        username: { type: String, default: null },
        diceRoll: { type: Number, min: 1, max: 6, default: null },
        betAmount: { type: Number, default: 0 },
      },
      player2: {
        user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        username: { type: String, default: null },
        diceRoll: { type: Number, min: 1, max: 6, default: null },
        betAmount: { type: Number, default: 0 },
      },
    },
    // Dice roll options - players can bet on different outcomes
    // For example: Player 1 (1-3), Player 2 (4-6), or specific numbers
    options: {
      player1: {
        name: { type: String, default: 'Player 1' },
        diceRange: { min: { type: Number, default: 1 }, max: { type: Number, default: 3 } },
        // Total bets and amount on this option
        totalBets: { type: Number, default: 0 },
        totalBetAmount: { type: Number, default: 0 },
        betCount: { type: Number, default: 0 },
      },
      player2: {
        name: { type: String, default: 'Player 2' },
        diceRange: { min: { type: Number, default: 4 }, max: { type: Number, default: 6 } },
        totalBets: { type: Number, default: 0 },
        totalBetAmount: { type: Number, default: 0 },
        betCount: { type: Number, default: 0 },
      },
    },
    // Admin-selected winner (can be changed)
    selectedWinner: {
      type: String,
      enum: ['player1', 'player2', null],
      default: null,
    },
    // Actual dice result (for display, but admin can override)
    diceResult: {
      type: Number,
      min: 1,
      max: 6,
      default: null,
    },
    // Admin can manually set the result
    adminSetResult: {
      type: Number,
      min: 1,
      max: 6,
      default: null,
    },
    // Payout multiplier for winners
    payoutMultiplier: {
      type: Number,
      default: 2.0, // 2x for winners
      min: 1.0,
    },
    // Total bets across all options
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
    // Total payout amount (calculated when winner is selected)
    totalPayout: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Admin profit (total bets - total payouts)
    adminProfit: {
      type: Number,
      default: 0,
    },
    // Timestamps
    startedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Admin who created/managed this game
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    winnerSelectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
// Note: gameNumber already has unique: true which creates an index, so we don't need to add it again
diceRollGameSchema.index({ status: 1 });
diceRollGameSchema.index({ createdAt: -1 });

// Static method to get next game number
diceRollGameSchema.statics.getNextGameNumber = async function () {
  const lastGame = await this.findOne().sort({ gameNumber: -1 });
  return lastGame ? lastGame.gameNumber + 1 : 1;
};

module.exports = mongoose.model('DiceRollGame', diceRollGameSchema);

