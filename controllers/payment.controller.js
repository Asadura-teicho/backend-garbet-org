// const DepositRequest = require('../models/DepositRequest.model');
// const WithdrawalRequest = require('../models/WithdrawalRequest.model');
// const User = require('../models/User.model');
// const Transaction = require('../models/Transaction.model');
// const mongoose = require('mongoose');

// // -------------------------------------------
// // @desc    Get IBAN information
// // @route   GET /api/payment/iban-info
// // @access  Private
// // -------------------------------------------
// exports.getIbanInfo = async (req, res) => {
//   try {
//     // In production, this should come from environment variables or settings
//     const ibanInfo = {
//       iban: process.env.COMPANY_IBAN || 'TR330006100519786457841326',
//       bankName: process.env.COMPANY_BANK_NAME || 'Example Bank',
//       accountHolder: process.env.COMPANY_ACCOUNT_HOLDER || 'Garbet',
//       branchCode: process.env.COMPANY_BRANCH_CODE || '0061',
//       instructions: [
//         'Lütfen yatırmak istediğiniz tutarı yukarıdaki IBAN numarasına havale/EFT yapın.',
//         'İşlemi tamamladıktan sonra "Ödeme Yaptım" butonuna tıklayın.',
//         'Yatırım talebiniz admin onayından sonra hesabınıza yansıyacaktır.',
//         'İşlem genellikle 1-2 saat içinde tamamlanır.',
//       ],
//       minAmount: parseFloat(process.env.MIN_DEPOSIT || 100),
//       maxAmount: parseFloat(process.env.MAX_DEPOSIT || 50000),
//     };

//     res.json(ibanInfo);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// // -------------------------------------------
// // @desc    Create IBAN deposit request
// // @route   POST /api/payment/iban-deposit
// // @access  Private
// // -------------------------------------------
// exports.createIbanDeposit = async (req, res) => {
//   try {
//     const { amount, description } = req.body;
//     const userId = req.user.id;

//     // Validate amount
//     if (!amount || amount <= 0) {
//       return res.status(400).json({ message: 'Geçersiz tutar' });
//     }

//     // Check global limits
//     const minDeposit = parseFloat(process.env.MIN_DEPOSIT || 100);
//     const maxDeposit = parseFloat(process.env.MAX_DEPOSIT || 50000);

//     if (amount < minDeposit) {
//       return res.status(400).json({
//         message: `Minimum yatırım tutarı ₺${minDeposit}`,
//       });
//     }

//     if (amount > maxDeposit) {
//       return res.status(400).json({
//         message: `Maksimum yatırım tutarı ₺${maxDeposit}`,
//       });
//     }

//     // Check user's daily deposit limit
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
//     }

//     if (user.dailyDepositLimit && amount > user.dailyDepositLimit) {
//       return res.status(400).json({
//         message: `Günlük yatırım limitiniz ₺${user.dailyDepositLimit}`,
//       });
//     }

//     // Check if user has pending deposits (optional: limit concurrent requests)
//     const pendingCount = await DepositRequest.countDocuments({
//       user: userId,
//       status: 'pending',
//     });

//     if (pendingCount >= 5) {
//       return res.status(400).json({
//         message: 'Bekleyen yatırım talebiniz var. Lütfen onay bekleyin.',
//       });
//     }

//     // Get user's IBAN if saved
//     const userIban = user.iban || null;
//     const userBankName = user.bankName || null;

//     // Create deposit request
//     const depositRequest = await DepositRequest.create({
//       user: userId,
//       amount,
//       description: description || 'IBAN Havale/EFT',
//       paymentMethod: 'iban',
//       iban: userIban,
//       bankName: userBankName,
//       status: 'pending',
//     });

//     res.status(201).json({
//       message: 'Yatırım talebi oluşturuldu. Admin onayından sonra hesabınıza yansıyacaktır.',
//       depositRequest: {
//         id: depositRequest._id,
//         amount: depositRequest.amount,
//         status: depositRequest.status,
//         createdAt: depositRequest.createdAt,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// // -------------------------------------------
// // @desc    Get user's deposit requests
// // @route   GET /api/payment/deposit-requests
// // @access  Private
// // -------------------------------------------
// exports.getMyDepositRequests = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { status, limit = 50, page = 1 } = req.query;

//     const query = { user: userId };
//     if (status) query.status = status;

//     const depositRequests = await DepositRequest.find(query)
//       .sort({ createdAt: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit)
//       .select('-adminNotes');

//     const total = await DepositRequest.countDocuments(query);

