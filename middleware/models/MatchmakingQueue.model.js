const mongoose = require('mongoose');
const { Schema } = mongoose;

const matchmakingQueueSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      // Removed unique constraint - handled in code to allow cleanup of old entries
    },
    username: {
      type: String,
      required: true,
    },
    betAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['waiting', 'matched', 'expired'],
      default: 'waiting',
    },
    matchedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: function() {
        // Queue expires after 5 minutes
        return new Date(Date.now() + 5 * 60 * 1000);
      },
    },
  },
  { timestamps: true }
);

// Index for finding waiting players
matchmakingQueueSchema.index({ status: 1, expiresAt: 1 });
matchmakingQueueSchema.index({ user: 1 });

// Remove expired entries
matchmakingQueueSchema.pre('save', function(next) {
  if (this.expiresAt && new Date() > this.expiresAt && this.status === 'waiting') {
    this.status = 'expired';
  }
  next();
});

module.exports = mongoose.model('MatchmakingQueue', matchmakingQueueSchema);

