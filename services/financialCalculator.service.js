/**
 * Financial Calculator Service
 * Handles balance calculations, win/loss percentages, and financial flow tracking
 */

/**
 * Calculate balance after a win
 * @param {number} currentBalance - Current balance
 * @param {number} winAmount - Amount won
 * @returns {Object} - New balance and calculation details
 */
function calculateWin(currentBalance, winAmount) {
  const newBalance = currentBalance + winAmount;
  const percentageChange = currentBalance > 0 ? (winAmount / currentBalance) * 100 : 0;
  
  return {
    previousBalance: currentBalance,
    newBalance,
    change: winAmount,
    percentageChange: parseFloat(percentageChange.toFixed(2)),
    type: 'win',
  };
}

/**
 * Calculate balance after a loss (percentage-based)
 * @param {number} currentBalance - Current balance
 * @param {number} lossPercentage - Loss percentage (0-100)
 * @returns {Object} - New balance and calculation details
 */
function calculateLossPercentage(currentBalance, lossPercentage) {
  if (lossPercentage < 0 || lossPercentage > 100) {
    throw new Error('Loss percentage must be between 0 and 100');
  }
  
  const lossAmount = (currentBalance * lossPercentage) / 100;
  const newBalance = Math.max(0, currentBalance - lossAmount);
  
  return {
    previousBalance: currentBalance,
    newBalance,
    change: -lossAmount,
    percentageChange: -lossPercentage,
    type: 'loss',
    lossAmount,
  };
}

/**
 * Calculate balance after a gain (percentage-based)
 * @param {number} currentBalance - Current balance
 * @param {number} gainPercentage - Gain percentage (0-100)
 * @returns {Object} - New balance and calculation details
 */
function calculateGainPercentage(currentBalance, gainPercentage) {
  if (gainPercentage < 0 || gainPercentage > 100) {
    throw new Error('Gain percentage must be between 0 and 100');
  }
  
  const gainAmount = (currentBalance * gainPercentage) / 100;
  const newBalance = currentBalance + gainAmount;
  
  return {
    previousBalance: currentBalance,
    newBalance,
    change: gainAmount,
    percentageChange: gainPercentage,
    type: 'gain',
    gainAmount,
  };
}

/**
 * Calculate financial flow (multiple operations in sequence)
 * Example: Start $1000, Win $100, Lose 40%, Gain 5%
 * @param {number} startingBalance - Initial balance
 * @param {Array} operations - Array of operations [{type: 'win', amount: 100}, {type: 'loss', percentage: 40}, ...]
 * @returns {Object} - Complete flow calculation
 */
function calculateFinancialFlow(startingBalance, operations) {
  let currentBalance = startingBalance;
  const steps = [];
  let totalChange = 0;
  
  operations.forEach((operation, index) => {
    let result;
    
    switch (operation.type) {
      case 'win':
        result = calculateWin(currentBalance, operation.amount || 0);
        break;
      case 'loss':
        result = calculateLossPercentage(currentBalance, operation.percentage || 0);
        break;
      case 'gain':
        result = calculateGainPercentage(currentBalance, operation.percentage || 0);
        break;
      case 'bet':
        result = {
          previousBalance: currentBalance,
          newBalance: Math.max(0, currentBalance - (operation.amount || 0)),
          change: -(operation.amount || 0),
          percentageChange: currentBalance > 0 ? -((operation.amount || 0) / currentBalance) * 100 : 0,
          type: 'bet',
        };
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
    
    currentBalance = result.newBalance;
    totalChange += result.change;
    
    steps.push({
      step: index + 1,
      operation: operation.type,
      ...result,
    });
  });
  
  const netChange = currentBalance - startingBalance;
  const netPercentageChange = startingBalance > 0 ? (netChange / startingBalance) * 100 : 0;
  
  return {
    startingBalance,
    finalBalance: currentBalance,
    netChange,
    netPercentageChange: parseFloat(netPercentageChange.toFixed(2)),
    totalOperations: operations.length,
    steps,
    summary: {
      totalWins: steps.filter(s => s.type === 'win').reduce((sum, s) => sum + (s.change > 0 ? s.change : 0), 0),
      totalLosses: Math.abs(steps.filter(s => s.type === 'loss' || s.type === 'bet').reduce((sum, s) => sum + (s.change < 0 ? s.change : 0), 0)),
      totalGains: steps.filter(s => s.type === 'gain').reduce((sum, s) => sum + (s.change > 0 ? s.change : 0), 0),
    },
  };
}

/**
 * Calculate win/loss statistics for a user
 * @param {Array} transactions - Array of transaction objects
 * @returns {Object} - Win/loss statistics
 */
function calculateWinLossStats(transactions) {
  const wins = transactions.filter(t => t.type === 'win');
  const losses = transactions.filter(t => t.type === 'bet' && t.status === 'completed');
  
  const totalWins = wins.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalLosses = losses.reduce((sum, t) => sum + (t.amount || 0), 0);
  const netProfit = totalWins - totalLosses;
  
  const winRate = transactions.length > 0 
    ? (wins.length / transactions.length) * 100 
    : 0;
  
  const lossRate = transactions.length > 0 
    ? (losses.length / transactions.length) * 100 
    : 0;
  
  return {
    totalWins,
    totalLosses,
    netProfit,
    winRate: parseFloat(winRate.toFixed(2)),
    lossRate: parseFloat(lossRate.toFixed(2)),
    totalTransactions: transactions.length,
    winCount: wins.length,
    lossCount: losses.length,
  };
}

/**
 * Apply automatic balance adjustment based on game outcome
 * @param {number} currentBalance - Current balance
 * @param {Object} gameOutcome - Game outcome {type: 'win'|'loss'|'draw', amount?: number, percentage?: number}
 * @returns {Object} - Adjustment result
 */
function applyGameOutcome(currentBalance, gameOutcome) {
  let result;
  
  switch (gameOutcome.type) {
    case 'win':
      if (gameOutcome.amount) {
        result = calculateWin(currentBalance, gameOutcome.amount);
      } else if (gameOutcome.percentage) {
        result = calculateGainPercentage(currentBalance, gameOutcome.percentage);
      } else {
        throw new Error('Win outcome must have amount or percentage');
      }
      break;
    case 'loss':
      if (gameOutcome.percentage) {
        result = calculateLossPercentage(currentBalance, gameOutcome.percentage);
      } else if (gameOutcome.amount) {
        result = {
          previousBalance: currentBalance,
          newBalance: Math.max(0, currentBalance - gameOutcome.amount),
          change: -gameOutcome.amount,
          percentageChange: currentBalance > 0 ? -(gameOutcome.amount / currentBalance) * 100 : 0,
          type: 'loss',
        };
      } else {
        throw new Error('Loss outcome must have amount or percentage');
      }
      break;
    case 'draw':
      result = {
        previousBalance: currentBalance,
        newBalance: currentBalance,
        change: 0,
        percentageChange: 0,
        type: 'draw',
      };
      break;
    default:
      throw new Error(`Unknown game outcome type: ${gameOutcome.type}`);
  }
  
  return result;
}

module.exports = {
  calculateWin,
  calculateLossPercentage,
  calculateGainPercentage,
  calculateFinancialFlow,
  calculateWinLossStats,
  applyGameOutcome,
};