//     res.json({
//       depositRequests,
//       totalPages: Math.ceil(total / limit),
//       currentPage: page,
//       total,
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// // -------------------------------------------
// // @desc    Get deposit methods
// // @route   GET /api/payment/deposit-methods
// // @access  Private
// // -------------------------------------------
// exports.getDepositMethods = async (req, res) => {
//   try {
//     const methods = [
//       {
//         id: 'iban',
//         name: 'Banka Havalesi / EFT',
//         nameEn: 'Bank Transfer / EFT',
//         min: parseFloat(process.env.MIN_DEPOSIT || 100),
//         max: parseFloat(process.env.MAX_DEPOSIT || 50000),
//         available: true,
//       },
//       {
//         id: 'credit_card',
//         name: 'Kredi Kartı',
//         nameEn: 'Credit Card',
//         min: 75,
//         max: 10000,
//         available: true,
//       },
//       {
//         id: 'papara',
//         name: 'Papara',
//         min: 50,
//         max: 25000,
//         available: true,
//       },
//     ];

//     res.json({ methods });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// // -------------------------------------------
// // @desc    Create IBAN withdrawal request
// // @route   POST /api/payment/withdrawal/request
// // @access  Private
// // -------------------------------------------
// exports.createWithdrawalRequest = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { amount, description } = req.body;
//     const userId = req.user.id;

//     // Validate amount
//     if (!amount || amount <= 0) {
//       await session.abortTransaction();
//       return res.status(400).json({ message: 'Geçersiz tutar' });
//     }

//     // Check global limits
//     const minWithdraw = parseFloat(process.env.MIN_WITHDRAWAL || 100);
//     const maxWithdraw = parseFloat(process.env.MAX_WITHDRAWAL || 50000);

//     if (amount < minWithdraw) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         message: `Minimum çekim tutarı ₺${minWithdraw}`,
//       });
//     }

//     if (amount > maxWithdraw) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         message: `Maksimum çekim tutarı ₺${maxWithdraw}`,
//       });
//     }

//     // Get user
//     const user = await User.findById(userId).session(session);
//     if (!user) {
//       await session.abortTransaction();
//       return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
//     }

//     // Check if user has IBAN saved
//     if (!user.iban || !user.ibanHolderName) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         message: 'Lütfen önce IBAN bilgilerinizi profilinizden kaydedin.',
//       });
//     }

//     // Check user balance (including bonus balance for available balance calculation)
//     const availableBalance = user.balance; // Only main balance can be withdrawn
//     if (availableBalance < amount) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         message: 'Yetersiz bakiye',
//         availableBalance,
//       });
//     }

//     // Check user's daily withdrawal limit
//     if (user.dailyWithdrawLimit && amount > user.dailyWithdrawLimit) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         message: `Günlük çekim limitiniz ₺${user.dailyWithdrawLimit}`,
//       });
//     }

//     // Check if user has pending withdrawals (optional: limit concurrent requests)
//     const pendingCount = await WithdrawalRequest.countDocuments({
//       user: userId,
//       status: { $in: ['pending', 'approved'] },
//     }).session(session);

//     if (pendingCount >= 5) {
//       await session.abortTransaction();
//       return res.status(400).json({
//         message: 'Bekleyen çekim talebiniz var. Lütfen onay bekleyin.',
//       });
//     }

//     // Check if user is self-excluded or banned
//     if (user.status === 'self_excluded' || user.status === 'banned') {
//       await session.abortTransaction();
//       return res.status(403).json({
//         message: 'Hesabınız çekim yapamaz durumda.',
//       });
//     }

//     // Reserve the amount by deducting from balance
//     user.balance -= amount;
//     await user.save({ session });

//     // Create withdrawal request
//     const withdrawalRequest = await WithdrawalRequest.create(
//       [
//         {
//           user: userId,
//           amount,
//           iban: user.iban,
//           ibanHolderName: user.ibanHolderName,
//           bankName: user.bankName,
//           description: description || 'IBAN Çekim Talebi',
//           paymentMethod: 'iban',
//           status: 'pending',
//         },
//       ],
//       { session }
//     );

//     // Create pending transaction record
//     const transaction = await Transaction.create(
//       [
//         {
//           user: userId,
//           type: 'withdrawal',
//           amount,
//           status: 'pending',
//           paymentMethod: 'bank_transfer',
//           description: `IBAN Çekim Talebi - Beklemede (ID: ${withdrawalRequest[0]._id})`,
//           transactionId: `WD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
//           metadata: {
//             withdrawalRequestId: withdrawalRequest[0]._id,
//           },
//         },
//       ],
//       { session }
//     );

//     await session.commitTransaction();

//     res.status(201).json({
//       message: 'Çekim talebi oluşturuldu. Admin onayından sonra IBAN\'ınıza gönderilecektir.',
//       withdrawalRequest: {
//         id: withdrawalRequest[0]._id,
//         amount: withdrawalRequest[0].amount,
//         iban: withdrawalRequest[0].iban,
//         status: withdrawalRequest[0].status,
//         createdAt: withdrawalRequest[0].createdAt,
//       },
//       newBalance: user.balance,
//       transaction: transaction[0],
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     res.status(500).json({ message: error.message });
//   } finally {
//     session.endSession();
//   }
// };

