/**
 * Sweet Bonanza Game Controller
 * Handles Sweet Bonanza slot game logic with realistic win/loss ratios
 */

const User = require('../models/User.model');
const Transaction = require('../models/Transaction.model');
const BalanceHistory = require('../models/BalanceHistory.model');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/error.middleware').asyncHandler;
const AppError = require('../middleware/error.middleware').AppError;

// Symbol weights for 63% loss rate (37% win rate)
// Low-value symbols are more common to reduce win frequency
const SYMBOL_WEIGHTS = {
  '🍇': 40, '🍊': 30, '🍋': 20, '🍉': 15, '🍌': 10,
  '🍎': 5, '🍓': 3, '⭐': 1.5, '💎': 0.5  // Low-value symbols dominate
};

// Reduced multipliers - wins are smaller than losses
const SYMBOL_MULTIPLIERS = {
  '💎': 20,   // Reduced from 25
  '⭐': 10,   // Reduced from 12
  '🍓': 5,   // Reduced from 6
  '🍎': 3,   // Reduced from 4
  '🍌': 2,   // Reduced from 2.5
  '🍉': 1.5, // Reduced from 2
  '🍋': 1.2, // Reduced from 1.5
  '🍊': 1.1, // Reduced from 1.2
  '🍇': 1    // Equal to bet
};

/**
 * Get weighted random symbol
 */
const getWeightedSymbol = () => {
  const totalWeight = Object.values(SYMBOL_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const [symbol, weight] of Object.entries(SYMBOL_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      return symbol;
    }
  }
  return '🍇'; // Fallback
};

/**
 * Generate reel result with high loss rate
 * Win rate: ~10-15% (players mostly lose)
 * Wins are small to ensure net loss over time
 */
const generateReelResult = (betAmount) => {
  const reels = Array(6).fill(null).map(() => 
    Array(3).fill(null).map(() => getWeightedSymbol())
  );

  // Calculate base win
  const symbolCounts = {};
  reels.forEach((reel, reelIndex) => {
    reel.forEach((symbol, symbolIndex) => {
      const key = `${symbolIndex}-${symbol}`;
      if (!symbolCounts[key]) {
        symbolCounts[key] = { symbol, position: symbolIndex, count: 0, positions: [] };
      }
      symbolCounts[key].count++;
      symbolCounts[key].positions.push({ reel: reelIndex, position: symbolIndex });
    });
  });

  let totalWin = 0;
  const winningPositions = [];

  Object.values(symbolCounts).forEach(({ symbol, position, count, positions }) => {
    // 5+ symbols - guaranteed win (rare, bigger win)
    if (count >= 5) {
      const baseMultiplier = SYMBOL_MULTIPLIERS[symbol] || 1;
      // Moderate multiplier for rare big wins
      const multiplier = baseMultiplier * (count - 4) * 0.7;
      const win = betAmount * multiplier;
      totalWin += win;
      if (positions && positions.length > 0) {
        winningPositions.push(...positions);
      }
    }
    // 4 symbols - guaranteed win but smaller (37% win rate target)
    else if (count >= 4) {
      const baseMultiplier = SYMBOL_MULTIPLIERS[symbol] || 1;
      // Small multiplier - wins are smaller than losses
      const multiplier = baseMultiplier * 0.6; // Reduced from 0.8
      const win = betAmount * multiplier;
      totalWin += win;
      if (positions && positions.length > 0) {
        winningPositions.push(...positions);
      }
    }
    // 3 symbols - 30% chance to win (reduced from 60% to achieve 37% overall win rate)
    else if (count === 3 && Math.random() < 0.3) {
      const baseMultiplier = SYMBOL_MULTIPLIERS[symbol] || 1;
      const multiplier = baseMultiplier * 0.4; // Small multiplier
      const win = betAmount * multiplier;
      totalWin += win;
      if (positions && positions.length > 0) {
        winningPositions.push(...positions);
      }
    }
  });

  // Check for scatter wins - balanced for 37% win rate
  const scatterCount = reels.flat().filter(s => s === '⭐' || s === '💎').length;
  if (scatterCount >= 5) {
    // Reduced scatter multipliers - wins smaller than losses
    const scatterMultiplier = scatterCount === 5 ? 1.5 : scatterCount >= 6 ? 2.5 : 0;
    totalWin += betAmount * scatterMultiplier;
    
    // Add scatter positions as winning positions for visual feedback
    reels.forEach((reel, reelIndex) => {
      reel.forEach((symbol, symbolIndex) => {
        if (symbol === '⭐' || symbol === '💎') {
          winningPositions.push({ reel: reelIndex, position: symbolIndex });
        }
      });
    });
  }
  // 4 scatters - guaranteed but smaller win
  else if (scatterCount >= 4) {
    totalWin += betAmount * 1.0; // Small scatter win
    reels.forEach((reel, reelIndex) => {
      reel.forEach((symbol, symbolIndex) => {
        if (symbol === '⭐' || symbol === '💎') {
          winningPositions.push({ reel: reelIndex, position: symbolIndex });
        }
      });
    });
  }
  // 3 scatters - 20% chance for small win (reduced from 50% to achieve 37% overall win rate)
  else if (scatterCount === 3 && Math.random() < 0.2) {
    totalWin += betAmount * 0.6; // Small scatter win
    reels.forEach((reel, reelIndex) => {
      reel.forEach((symbol, symbolIndex) => {
        if (symbol === '⭐' || symbol === '💎') {
          winningPositions.push({ reel: reelIndex, position: symbolIndex });
        }
      });
    });
  }

  // If no combo is made (totalWin === 0), it's a loss - no artificial wins
  // This ensures realistic gameplay: you only win when you actually get a combo

  return {
    reels,
    winAmount: Math.floor(totalWin * 100) / 100, // Round to 2 decimals
    winningPositions
  };
};

