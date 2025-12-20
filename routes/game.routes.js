const express = require('express');
const router = express.Router();
const {
  placeBet,
  processGameResult,
  getGames,
  getGame,
} = require('../controllers/game.controller');
const protect = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

router.post('/bet', placeBet);
router.post('/:id/result', processGameResult);
router.get('/', getGames);
router.get('/:id', getGame);

module.exports = router;

