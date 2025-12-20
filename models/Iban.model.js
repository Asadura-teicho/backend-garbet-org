const mongoose = require('mongoose');

const { Schema } = mongoose;

const ibanSchema = new Schema(
  {
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    accountHolder: {
      type: String,
      required: true,
      trim: true,
    },
    ibanNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', // admin user who added it (optional)
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
// Note: ibanNumber already has unique index from unique: true
ibanSchema.index({ isActive: 1 });

module.exports = mongoose.model('Iban', ibanSchema);