/**
 * Play Sweet Bonanza game
 * POST /api/sweet-bonanza/play
 */
exports.playGame = asyncHandler(async (req, res) => {
  const { betAmount } = req.body;
  const userId = req.user.id;

  // Validate bet amount
  if (!betAmount || betAmount === null || betAmount === undefined) {
    throw new AppError('Bet amount is required', 400);
  }

  const bet = parseFloat(betAmount);
  
  // Validate bet is a valid number
  if (isNaN(bet) || !isFinite(bet)) {
    throw new AppError('Invalid bet amount format', 400);
  }

  if (bet <= 0) {
    throw new AppError('Bet amount must be greater than 0', 400);
  }

  if (bet < 1) {
    throw new AppError('Minimum bet amount is ₺1', 400);
  }

  // Maximum bet limit (optional safety check)
  const MAX_BET = 1000000; // 1 million
  if (bet > MAX_BET) {
    throw new AppError(`Maximum bet amount is ₺${MAX_BET.toLocaleString()}`, 400);
  }

  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    // Get user with balance
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      throw new AppError('User not found', 404);
    }

    // Check if user account is active
    // Allow 'active' and 'pending' status (pending users can still play)
    if (user.status !== 'active' && user.status !== 'pending') {
      await session.abortTransaction();
      throw new AppError(`Account is ${user.status}. Please contact support if you believe this is an error.`, 403);
    }

    // Check balance - using main deposited balance
    // The balance field in User model is the main balance from deposits
    const userBalance = parseFloat(user.balance) || 0;
    if (isNaN(userBalance) || userBalance < bet) {
      await session.abortTransaction();
      throw new AppError('Insufficient balance', 400);
    }

    const initialBalance = parseFloat(user.balance) || 0; // Main balance from deposits

    // Generate game result first to determine if win or loss
    const gameResult = generateReelResult(bet);
    const { reels, winAmount, winningPositions } = gameResult;

    // Ensure winAmount is a valid number
    const actualWin = Math.max(0, parseFloat(winAmount) || 0);
    let actualLoss = bet;
    
    // If no win, apply loss multiplier (losses are higher than wins)
    // Target: 63% loss rate with losses being higher than win amounts
    if (actualWin === 0) {
      // Loss multiplier: 100% to 180% of bet amount
      // Ensures losses are consistently higher than typical wins (which are 0.4x to 1.5x bet)
      const random = Math.random();
      let lossMultiplier;
      
      if (random < 0.25) {
        // 25% chance: 100-115% of bet (small loss, still higher than most wins)
        lossMultiplier = 1.0 + (Math.random() * 0.15);
      } else if (random < 0.6) {
        // 35% chance: 115-135% of bet (normal loss)
        lossMultiplier = 1.15 + (Math.random() * 0.20);
      } else if (random < 0.85) {
        // 25% chance: 135-160% of bet (big loss)
        lossMultiplier = 1.35 + (Math.random() * 0.25);
      } else {
        // 15% chance: 160-180% of bet (huge loss)
        lossMultiplier = 1.6 + (Math.random() * 0.20);
      }
      
      actualLoss = bet * lossMultiplier;
      
      // Ensure loss doesn't exceed user balance
      if (actualLoss > userBalance) {
        actualLoss = userBalance;
      }
      
      // Ensure loss is not negative or zero
      actualLoss = Math.max(0, actualLoss);
    } else {
      // If win, still deduct full bet but win amount compensates
      // Net result: win - bet (which is typically smaller than loss amounts)
      actualLoss = bet;
    }

    // Ensure actualLoss is valid
    actualLoss = Math.max(0, Math.min(actualLoss, userBalance));

    // Deduct loss amount (with multiplier if no win) from main balance
    // This directly alters the main deposited balance
    const newBalanceAfterLoss = userBalance - actualLoss;
    user.balance = Math.max(0, newBalanceAfterLoss); // Ensure balance doesn't go negative
    await user.save({ session });

    // Calculate net change
    const netChange = actualWin - actualLoss;
    const newBalance = user.balance + actualWin;
    const percentageChange = initialBalance > 0 ? (netChange / initialBalance) * 100 : 0;

    // Add winnings to main balance if any
    // This directly updates the main deposited balance
    if (actualWin > 0) {
      user.balance = newBalance;
      await user.save({ session });

      // Update total winnings
      user.totalWinnings = (parseFloat(user.totalWinnings) || 0) + actualWin;
      await user.save({ session });
    }
    
    // Final balance after all operations - this is the updated main balance
    const finalBalance = parseFloat(user.balance) || 0;
    
    // Validate final balance is valid
    if (isNaN(finalBalance) || finalBalance < 0) {
      await session.abortTransaction();
      throw new AppError('Invalid balance calculation', 500);
    }

    // Create transaction record
    const transactionData = {
      user: userId,
      type: actualWin > 0 ? 'game_win' : 'game_loss',
      amount: Math.abs(netChange),
      status: 'completed',
      currency: user.currency || 'TRY',
      paymentMethod: 'internal',
      description: `Sweet Bonanza - ${actualWin > 0 ? 'Win' : 'Loss'}`,
      metadata: {
        gameType: 'sweet-bonanza',
        betAmount: bet,
        actualLoss: actualLoss,
        winAmount: actualWin,
        netChange: netChange,
        percentageChange: percentageChange,
        balanceBefore: initialBalance,
        balanceAfter: finalBalance,
        lossMultiplier: actualWin === 0 ? (actualLoss / bet) : null,
        reels: reels,
        winningPositions: winningPositions
      }
    };
    
    const transaction = await Transaction.create([transactionData], { session });
    
    // Validate transaction was created
    if (!transaction || !transaction[0] || !transaction[0]._id) {
      await session.abortTransaction();
      throw new AppError('Failed to create transaction record', 500);
    }
    
    // Record balance history
    const balanceHistoryData = {
      user: userId,
      changeType: actualWin > 0 ? 'win' : 'loss',
      previousBalance: initialBalance,
      newBalance: finalBalance,
      change: netChange,
      percentageChange: percentageChange,
      referenceType: 'game',
      referenceId: transaction[0]._id,
      gameOutcome: {
        gameType: 'sweet-bonanza',
        outcome: actualWin > 0 ? 'win' : 'loss',
        amount: Math.abs(netChange),
        percentage: percentageChange
      },
      description: `Sweet Bonanza - Bet: ₺${bet.toFixed(2)}, Loss: ₺${actualLoss.toFixed(2)}, Win: ₺${actualWin.toFixed(2)}`,
      metadata: {
        gameType: 'sweet-bonanza',
        betAmount: bet,
        actualLoss: actualLoss,
        winAmount: actualWin,
        netChange: netChange,
        lossMultiplier: actualWin === 0 ? (actualLoss / bet) : null,
        reels: reels,
        winningPositions: winningPositions
      }
    };
    
    await BalanceHistory.create([balanceHistoryData], { session });

    // Commit transaction
    await session.commitTransaction();

    res.json({
      success: true,
      data: {
        reels,
        betAmount: bet,
        actualLoss: actualLoss,
        winAmount: actualWin,
        netChange,
        newBalance: finalBalance, // Final main balance after game
        percentageChange,
        lossMultiplier: actualWin === 0 ? (actualLoss / bet) : null,
        winningPositions,
        userBalance: finalBalance, // Main balance from deposits (updated by game)
        initialBalance: initialBalance // Initial main balance before game
      }
    });
  } catch (error) {
    // Abort transaction if it was started
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    
    // Log error for debugging
    console.error('Sweet Bonanza playGame error:', error);
    
    // If it's already an AppError, re-throw it
    if (error instanceof AppError) {
      throw error;
    }
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message).join(', ');
      throw new AppError(`Validation error: ${errors}`, 400);
    }
    
    // Handle other errors
    throw new AppError(error.message || 'An error occurred while playing the game', 500);
  } finally {
    await session.endSession();
  }
});

