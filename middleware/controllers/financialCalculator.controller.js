/**
 * Financial Calculator Controller
 * Handles financial flow calculations and balance tracking
 */

const { calculateFinancialFlow, calculateWinLossStats } = require('../services/financialCalculator.service');
const { applyGameOutcomeToBalance, applyFinancialFlowToBalance, getBalanceHistory } = require('../services/balanceTracking.service');
const Transaction = require('../models/Transaction.model');
const BalanceHistory = require('../models/BalanceHistory.model');
const User = require('../models/User.model');
const asyncHandler = require('../middleware/error.middleware').asyncHandler;

// -------------------------------------------
// @desc    Calculate financial flow
// @route   POST /api/financial/calculate-flow
// @access  Private
// -------------------------------------------
exports.calculateFlow = asyncHandler(async (req, res) => {
  const { startingBalance, operations } = req.body;

  if (!startingBalance || !operations || !Array.isArray(operations)) {
    return res.status(400).json({
      message: 'Missing required fields: startingBalance, operations (array)',
    });
  }

  const result = calculateFinancialFlow(startingBalance, operations);

  res.json({
    success: true,
    data: result,
  });
});

// -------------------------------------------
// @desc    Apply financial flow to user balance
// @route   POST /api/financial/apply-flow
// @access  Private
// -------------------------------------------
exports.applyFlow = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { startingBalance, operations, description } = req.body;

  if (!operations || !Array.isArray(operations)) {
    return res.status(400).json({
      message: 'Missing required field: operations (array)',
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const actualStartingBalance = startingBalance || user.balance || 0;
  const result = await applyFinancialFlowToBalance(userId, actualStartingBalance, operations, {
    description: description || 'Financial flow calculation',
  });

  res.json({
    success: true,
    message: 'Financial flow applied successfully',
    data: result,
  });
});

// -------------------------------------------
// @desc    Apply game outcome to balance
// @route   POST /api/financial/apply-game-outcome
// @access  Private
// -------------------------------------------
exports.applyGameOutcome = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { gameOutcome, gameId, gameType, description, metadata } = req.body;

  if (!gameOutcome || !gameOutcome.type) {
    return res.status(400).json({
      message: 'Missing required field: gameOutcome with type',
    });
  }

  const result = await applyGameOutcomeToBalance(userId, gameOutcome, {
    gameId,
    gameType,
    description,
    metadata,
  });

  res.json({
    success: true,
    message: 'Game outcome applied successfully',
    data: result,
  });
});

// -------------------------------------------
// @desc    Get balance history with statistics
// @route   GET /api/financial/balance-history
// @access  Private
// -------------------------------------------
exports.getBalanceHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate, changeType, page = 1, limit = 50 } = req.query;

  const result = await getBalanceHistory(userId, {
    startDate,
    endDate,
    changeType,
    page: parseInt(page),
    limit: parseInt(limit),
  });

  res.json({
    success: true,
    data: result,
  });
});

// -------------------------------------------
// @desc    Get win/loss statistics
// @route   GET /api/financial/win-loss-stats
// @access  Private
// -------------------------------------------
exports.getWinLossStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.query;

  const query = { user: userId };
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const transactions = await Transaction.find(query).sort({ createdAt: -1 });
  const stats = calculateWinLossStats(transactions);

  res.json({
    success: true,
    data: stats,
  });
});

// -------------------------------------------
// @desc    Calculate example financial flow (for testing/demo)
// @route   POST /api/financial/example-flow
// @access  Public (for demo purposes)
// -------------------------------------------
exports.exampleFlow = asyncHandler(async (req, res) => {
  // Example: Start $1000, Win $100, Lose 40%, Gain 5%
  const exampleOperations = [
    { type: 'win', amount: 100 },
    { type: 'loss', percentage: 40 },
    { type: 'gain', percentage: 5 },
  ];

  const result = calculateFinancialFlow(1000, exampleOperations);

  res.json({
    success: true,
    message: 'Example financial flow calculation',
    example: {
      startingBalance: 1000,
      operations: exampleOperations,
    },
    result,
  });
});

