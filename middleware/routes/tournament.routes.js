const express = require('express');
const router = express.Router();
const {
  getTournaments,
  getTournamentById,
  joinTournament,
  getMyTournaments,
  getLeaderboard,
  getStandings,
} = require('../controllers/tournament.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Public routes (can be accessed without authentication)
router.get('/', getTournaments);

// Protected routes (require authentication)
// Note: /my must be defined before /:id routes to avoid route conflicts
router.get('/my', authMiddleware, getMyTournaments);

// Public routes with :id (must come after /my)
router.get('/:id', getTournamentById);
router.get('/:id/leaderboard', getLeaderboard);
router.get('/:id/standings', getStandings);

// Protected routes with :id
router.post('/:id/join', authMiddleware, joinTournament);

module.exports = router;
