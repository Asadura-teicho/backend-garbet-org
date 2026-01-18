/**
 * Gates of Olympus Game Routes
 */

const express = require('express');
const router = express.Router();
const gatesOfOlympusController = require('../controllers/gatesOfOlympus.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// Play game
router.post('/play', gatesOfOlympusController.playGame);

// Get game history
router.get('/history', gatesOfOlympusController.getGameHistory);

// Get statistics
router.get('/stats', gatesOfOlympusController.getStats);

module.exports = router;
