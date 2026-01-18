/**
 * Bet Round Service
 * Handles betting round calculations and balance updates
 */

const User = require('../models/User.model');
const BetRound = require('../models/BetRound.model');
const GameRound = require('../models/GameRound.model');
const Transaction = require('../models/Transaction.model');
const gameRoundService = require('./gameRound.service');
const mongoose = require('mongoose');

/**
 * Calculate round result based on percentage
 * @param {Number} percentage - The percentage change (e.g., -40, +5, -12)
 * @param {Number} betAmount - The amount bet
 * @returns {Object} - { resultType: 'win'|'loss'|'neutral', amountChange: Number }
 */
const calculateRoundResult = (percentage, betAmount) => {
  let resultType;
  let amountChange;

  if (percentage > 0) {
    // WIN: User wins, amountChange is positive
    resultType = 'win';
    amountChange = betAmount * (percentage / 100);
  } else if (percentage < 0) {
    // LOSS: User loses, amountChange is negative
    resultType = 'loss';
    amountChange = betAmount * (percentage / 100); // This will be negative
  } else {
    // NEUTRAL: No change
    resultType = 'neutral';
    amountChange = 0;
  }

  return {
    resultType,
    amountChange: parseFloat(amountChange.toFixed(2)),
  };
};

/**
 * Validate if user has sufficient balance for bet
 * @param {String} userId - User ID
 * @param {Number} betAmount - Amount to bet
 * @returns {Promise<Object>} - { isValid: Boolean, user: User, message: String }
 */
const validateBetAmount = async (userId, betAmount) => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return {
        isValid: false,
        user: null,
        message: 'User not found',
      };
    }

    // Check user status
    if (user.status !== 'active') {
      return {
        isValid: false,
        user,
        message: 'User account is not active',
      };
    }

    // Check minimum bet amount (can be configured)
    const minBetAmount = 1; // Minimum 1 unit
    if (betAmount < minBetAmount) {
      return {
        isValid: false,
        user,
        message: `Minimum bet amount is ${minBetAmount}`,
      };
    }

    // Check if user has sufficient balance
    const totalBalance = (user.balance || 0) + (user.bonusBalance || 0);
    if (totalBalance < betAmount) {
      return {
        isValid: false,
        user,
        message: 'Insufficient balance',
      };
    }

    return {
      isValid: true,
      user,
      message: 'Valid',
    };
  } catch (error) {
    return {
      isValid: false,
      user: null,
      message: error.message,
    };
  }
};

/**
 * Update user balance atomically
 * @param {String} userId - User ID
 * @param {Number} amountChange - Amount to add/subtract (can be negative)
 * @param {Object} session - MongoDB session for transaction
 * @returns {Promise<Object>} - { balanceBefore: Number, balanceAfter: Number, user: User }
 */
const updateUserBalance = async (userId, amountChange, session = null) => {
  try {
    const user = await User.findById(userId).session(session || null);
    
    if (!user) {
      throw new Error('User not found');
    }

    const balanceBefore = user.balance || 0;
    
    // Update balance
    user.balance = Math.max(0, (user.balance || 0) + amountChange);
    const balanceAfter = user.balance;

    if (session) {
      await user.save({ session });
    } else {
      await user.save();
    }

    return {
      balanceBefore,
      balanceAfter,
      user,
    };
  } catch (error) {
    throw new Error(`Failed to update user balance: ${error.message}`);
  }
};

/**
 * Process a betting round - main business logic
 * Now supports multiple bets per round via GameRound
 * @param {String} userId - User ID
 * @param {String|Number} gameRoundIdOrNumber - GameRound ID or round number (for backward compatibility)
 * @param {Number} betAmount - Amount to bet
 * @param {Number} percentage - Percentage change for this round (negative = loss, positive = win)
 * @returns {Promise<Object>} - BetRound document and transaction info
 */
const processBetRound = async (userId, gameRoundIdOrNumber, betAmount, percentage) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Step 1: Validate bet amount
    const validation = await validateBetAmount(userId, betAmount);
    if (!validation.isValid) {
      await session.abortTransaction();
      throw new Error(validation.message);
    }

    // Step 2: Get or find the GameRound
    let gameRound;
    if (typeof gameRoundIdOrNumber === 'string' && gameRoundIdOrNumber.match(/^[0-9a-fA-F]{24}$/)) {
      // It's a MongoDB ObjectId
      gameRound = await GameRound.findById(gameRoundIdOrNumber).session(session);
    } else {
      // It's a round number - find by roundNumber
      gameRound = await GameRound.findOne({ roundNumber: gameRoundIdOrNumber }).session(session);
    }

    if (!gameRound) {
      await session.abortTransaction();
      throw new Error(`Round not found. Please ensure a round is active.`);
    }

    // Step 3: Check if round is active (can accept bets)
    if (gameRound.status !== 'in-progress') {
      await session.abortTransaction();
      throw new Error(`Round #${gameRound.roundNumber} is ${gameRound.status}. Cannot place bets on inactive rounds.`);
    }

    const user = validation.user;
    const balanceBefore = user.balance || 0;

    // Step 4: Calculate round result
    const { resultType, amountChange } = calculateRoundResult(percentage, betAmount);

    // Step 5: Deduct bet amount from balance first
    await updateUserBalance(userId, -betAmount, session);
    
    // Step 6: Add the result (win/loss) to balance
    await updateUserBalance(userId, amountChange, session);

    // Step 7: Get final balance
    const updatedUser = await User.findById(userId).session(session);
    const balanceAfter = updatedUser.balance || 0;

    // Step 8: Create BetRound record (linked to GameRound)
    const betRound = await BetRound.create(
      [
        {
          user: userId,
          gameRound: gameRound._id,
          roundNumber: gameRound.roundNumber,
          betAmount,
          percentage,
          resultType,
          amountChange,
          balanceBefore,
          balanceAfter,
        },
      ],
      { session }
    );

    // Step 9: Update round statistics
    await gameRoundService.updateRoundStats(gameRound._id, betAmount, userId);

    // Step 10: Create transaction for bet placement (deduction)
    await Transaction.create(
      [
        {
          user: userId,
          type: 'bet_round',
          amount: betAmount,
          status: 'completed',
          description: `Bet placed on round #${gameRound.roundNumber} (${percentage > 0 ? '+' : ''}${percentage}%)`,
          metadata: {
            betRoundId: betRound[0]._id,
            gameRoundId: gameRound._id,
            roundNumber: gameRound.roundNumber,
            percentage,
            resultType,
          },
        },
      ],
      { session }
    );

    // Step 11: Create transaction for win/loss (if not neutral)
    if (resultType !== 'neutral') {
      await Transaction.create(
        [
          {
            user: userId,
            type: resultType === 'win' ? 'win' : 'bet_round',
            amount: Math.abs(amountChange),
            status: 'completed',
            description: `Round #${gameRound.roundNumber} result: ${resultType} (${percentage > 0 ? '+' : ''}${percentage}%)`,
            metadata: {
              betRoundId: betRound[0]._id,
              gameRoundId: gameRound._id,
              roundNumber: gameRound.roundNumber,
              percentage,
              resultType,
              amountChange,
            },
          },
        ],
        { session }
      );
    }

    // Commit transaction
    await session.commitTransaction();

    return {
      betRound: betRound[0],
      gameRound: {
        id: gameRound._id,
        roundNumber: gameRound.roundNumber,
        status: gameRound.status,
      },
      balanceBefore,
      balanceAfter,
      resultType,
      amountChange,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = {
  calculateRoundResult,
  validateBetAmount,
  updateUserBalance,
  processBetRound,
};

