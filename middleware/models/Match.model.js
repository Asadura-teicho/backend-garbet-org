const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    // RapidAPI Integration
    rapidapiFixtureId: {
      type: Number,
      default: null,
      index: true,
    },
    rapidapiLeagueId: {
      type: Number,
      default: null,
    },
    
    // Match Information
    league: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: null, // e.g., "Football", "Basketball", "Tennis"
    },
    matchName: {
      type: String,
      required: true,
      trim: true,
    },
    teamA: {
      type: String,
      required: true,
      trim: true,
    },
    teamB: {
      type: String,
      required: true,
      trim: true,
    },
    matchDate: {
      type: Date,
      required: true,
    },
    matchTime: {
      type: String,
      default: null, // e.g., "20:00"
    },

    // Markets and Odds
    markets: [
      {
        type: {
          type: String,
          required: true,
          enum: ['1X2', 'over_under', 'both_teams_score', 'handicap', 'custom'],
        },
        name: {
          type: String,
          required: true, // e.g., "Match Winner", "Over/Under 2.5"
        },
        selections: [
          {
            name: {
              type: String,
              required: true, // e.g., "Team A Win", "Over 2.5"
            },
            odds: {
              type: Number,
              required: true,
              min: 1.0,
            },
            value: {
              type: String,
              default: null, // For over/under: "2.5", for handicap: "+1.5"
            },
          },
        ],
      },
    ],

    // Match Result
    result: {
      teamAScore: {
        type: Number,
        default: null,
      },
      teamBScore: {
        type: Number,
        default: null,
      },
      winner: {
        type: String,
        enum: ['teamA', 'teamB', 'draw', null],
        default: null,
      },
      isSettled: {
        type: Boolean,
        default: false,
      },
      settledAt: {
        type: Date,
        default: null,
      },
      settledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },

    // Bonus Settings
    bonusType: {
      type: String,
      enum: ['deposit_bonus', 'loss_bonus', null],
      default: null,
    },

    // Status
    status: {
      type: String,
      enum: ['upcoming', 'live', 'finished', 'cancelled'],
      default: 'upcoming',
    },

    // Admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
matchSchema.index({ matchDate: 1, status: 1 });
matchSchema.index({ league: 1 });
matchSchema.index({ status: 1 });
matchSchema.index({ 'result.isSettled': 1 });

module.exports = mongoose.model('Match', matchSchema);

