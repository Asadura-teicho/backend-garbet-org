const express = require('express');
const router = express.Router();
const {
  getGameList,
  createGameSession,
  gameWebhook,
  getGameCategories,
} = require('../controllers/gameProvider.controller');
const authMiddleware = require('../middleware/auth.middleware');

// User routes
router.use(authMiddleware);
router.get('/list', getGameList);
router.get('/categories', getGameCategories);
router.post('/session', createGameSession);

// Webhook (public, but should be secured with signature verification)
router.post('/webhook', gameWebhook);

module.exports = router;

