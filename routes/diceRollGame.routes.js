/**
 * Dice Roll Game Routes
 */

const express = require('express');
const router = express.Router();
const diceRollGameController = require('../controllers/diceRollGame.controller');
const diceRollBetController = require('../controllers/diceRollBet.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// ============================================
// GAME ROUTES (Public/Admin)
// ============================================

// Get all games (public)
router.get('/', diceRollGameController.getAllGames);

// Get active game (public)
router.get('/active', diceRollGameController.getActiveGame);

// Matchmaking routes (user)
router.post('/join-queue', authMiddleware, diceRollGameController.joinMatchmakingQueue);
router.get('/matchmaking-status', authMiddleware, diceRollGameController.getMatchmakingStatus);
router.post('/leave-queue', authMiddleware, diceRollGameController.leaveMatchmakingQueue);

// Roll dice for player vs player game (user)
router.post('/:id/roll-dice', authMiddleware, diceRollGameController.rollDice);

// Get single game (public)
router.get('/:id', diceRollGameController.getGame);

// Get game stats (admin only)
router.get('/:id/stats', authMiddleware, adminMiddleware, diceRollGameController.getGameStats);

// Create game (admin only)
router.post('/', authMiddleware, adminMiddleware, diceRollGameController.createGame);

// Close game (admin only)
router.patch('/:id/close', authMiddleware, adminMiddleware, diceRollGameController.closeGame);

// Select winner (admin only)
router.patch('/:id/select-winner', authMiddleware, adminMiddleware, diceRollGameController.selectWinner);

// Select winner for PvP game (admin only)
router.patch('/:id/select-pvp-winner', authMiddleware, adminMiddleware, diceRollGameController.selectPvPWinner);

// Change outcome (admin only)
router.patch('/:id/change-outcome', authMiddleware, adminMiddleware, diceRollGameController.changeOutcome);

// ============================================
// BET ROUTES (nested under game)
// ============================================

// Place bet (user) - gameId comes from params
router.post('/:gameId/bets', authMiddleware, (req, res, next) => {
  req.body.gameId = req.params.gameId;
  next();
}, diceRollBetController.placeBet);

// Get bets for a game (public)
router.get('/:gameId/bets', diceRollBetController.getGameBets);

module.exports = router;

