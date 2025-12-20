const express = require('express');
const router = express.Router();
const {
  syncMatches,
  getLiveMatches,
  syncOdds,
  getLeagues,
  getTeams,
  getStatus,
} = require('../controllers/rapidapi.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// RapidAPI endpoints
router.get('/status', getStatus);
router.get('/leagues', getLeagues);
router.get('/teams', getTeams);
router.get('/live-matches', getLiveMatches);
router.post('/sync-matches', syncMatches);
router.post('/sync-odds/:matchId', syncOdds);

module.exports = router;

