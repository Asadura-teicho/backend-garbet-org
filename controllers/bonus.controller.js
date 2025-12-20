const Bonus = require('../models/Bonus.model');
const User = require('../models/User.model');
const DepositRequest = require('../models/DepositRequest.model');
const Match = require('../models/Match.model');
const Bet = require('../models/Bet.model');
const Transaction = require('../models/Transaction.model');
const mongoose = require('mongoose');

// Get bonus settings from environment or defaults
const getBonusSettings = () => {
  return {
    depositBonusPercent: parseFloat(process.env.DEPOSIT_BONUS_PERCENT || 20),
    lossBonusPercent: parseFloat(process.env.LOSS_BONUS_PERCENT || 20),
    rolloverMultiplier: parseFloat(process.env.ROLLOVER_MULTIPLIER || 10), // Changed from 5 to 10 for investment bonus
    bonusEnabled: process.env.BONUS_ENABLED !== 'false',
  };
};

// -------------------------------------------
// @desc    Create deposit bonus when deposit is approved
// @route   Internal (called from deposit approval)
// @access  Internal
// -------------------------------------------
exports.createDepositBonus = async (userId, depositAmount, depositRequestId, session) => {
  try {
    const settings = getBonusSettings();

    if (!settings.bonusEnabled) {
      return null;
    }

    // Calculate bonus amount (20% of deposit)
    const bonusAmount = (depositAmount * settings.depositBonusPercent) / 100;

    if (bonusAmount <= 0) {
      return null;
    }

    // Calculate required turnover (10× the bonus amount for investment bonus)
    const requiredTurnover = bonusAmount * settings.rolloverMultiplier;

    // Get user
    const user = await User.findById(userId).session(session);
    if (!user) {
      return null;
    }

    // Create bonus
    const bonus = await Bonus.create(
      [
        {
          user: userId,
          type: 'deposit_bonus',
          amount: bonusAmount,
          originalAmount: bonusAmount,
          principalAmount: depositAmount,
          requiredTurnover,
          relatedDepositRequest: depositRequestId,
          status: 'active',
          createdBy: 'system',
        },
      ],
      { session }
    );

    // Add bonus to user's bonus balance
    user.bonusBalance += bonusAmount;
    await user.save({ session });

    return bonus[0];
  } catch (error) {
    console.error('Error creating deposit bonus:', error);
    return null;
  }
};

// -------------------------------------------
// @desc    Calculate and create loss bonus
// @route   Internal (called when needed)
// @access  Internal
// -------------------------------------------
exports.calculateLossBonus = async (userId, period = 'daily') => {
  try {
    const settings = getBonusSettings();

    if (!settings.bonusEnabled) {
      return null;
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate;
    if (period === 'daily') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (period === 'weekly') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (period === 'monthly') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    // Get all bets for the period
    const bets = await Bet.find({
      user: userId,
      status: { $in: ['won', 'lost'] },
      settledAt: { $gte: startDate },
    });

    // Calculate net loss
    let totalStakes = 0;
    let totalWins = 0;

    bets.forEach((bet) => {
      totalStakes += bet.stake;
      if (bet.status === 'won') {
        totalWins += bet.winAmount;
      }
    });

    const netLoss = totalStakes - totalWins;

    if (netLoss <= 0) {
      return null; // No loss, no bonus
    }

    // Calculate loss bonus (20% of net loss)
    const lossBonusAmount = (netLoss * settings.lossBonusPercent) / 100;

    if (lossBonusAmount <= 0) {
      return null;
    }

    // Calculate required turnover (10× the bonus amount)
    const requiredTurnover = lossBonusAmount * settings.rolloverMultiplier;

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return null;
    }

    // Create bonus
    const bonus = await Bonus.create({
      user: userId,
      type: 'loss_bonus',
      amount: lossBonusAmount,
      originalAmount: lossBonusAmount,
      principalAmount: 0, // Loss bonus doesn't have principal
      requiredTurnover,
      status: 'active',
      createdBy: 'system',
    });

    // Add bonus to user's bonus balance
    user.bonusBalance += lossBonusAmount;
    await user.save();

    return bonus;
  } catch (error) {
    console.error('Error calculating loss bonus:', error);
    return null;
  }
};

// -------------------------------------------
// @desc    Update bonus turnover when bet is placed
// @route   Internal (called from bet placement)
// @access  Internal
// -------------------------------------------
exports.updateBonusTurnover = async (userId, betAmount, usedBonusAmount, session) => {
  try {
    if (usedBonusAmount <= 0) {
      return;
    }

    // Get all active bonuses for this user
    const bonuses = await Bonus.find({
      user: userId,
      status: 'active',
    }).session(session);

    // Distribute turnover proportionally based on bonus usage
    for (const bonus of bonuses) {
      // Calculate how much of this bet contributes to this bonus's turnover
      const contribution = (usedBonusAmount / betAmount) * betAmount; // Full bet amount counts as turnover

      bonus.turnover += contribution;
      bonus.usedAmount += usedBonusAmount;

      // Check if bonus can be unlocked
      await checkAndUnlockBonus(bonus, userId, session);

      await bonus.save({ session });
    }
  } catch (error) {
    console.error('Error updating bonus turnover:', error);
  }
};

