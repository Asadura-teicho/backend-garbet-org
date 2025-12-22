/**
 * Financial Calculator Routes
 */

const express = require('express');
const router = express.Router();
const financialCalculatorController = require('../controllers/financialCalculator.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// Calculate financial flow (doesn't modify balance)
router.post('/calculate-flow', financialCalculatorController.calculateFlow);

// Apply financial flow to user balance
router.post('/apply-flow', financialCalculatorController.applyFlow);

// Apply game outcome to balance
router.post('/apply-game-outcome', financialCalculatorController.applyGameOutcome);

// Get balance history
router.get('/balance-history', financialCalculatorController.getBalanceHistory);

// Get win/loss statistics
router.get('/win-loss-stats', financialCalculatorController.getWinLossStats);

// Example flow (public for demo)
router.post('/example-flow', financialCalculatorController.exampleFlow);

module.exports = router;

