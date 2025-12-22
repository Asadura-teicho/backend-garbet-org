const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption.util');

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
    // Encrypted IBAN for secure storage
    ibanNumberEncrypted: {
      type: String,
      required: false,
    },
    // BIC/SWIFT code (optional)
    bicCode: {
      type: String,
      default: null,
      trim: true,
    },
    // Country code (extracted from IBAN)
    countryCode: {
      type: String,
      default: null,
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

// Encrypt IBAN before saving
ibanSchema.pre('save', function (next) {
  if (this.isModified('ibanNumber') && this.ibanNumber) {
    try {
      // Store encrypted version
      this.ibanNumberEncrypted = encrypt(this.ibanNumber);
      // Extract country code from IBAN (first 2 characters)
      if (this.ibanNumber.length >= 2) {
        this.countryCode = this.ibanNumber.substring(0, 2).toUpperCase();
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Virtual to get decrypted IBAN
ibanSchema.virtual('decryptedIban').get(function () {
  if (this.ibanNumberEncrypted) {
    try {
      return decrypt(this.ibanNumberEncrypted);
    } catch (error) {
      console.error('Error decrypting IBAN:', error);
      return this.ibanNumber; // Fallback to plain text if decryption fails
    }
  }
  return this.ibanNumber;
});

// Method to get decrypted IBAN
ibanSchema.methods.getDecryptedIban = function () {
  if (this.ibanNumberEncrypted) {
    try {
      return decrypt(this.ibanNumberEncrypted);
    } catch (error) {
      console.error('Error decrypting IBAN:', error);
      return this.ibanNumber;
    }
  }
  return this.ibanNumber;
};

// Indexes for faster queries
// Note: ibanNumber already has unique index from unique: true
ibanSchema.index({ isActive: 1 });

module.exports = mongoose.model('Iban', ibanSchema);

