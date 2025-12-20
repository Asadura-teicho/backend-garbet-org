const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    username: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    profilePicture: { type: String, default: null }, // Stores filename of uploaded profile picture
    nationalId: { type: String, default: null },
    dateOfBirth: { type: Date },

    // Registration / Legal
    is18Plus: { type: Boolean, default: true },
    termsAccepted: { type: Boolean, default: true },
    kvkkAccepted: { type: Boolean, default: true },

    // Financials
    balance: { type: Number, default: 0, min: 0 },
    bonusBalance: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ['USD', 'EUR', 'TRY'], default: 'TRY' },

    // Banking
    iban: { type: String, default: null },
    bankName: { type: String, default: null },
    ibanHolderName: { type: String, default: null },

    // KYC Management
    kycStatus: {
      type: String,
      enum: ['not_submitted', 'pending', 'verified', 'rejected'],
      default: 'not_submitted',
    },
    kycDocuments: {
      idFront: { type: String, default: null },
      idBack: { type: String, default: null },
      addressProof: { type: String, default: null },
    },

    // User Access Control
    status: {
      type: String,
      enum: ['active', 'suspended', 'blocked', 'pending'],
      default: 'active',
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'super_admin', 'operator'],
      default: 'user',
    },

    // Account Metrics
    totalDeposits: { type: Number, default: 0 },
    totalWithdrawals: { type: Number, default: 0 },
    totalWinnings: { type: Number, default: 0 },
    dailyDepositLimit: { type: Number, default: null },
    dailyWithdrawLimit: { type: Number, default: null },

    // Security
    registrationCode: { type: String, select: false }, 
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

// -----------------------------
// CONFIRM PASSWORD VIRTUAL
// -----------------------------
userSchema.virtual('confirmPassword')
  .set(function (value) {
    this._confirmPassword = value;
  })
  .get(function () {
    return this._confirmPassword;
  });

// -----------------------------
// PASSWORD + ROLE VALIDATION & HASHING
// -----------------------------
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // If confirmPassword is provided (via virtual), validate it matches
  if (this._confirmPassword !== undefined) {
    if (this._confirmPassword !== this.password) {
      return next(new Error("Passwords do not match"));
    }
  }

  // Check if password is already hashed to avoid double hashing
  const bcryptHashRegex = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
  if (!bcryptHashRegex.test(this.password)) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  next();
});

// -----------------------------
// METHODS
// -----------------------------
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);