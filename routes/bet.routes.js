const express = require('express');
const router = express.Router();
const {
  getBettingHistory,
  getBetDetails,
  getBettingStatistics,
  getBettingSummary,
} = require('../controllers/bet.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

router.get('/history', getBettingHistory);
router.get('/statistics', getBettingStatistics);
router.get('/summary', getBettingSummary);
router.get('/:id', getBetDetails);

module.exports = router;
