/**
 * Sweet Bonanza Game Routes
 */

const express = require('express');
const router = express.Router();
const sweetBonanzaController = require('../controllers/sweetBonanza.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// Play game
router.post('/play', sweetBonanzaController.playGame);

// Get game history
router.get('/history', sweetBonanzaController.getGameHistory);

// Get statistics
router.get('/stats', sweetBonanzaController.getStats);

module.exports = router;

