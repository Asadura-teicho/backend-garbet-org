const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    gameType: {
      type: String,
      enum: ['slots', 'live_casino', 'sports', 'crash', 'all'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['upcoming', 'active', 'finished', 'cancelled'],
      default: 'upcoming',
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    registrationStartDate: {
      type: Date,
      default: null,
    },
    registrationEndDate: {
      type: Date,
      default: null,
    },
    // Prize structure
    prizePool: {
      type: Number,
      required: true,
      min: 0,
    },
    prizeDistribution: [
      {
        rank: {
          type: Number,
          required: true,
        },
        prize: {
          type: Number,
          required: true,
          min: 0,
        },
        percentage: {
          type: Number,
          default: 0,
        },
      },
    ],
    // Entry requirements
    entryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    minPlayers: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxPlayers: {
      type: Number,
      default: null, // null = unlimited
    },
    // Scoring rules
    scoringType: {
      type: String,
      enum: ['points', 'winnings', 'turnover', 'custom'],
      default: 'points',
    },
    scoringRules: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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
    // Tracking
    totalParticipants: {
      type: Number,
      default: 0,
    },
    totalPrizeDistributed: {
      type: Number,
      default: 0,
    },
    // Eligibility
    eligibleUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    excludedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
tournamentSchema.index({ status: 1, startDate: 1, endDate: 1 });
tournamentSchema.index({ gameType: 1, status: 1 });
tournamentSchema.index({ isFeatured: 1, status: 1 });
tournamentSchema.index({ startDate: 1, endDate: 1 });

// Virtual for checking if tournament is currently active
tournamentSchema.virtual('isActive').get(function () {
  const now = new Date();
  return (
    this.status === 'active' &&
    this.startDate <= now &&
    this.endDate >= now
  );
});

// Virtual for checking if registration is open
tournamentSchema.virtual('isRegistrationOpen').get(function () {
  const now = new Date();
  if (this.status !== 'upcoming' && this.status !== 'active') {
    return false;
  }
  if (this.registrationStartDate && this.registrationStartDate > now) {
    return false;
  }
  if (this.registrationEndDate && this.registrationEndDate < now) {
    return false;
  }
  if (this.maxPlayers && this.totalParticipants >= this.maxPlayers) {
    return false;
  }
  return true;
});

module.exports = mongoose.model('Tournament', tournamentSchema);
