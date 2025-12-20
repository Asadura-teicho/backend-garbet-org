const express = require('express');
const router = express.Router();
const {
  getMatches,
  getMatchById,
  createMatch,
  updateMatch,
  enterMatchResult,
  placeBet,
  getMyBets,
} = require('../controllers/match.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// All routes require authentication
router.use(authMiddleware);

// Public routes (authenticated users)
router.get('/', getMatches);
router.get('/bets/my', getMyBets);
router.get('/:id', getMatchById);
router.post('/:id/bet', placeBet);

// Admin routes
router.post('/', adminMiddleware, createMatch);
router.put('/:id', adminMiddleware, updateMatch);
router.post('/:id/result', adminMiddleware, enterMatchResult);

module.exports = router;

