const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivity,
  getBettingSummary,
  getBalanceHistory,
} = require('../controllers/dashboard.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

router.get('/stats', getDashboardStats);
router.get('/recent-activity', getRecentActivity);
router.get('/betting-summary', getBettingSummary);
router.get('/balance-history', getBalanceHistory);

module.exports = router;
