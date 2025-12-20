const mongoose = require('mongoose');

const tournamentParticipantSchema = new mongoose.Schema(
  {
    tournament: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['registered', 'active', 'disqualified', 'completed', 'withdrawn'],
      default: 'registered',
      index: true,
    },
    // Scoring
    score: {
      type: Number,
      default: 0,
    },
    points: {
      type: Number,
      default: 0,
    },
    winnings: {
      type: Number,
      default: 0,
    },
    turnover: {
      type: Number,
      default: 0,
    },
    // Ranking
    rank: {
      type: Number,
      default: null,
    },
    finalRank: {
      type: Number,
      default: null,
    },
    // Prize
    prizeWon: {
      type: Number,
      default: 0,
    },
    prizePaid: {
      type: Boolean,
      default: false,
    },
    // Dates
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Metadata
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
tournamentParticipantSchema.index({ tournament: 1, user: 1 }, { unique: true });
tournamentParticipantSchema.index({ tournament: 1, status: 1 });
tournamentParticipantSchema.index({ tournament: 1, score: -1 });
tournamentParticipantSchema.index({ tournament: 1, points: -1 });
tournamentParticipantSchema.index({ tournament: 1, rank: 1 });
tournamentParticipantSchema.index({ user: 1, status: 1 });
tournamentParticipantSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('TournamentParticipant', tournamentParticipantSchema);
