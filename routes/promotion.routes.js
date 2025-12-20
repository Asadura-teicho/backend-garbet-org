const express = require('express');
const router = express.Router();
const {
  getActivePromotions,
  getPromotionById,
  claimPromotion,
  getMyPromotions,
  getPromotionStatus,
} = require('../controllers/promotion.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Public routes (can be accessed without authentication)
router.get('/', getActivePromotions);

// Protected routes (require authentication)
// Note: /my must be defined before /:id routes to avoid route conflicts
router.get('/my', authMiddleware, getMyPromotions);

// Public routes with :id (must come after /my)
router.get('/:id', getPromotionById);

// Protected routes with :id
router.get('/:id/status', authMiddleware, getPromotionStatus);
router.post('/:id/claim', authMiddleware, claimPromotion);

module.exports = router;
