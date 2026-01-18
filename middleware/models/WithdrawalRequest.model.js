const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'rejected', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['iban', 'havale', 'eft'],
      default: 'iban',
    },
    iban: {
      type: String,
      required: true,
    },
    ibanHolderName: {
      type: String,
      required: true,
    },
    bankName: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },
    adminNotes: {
      type: String,
      default: null, // Admin can add notes when approving/rejecting
    },
    rejectionReason: {
      type: String,
      default: null, // Reason for rejection
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
withdrawalRequestSchema.index({ user: 1, createdAt: -1 });
withdrawalRequestSchema.index({ status: 1, createdAt: -1 });
withdrawalRequestSchema.index({ iban: 1 });

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

