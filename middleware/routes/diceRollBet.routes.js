/**
 * Dice Roll Bet Routes
 */

const express = require('express');
const router = express.Router();
const diceRollBetController = require('../controllers/diceRollBet.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Place bet
router.post('/', authMiddleware, diceRollBetController.placeBet);

// Get user's bets
router.get('/my-bets', authMiddleware, diceRollBetController.getMyBets);

// Get bets for a game
router.get('/game/:gameId', diceRollBetController.getGameBets);

// Get single bet
router.get('/:id', authMiddleware, diceRollBetController.getBet);

module.exports = router;

