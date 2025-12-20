const express = require('express');
const router = express.Router();
const {
  getMatchResults,
  getUserStatistics,
  getBettingHistoryStats,
} = require('../controllers/stats.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Public routes
router.get('/results', getMatchResults);

// Protected routes (require authentication)
router.use(authMiddleware);
router.get('/statistics', getUserStatistics);
router.get('/betting-history', getBettingHistoryStats);

module.exports = router;
