const express = require('express');
const router = express.Router();
const {
  placeBet,
  getBettingHistory,
  getBetRoundDetails,
  getBettingStatistics,
} = require('../controllers/betRound.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// Place a bet on a round
router.post('/place', placeBet);

// Get betting history
router.get('/history', getBettingHistory);

// Get betting statistics
router.get('/statistics', getBettingStatistics);

// Get specific round details
router.get('/:id', getBetRoundDetails);

module.exports = router;