/**
 * Get game history for user
 * GET /api/sweet-bonanza/history
 */
exports.getGameHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  let { limit = 20, page = 1 } = req.query;

  // Validate and sanitize inputs
  limit = parseInt(limit);
  page = parseInt(page);

  if (isNaN(limit) || limit < 1) limit = 20;
  if (isNaN(page) || page < 1) page = 1;

  // Set maximum limit to prevent abuse
  const MAX_LIMIT = 100;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const history = await BalanceHistory.find({
    user: userId,
    'metadata.gameType': 'sweet-bonanza'
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .lean(); // Use lean() for better performance

  const total = await BalanceHistory.countDocuments({
    user: userId,
    'metadata.gameType': 'sweet-bonanza'
  });

  res.json({
    success: true,
    data: {
      history,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit
    }
  });
});

/**
 * Get user statistics
 * GET /api/sweet-bonanza/stats
 */
exports.getStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const allHistory = await BalanceHistory.find({
    user: userId,
    'metadata.gameType': 'sweet-bonanza'
  })
    .sort({ createdAt: -1 })
    .lean(); // Use lean() for better performance

  const totalGames = allHistory.length;
  const wins = allHistory.filter(h => h.changeType === 'win').length;
  const losses = allHistory.filter(h => h.changeType === 'loss').length;
  
  const totalWinAmount = allHistory
    .filter(h => h.changeType === 'win')
    .reduce((sum, h) => {
      const winAmount = parseFloat(h.metadata?.winAmount) || 0;
      return sum + (isNaN(winAmount) ? 0 : winAmount);
    }, 0);
    
  const totalBetAmount = allHistory.reduce((sum, h) => {
    const betAmount = parseFloat(h.metadata?.betAmount) || 0;
    return sum + (isNaN(betAmount) ? 0 : betAmount);
  }, 0);
  
  const netProfit = totalWinAmount - totalBetAmount;
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

  res.json({
    success: true,
    data: {
      
      totalGames,
      wins,
      losses,
      winRate: Math.round(winRate * 100) / 100,
      totalWinAmount: Math.round(totalWinAmount * 100) / 100,
      totalBetAmount: Math.round(totalBetAmount * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100
    }
  });
});

