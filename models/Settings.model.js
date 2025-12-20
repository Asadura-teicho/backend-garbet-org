const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    // Global Deposit Limits
    minDeposit: {
      type: Number,
      default: 100,
      min: 0,
    },
    maxDeposit: {
      type: Number,
      default: 50000,
      min: 0,
    },

    // Global Withdrawal Limits
    minWithdrawal: {
      type: Number,
      default: 100,
      min: 0,
    },
    maxWithdrawal: {
      type: Number,
      default: 50000,
      min: 0,
    },

    // Bonus Settings
    depositBonusPercent: {
      type: Number,
      default: 20,
      min: 0,
      max: 100,
    },
    lossBonusPercent: {
      type: Number,
      default: 20,
      min: 0,
      max: 100,
    },
    rolloverMultiplier: {
      type: Number,
      default: 5,
      min: 1,
    },
    bonusEnabled: {
      type: Boolean,
      default: true,
    },

    // Company Banking Info
    companyIban: {
      type: String,
      default: null,
    },
    companyBankName: {
      type: String,
      default: null,
    },
    companyAccountHolder: {
      type: String,
      default: null,
    },
    companyBranchCode: {
      type: String,
      default: null,
    },

    // Site Settings
    siteName: {
      type: String,
      default: 'Garbet',
    },
    siteLogo: {
      type: String,
      default: null,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      default: null,
    },

    // Other Settings
    currency: {
      type: String,
      enum: ['USD', 'EUR', 'TRY'],
      default: 'TRY',
    },
    timezone: {
      type: String,
      default: 'Europe/Istanbul',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);