// -------------------------------------------
// @desc    Check and unlock bonus if conditions are met
// @route   Internal
// @access  Internal
// -------------------------------------------
const checkAndUnlockBonus = async (bonus, userId, session) => {
  try {
    // Check if bonus is already fully unlocked
    if (bonus.status === 'unlocked' || bonus.unlockedAmount >= bonus.originalAmount) {
      return;
    }

    // Condition 1: Principal must be lost (for deposit bonuses)
    let principalLost = false;
    if (bonus.type === 'deposit_bonus' && bonus.principalAmount > 0) {
      // Check if user's main balance is less than the principal amount
      const user = await User.findById(userId).session(session);
      if (user && user.balance < bonus.principalAmount) {
        principalLost = true;
        bonus.principalLost = true;
      }
    } else if (bonus.type === 'loss_bonus') {
      // Loss bonuses don't require principal loss
      principalLost = true;
    }

    // Condition 2: Turnover must be at least 10× the bonus amount (investment bonus requirement)
    const turnoverMet = bonus.turnover >= bonus.requiredTurnover;

    // If both conditions are met, unlock the bonus
    if (principalLost && turnoverMet) {
      const unlockableAmount = bonus.originalAmount - bonus.unlockedAmount;

      if (unlockableAmount > 0) {
        bonus.unlockedAmount += unlockableAmount;
        bonus.isUnlocked += unlockableAmount;
        bonus.unlockedAt = new Date();

        // Move unlocked amount from bonus balance to main balance
        const user = await User.findById(userId).session(session);
        if (user) {
          user.bonusBalance -= unlockableAmount;
          user.balance += unlockableAmount;
          await user.save({ session });

          // Create transaction
          await Transaction.create(
            [
              {
                user: userId,
                type: 'win',
                amount: unlockableAmount,
                status: 'completed',
                paymentMethod: 'internal',
                description: `Bonus Unlock - ${bonus.type === 'deposit_bonus' ? 'Deposit Bonus' : 'Loss Bonus'}`,
                transactionId: `BONUS-UNLOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                metadata: {
                  bonusId: bonus._id,
                  bonusType: bonus.type,
                },
              },
            ],
            { session }
          );
        }

        // If fully unlocked, mark as unlocked
        if (bonus.unlockedAmount >= bonus.originalAmount) {
          bonus.status = 'unlocked';
        }
      }
    }
  } catch (error) {
    console.error('Error checking bonus unlock:', error);
  }
};

// -------------------------------------------
// @desc    Get user's active bonuses
// @route   GET /api/bonus/my-bonuses
// @access  Private
// -------------------------------------------
exports.getMyBonuses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const query = { user: userId };
    if (status) {
      query.status = status;
    }

    const bonuses = await Bonus.find(query)
      .populate('relatedDepositRequest', 'amount')
      .populate('relatedMatch', 'matchName')
      .sort({ createdAt: -1 });

    // Calculate progress for each bonus
    const bonusesWithProgress = bonuses.map((bonus) => {
      const progressPercent = bonus.requiredTurnover > 0
        ? Math.min((bonus.turnover / bonus.requiredTurnover) * 100, 100)
        : 0;

      return {
        ...bonus.toObject(),
        progressPercent: Math.round(progressPercent * 100) / 100,
        remainingTurnover: Math.max(0, bonus.requiredTurnover - bonus.turnover),
      };
    });

    res.json({
      bonuses: bonusesWithProgress,
      total: bonuses.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Check and unlock bonuses (manual trigger)
// @route   POST /api/bonus/check-rollover
// @access  Private
// -------------------------------------------
exports.checkRollover = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;

    // Get all active bonuses
    const bonuses = await Bonus.find({
      user: userId,
      status: 'active',
    }).session(session);

    let unlockedCount = 0;
    let unlockedAmount = 0;

    for (const bonus of bonuses) {
      const beforeUnlocked = bonus.unlockedAmount;
      await checkAndUnlockBonus(bonus, userId, session);
      await bonus.save({ session });

      if (bonus.unlockedAmount > beforeUnlocked) {
        unlockedCount++;
        unlockedAmount += bonus.unlockedAmount - beforeUnlocked;
      }
    }

    await session.commitTransaction();

    res.json({
      message: unlockedCount > 0
        ? `${unlockedCount} bonus kontrol edildi ve ${unlockedAmount} TL unlock edildi`
        : 'Unlock edilebilir bonus yok',
      unlockedCount,
      unlockedAmount,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

// -------------------------------------------
// @desc    Get bonus settings (Admin)
// @route   GET /api/admin/bonus/settings
// @access  Private (Admin only)
// -------------------------------------------
exports.getBonusSettings = async (req, res) => {
  try {
    const settings = getBonusSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get all bonuses (Admin)
// @route   GET /api/admin/bonus
// @access  Private (Admin only)
// -------------------------------------------
exports.getAllBonuses = async (req, res) => {
  try {
    const { userId, type, status, limit = 50, page = 1 } = req.query;

    const query = {};
    if (userId) query.user = userId;
    if (type) query.type = type;
    if (status) query.status = status;

    const bonuses = await Bonus.find(query)
      .populate('user', 'username firstName lastName email')
      .populate('relatedDepositRequest', 'amount')
      .populate('relatedMatch', 'matchName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bonus.countDocuments(query);

    res.json({
      bonuses,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

