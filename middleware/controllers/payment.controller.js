const mongoose = require('mongoose');

const DepositRequest = require('../models/DepositRequest.model');
const WithdrawalRequest = require('../models/WithdrawalRequest.model');
const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const Iban = require('../models/Iban.model');

function isTrue(value) {
  return String(value).toLowerCase() === 'true';
}

function getUserId(req) {
  return req.user?.id || req.user?._id;
}
exports.getIbanInfo = async (req, res) => {
  try {
    const minAmount = parseFloat(process.env.MIN_DEPOSIT || 100);
    const maxAmount = parseFloat(process.env.MAX_DEPOSIT || 50000);

    const activeIbans = await Iban.find({ isActive: true })
      .select('bankName accountHolder ibanNumber')
      .sort({ createdAt: -1 })
      .lean();

    const fallback = {
      iban: process.env.COMPANY_IBAN || 'TR330006100519786457841326',
      bankName: process.env.COMPANY_BANK_NAME || 'Example Bank',
      accountHolder: process.env.COMPANY_ACCOUNT_HOLDER || 'Garbet',
      branchCode: process.env.COMPANY_BRANCH_CODE || null,
      instructions: [
        'Lütfen yatırmak istediğiniz tutarı yukarıdaki IBAN numarasına havale/EFT yapın.',
        'İşlemi tamamladıktan sonra yatırım talebi oluşturun.',
        'Talebiniz onaylandıktan sonra bakiyenize yansır.',
      ],
      minAmount,
      maxAmount,
    };

    return res.json({
      ibanInfo: fallback,
      ibans: activeIbans.map((i) => ({
        bankName: i.bankName,
        accountHolder: i.accountHolder,
        ibanNumber: i.ibanNumber,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get deposit methods
// @route   GET /api/payment/deposit-methods
// @access  Private
// -------------------------------------------
exports.getDepositMethods = async (req, res) => {
  try {
    const minDeposit = parseFloat(process.env.MIN_DEPOSIT || 100);
    const maxDeposit = parseFloat(process.env.MAX_DEPOSIT || 50000);

    // These images are optional, but the current UI renders <img src={method.image}>
    // so we provide URLs to avoid broken images.
    const methods = [
      {
        id: 'iban',
        name: 'Banka Havalesi / EFT',
        nameEn: 'Bank Transfer / EFT',
        min: `₺${minDeposit.toLocaleString('tr-TR')}`,
        max: `₺${maxDeposit.toLocaleString('tr-TR')}`,
        available: true,
        image:
          'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',
      },
      {
        id: 'papara',
        name: 'Papara',
        min: '₺60',
        max: '₺25,000',
        available: true,
        image:
          'https://logowik.com/content/uploads/images/papara6313.jpg',
      },
      {
        id: 'credit_card',
        name: 'Kredi Kartı',
        nameEn: 'Credit Card',
        min: '₺75',
        max: '₺10,000',
        available: true,
        image:
          'https://cdn-icons-png.flaticon.com/512/349/349221.png',
      },
    ];

    return res.json({ methods });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Create IBAN deposit request
// @route   POST /api/payment/iban-deposit
// @access  Private
// -------------------------------------------https://upload.wikimedia.org/wikipedia/commons/7/7a/Papara_logo.png
exports.createIbanDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserId(req);
    const {
      amount,
      description,
      transactionId, // optional
      transactionReference, // optional
      screenshotUrl, // optional
      slipImage, // optional
    } = req.body;

    const amountNum = parseFloat(amount);

    if (!amount || Number.isNaN(amountNum) || amountNum <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const minDeposit = parseFloat(process.env.MIN_DEPOSIT || 100);
    const maxDeposit = parseFloat(process.env.MAX_DEPOSIT || 50000);

    if (amountNum < minDeposit) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: `Minimum yatırım tutarı ₺${minDeposit}` });
    }

    if (amountNum > maxDeposit) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: `Maksimum yatırım tutarı ₺${maxDeposit}` });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // Default behavior for this project:
    // - Always create a deposit request record
    // - In development, auto-approve (so balance actually updates for dev/testing)
    const autoApproveDefault = process.env.NODE_ENV !== 'production';
    const autoApprove =
      process.env.DEV_AUTO_APPROVE_IBAN_DEPOSITS !== undefined
        ? isTrue(process.env.DEV_AUTO_APPROVE_IBAN_DEPOSITS)
        : autoApproveDefault;

    const depositRequest = await DepositRequest.create(
      [
        {
          user: userId,
          amount: amountNum,
          paymentMethod: 'iban',
          description: description || 'IBAN Havale/EFT',
          transactionReference: transactionReference || transactionId || null,
          slipImage: slipImage || screenshotUrl || null,
          status: autoApprove ? 'approved' : 'pending',
          approvedAt: autoApprove ? new Date() : null,
          adminNotes: autoApprove ? 'Auto-approved in development' : null,
        },
      ],
      { session }
    );

    let transaction = null;

    if (autoApprove) {
      // Credit the balance immediately for development
      user.balance = (user.balance || 0) + amountNum;
      user.totalDeposits = (user.totalDeposits || 0) + amountNum;
      await user.save({ session });

      const createdTx = await Transaction.create(
        [
          {
            user: userId,
            type: 'deposit',
            amount: amountNum,
            status: 'completed',
            paymentMethod: 'bank_transfer',
            description: 'IBAN deposit (auto-approved)',
            metadata: {
              depositRequestId: depositRequest[0]._id,
              autoApproved: true,
            },
          },
        ],
        { session }
      );

      transaction = createdTx[0];
    }

    await session.commitTransaction();

    return res.status(201).json({
      message: autoApprove
        ? 'Deposit approved and added to balance (development mode)'
        : 'Deposit request submitted. It will be credited after approval.',
      depositRequest: depositRequest[0],
      newBalance: autoApprove ? user.balance : undefined,
      transaction,
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Get user's deposit requests
// @route   GET /api/payment/deposit-requests
// @access  Private
// -------------------------------------------
exports.getMyDepositRequests = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status, limit = 50, page = 1 } = req.query;

    const query = { user: userId };
    if (status) {
      const s = String(status);
      query.status = { $in: [s, s.toLowerCase(), s.toUpperCase()] };
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;

    const depositRequests = await DepositRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    const total = await DepositRequest.countDocuments(query);

    return res.json({
      depositRequests,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Create IBAN withdrawal request
// @route   POST /api/payment/withdrawal/request
// @access  Private
// -------------------------------------------
exports.createWithdrawalRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserId(req);
    const { amount, description } = req.body;

    const amountNum = parseFloat(amount);

    if (!amount || Number.isNaN(amountNum) || amountNum <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const minWithdraw = parseFloat(process.env.MIN_WITHDRAWAL || 100);
    const maxWithdraw = parseFloat(process.env.MAX_WITHDRAWAL || 50000);

    if (amountNum < minWithdraw) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: `Minimum çekim tutarı ₺${minWithdraw}` });
    }

    if (amountNum > maxWithdraw) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: `Maksimum çekim tutarı ₺${maxWithdraw}` });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.iban || !user.ibanHolderName) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Lütfen önce IBAN bilgilerinizi profilinizden kaydedin.',
      });
    }

    if ((user.balance || 0) < amountNum) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Yetersiz bakiye' });
    }

    // Reserve money immediately (so user sees balance change right away)
    user.balance = (user.balance || 0) - amountNum;
    await user.save({ session });

    const withdrawalRequest = await WithdrawalRequest.create(
      [
        {
          user: userId,
          amount: amountNum,
          iban: user.iban,
          ibanHolderName: user.ibanHolderName,
          bankName: user.bankName || null,
          description: description || 'IBAN Çekim Talebi',
          paymentMethod: 'iban',
          status: 'pending',
        },
      ],
      { session }
    );

    const transaction = await Transaction.create(
      [
        {
          user: userId,
          type: 'withdrawal',
          amount: amountNum,
          status: 'pending',
          paymentMethod: 'bank_transfer',
          description: `Withdrawal request created (ID: ${withdrawalRequest[0]._id})`,
          transactionId: `WD-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          metadata: {
            withdrawalRequestId: withdrawalRequest[0]._id,
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      message:
        "Çekim talebi oluşturuldu. Admin onayından sonra IBAN'ınıza gönderilecektir.",
      withdrawalRequest: withdrawalRequest[0],
      newBalance: user.balance,
      transaction: transaction[0],
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Get user's withdrawal requests
// @route   GET /api/payment/withdrawal-requests
// @access  Private
// -------------------------------------------
exports.getMyWithdrawalRequests = async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status, limit = 50, page = 1 } = req.query;

    const query = { user: userId };
    if (status) query.status = status;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;

    const withdrawalRequests = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .select('-adminNotes -rejectionReason')
      .lean();

    const total = await WithdrawalRequest.countDocuments(query);

    return res.json({
      withdrawalRequests,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      total,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Cancel withdrawal request (pending only)
// @route   POST /api/payment/withdrawal/:id/cancel
// @access  Private
// -------------------------------------------
exports.cancelWithdrawalRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const withdrawalRequest = await WithdrawalRequest.findOne({
      _id: id,
      user: userId,
    }).session(session);

    if (!withdrawalRequest) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Çekim talebi bulunamadı' });
    }

    if (withdrawalRequest.status !== 'pending') {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'Sadece beklemede olan çekim talepleri iptal edilebilir.',
      });
    }

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'User not found' });
    }

    // Refund reserved balance
    user.balance = (user.balance || 0) + withdrawalRequest.amount;
    await user.save({ session });

    withdrawalRequest.status = 'cancelled';
    withdrawalRequest.cancelledAt = new Date();
    await withdrawalRequest.save({ session });

    const tx = await Transaction.findOne({
      user: userId,
      'metadata.withdrawalRequestId': withdrawalRequest._id,
    }).session(session);

    if (tx) {
      tx.status = 'cancelled';
      tx.description = 'Withdrawal cancelled by user';
      await tx.save({ session });
    }

    await session.commitTransaction();

    return res.json({
      message: 'Çekim talebi iptal edildi ve bakiye geri yüklendi',
      withdrawalRequest,
      newBalance: user.balance,
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Update user profile (for saving IBAN)
// @route   PUT /api/payment/profile
// @access  Private
// -------------------------------------------
exports.updateProfile = async (req, res) => {
  try {
    const userId = getUserId(req);
    const {
      iban,
      ibanHolderName,
      bankName,
      phone,
      firstName,
      lastName,
    } = req.body;

    const allowedFields = {
      iban,
      ibanHolderName,
      bankName,
      phone,
      firstName,
      lastName,
    };

    Object.keys(allowedFields).forEach((key) => {
      if (allowedFields[key] === undefined) delete allowedFields[key];
    });

    if (
      allowedFields.iban &&
      !/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(
        String(allowedFields.iban).replace(/\s/g, '')
      )
    ) {
      return res.status(400).json({ message: 'Geçersiz IBAN formatı' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: allowedFields },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      message: 'Profil güncellendi',
      user,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