// // -------------------------------------------
// // @desc    Get user's withdrawal requests
// // @route   GET /api/payment/withdrawal-requests
// // @access  Private
// // -------------------------------------------
// exports.getMyWithdrawalRequests = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { status, limit = 50, page = 1 } = req.query;

//     const query = { user: userId };
//     if (status) query.status = status;

//     const withdrawalRequests = await WithdrawalRequest.find(query)
//       .sort({ createdAt: -1 })
//       .limit(limit * 1)
//       .skip((page - 1) * limit)
//       .select('-adminNotes -rejectionReason');

//     const total = await WithdrawalRequest.countDocuments(query);

//     res.json({
//       withdrawalRequests,
//       totalPages: Math.ceil(total / limit),
//       currentPage: page,
//       total,
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// // -------------------------------------------
// // @desc    Cancel withdrawal request (user can cancel if pending)
// // @route   POST /api/payment/withdrawal/:id/cancel
// // @access  Private
// // -------------------------------------------
// exports.cancelWithdrawalRequest = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { id } = req.params;
//     const userId = req.user.id;

//     // Find withdrawal request
//     const withdrawalRequest = await WithdrawalRequest.findOne({
//       _id: id,
//       user: userId,
//     }).session(session);

//     if (!withdrawalRequest) {
//       await session.abortTransaction();
//       return res.status(404).json({ message: 'Çekim talebi bulunamadı' });
//     }

//     // Only allow cancellation if status is pending
//     if (withdrawalRequest.status !== 'pending') {
//       await session.abortTransaction();
//       return res.status(400).json({
//         message: `Bu çekim talebi ${withdrawalRequest.status === 'approved' ? 'onaylanmış' : withdrawalRequest.status === 'paid' ? 'ödenmiş' : 'iptal edilmiş'} durumda. İptal edilemez.`,
//       });
//     }

//     // Get user
//     const user = await User.findById(userId).session(session);
//     if (!user) {
//       await session.abortTransaction();
//       return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
//     }

//     // Refund the amount back to user balance
//     user.balance += withdrawalRequest.amount;
//     await user.save({ session });

//     // Update withdrawal request
//     withdrawalRequest.status = 'cancelled';
//     withdrawalRequest.cancelledAt = new Date();
//     await withdrawalRequest.save({ session });

//     // Update transaction status
//     const transaction = await Transaction.findOne({
//       user: userId,
//       'metadata.withdrawalRequestId': id,
//     }).session(session);

//     if (transaction) {
//       transaction.status = 'cancelled';
//       await transaction.save({ session });
//     }

//     await session.commitTransaction();

//     res.json({
//       message: 'Çekim talebi iptal edildi ve bakiye geri yüklendi',
//       withdrawalRequest: {
//         id: withdrawalRequest._id,
//         amount: withdrawalRequest.amount,
//         status: withdrawalRequest.status,
//       },
//       newBalance: user.balance,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     res.status(500).json({ message: error.message });
//   } finally {
//     session.endSession();
//   }
// };

// // -------------------------------------------
// // @desc    Update user profile (for saving IBAN)
// // @route   PUT /api/payment/profile
// // @access  Private
// // -------------------------------------------
// exports.updateProfile = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { iban, ibanHolderName, bankName, phone, firstName, lastName } = req.body;

//     // Allowed fields for user to update
//     const allowedFields = {
//       iban,
//       ibanHolderName,
//       bankName,
//       phone,
//       firstName,
//       lastName,
//     };

//     // Remove undefined fields
//     Object.keys(allowedFields).forEach((key) => {
//       if (allowedFields[key] === undefined) {
//         delete allowedFields[key];
//       }
//     });

//     // Validate IBAN format (basic validation)
//     if (iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(iban.replace(/\s/g, ''))) {
//       return res.status(400).json({
//         message: 'Geçersiz IBAN formatı',
//       });
//     }

//     const user = await User.findByIdAndUpdate(
//       userId,
//       { $set: allowedFields },
//       { new: true, runValidators: true }
//     ).select('-password -__v');

//     if (!user) {
//       return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
//     }

//     res.json({
//       message: 'Profil güncellendi',
//       user: {
//         id: user._id,
//         iban: user.iban,
//         ibanHolderName: user.ibanHolderName,
//         bankName: user.bankName,
//         phone: user.phone,
//         firstName: user.firstName,
//         lastName: user.lastName,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// controllers/payment.controller.js

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

// -------------------------------------------
// @desc    Get IBAN information (and optionally active IBANs)
// @route   GET /api/payment/iban-info
// @access  Private
// -------------------------------------------
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
        min: '₺50',
        max: '₺25,000',
        available: true,
        image:
          'https://upload.wikimedia.org/wikipedia/commons/7/7a/Papara_logo.png',
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
// -------------------------------------------
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
