const mongoose = require('mongoose');

const gameCatalogSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    gameType: {
      type: String,
      enum: ['slots', 'live_casino', 'crash', 'sports', 'live_betting'],
      required: true,
    },
    gameId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    thumbnail: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance'],
      default: 'active',
    },
    description: {
      type: String,
      default: '',
    },
    minBet: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxBet: {
      type: Number,
      default: null,
      min: 0,
    },
    rtp: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    features: [{
      type: String,
    }],
    tags: [{
      type: String,
    }],
    isNew: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isHot: {
      type: Boolean,
      default: false,
    },
    // Statistics
    totalPlays: {
      type: Number,
      default: 0,
    },
    totalBets: {
      type: Number,
      default: 0,
    },
    totalWins: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
gameCatalogSchema.index({ gameType: 1, status: 1 });
gameCatalogSchema.index({ provider: 1 });
gameCatalogSchema.index({ status: 1 });
gameCatalogSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('GameCatalog', gameCatalogSchema);
