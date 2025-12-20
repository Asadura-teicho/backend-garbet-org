const express = require('express');
const router = express.Router();
const {
  getMyBonuses,
  checkRollover,
  getBonusSettings,
  getAllBonuses,
} = require('../controllers/bonus.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// User routes
router.use(authMiddleware);
router.get('/my-bonuses', getMyBonuses);
router.post('/check-rollover', checkRollover);

// Admin routes
router.get('/settings', adminMiddleware, getBonusSettings);
router.get('/', adminMiddleware, getAllBonuses);

module.exports = router;

