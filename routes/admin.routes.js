const express = require('express');
const router = express.Router();

// ==========================================
// 1. IMPORT ALL CONTROLLERS (Only Once)
// ==========================================
const kycController = require('../controllers/admin/admin.kyc.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

const {
  getDepositPool,
  getDepositRequestById,
  approveDeposit,
  cancelDeposit,
  bulkApproveDeposits,
  bulkCancelDeposits,
  exportDeposits,
} = require('../controllers/admin/admin.deposit.controller');

const {
  getWithdrawalPool,
  getWithdrawalRequestById,
  approveWithdrawal,
  rejectWithdrawal,
  bulkApproveWithdrawals,
  bulkRejectWithdrawals,
  exportWithdrawals,
} = require('../controllers/admin/admin.withdrawal.controller');

const {
  getUsers,
  updateUserStatus,
  bulkUpdateUserStatus,
  exportUsers,
  updateUserIban,
  updateUserBalance,
} = require('../controllers/admin/admin.user.controller');

const {
  getDashboardStats,
  getRecentTransactions,
  getRevenueChartData,
} = require('../controllers/admin/admin.dashboard.controller');

const {
  getBets,
  settleBet,
  bulkSettleBets,
  exportBets,
} = require('../controllers/admin/admin.betting.controller');

const { getAdminLogs } = require('../controllers/admin/admin.log.controller');

const {
  getGames,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  getProviders,
} = require('../controllers/admin/admin.game.controller');

const {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
} = require('../controllers/admin/admin.promotion.controller');

const {
  getContent,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
} = require('../controllers/admin/admin.content.controller');

const {
  startRound,
  crashRound,
  getCurrentRound,
  getRoundStatistics,
  getRecentRounds,
  getRoundDetails,
  completeRound,
} = require('../controllers/admin/admin.gameRound.controller');

// ==========================================
// 2. PUBLIC ADMIN ROUTES (Bypass Auth)
// ==========================================
// Test route to verify connection
router.get('/test-kyc', (req, res) => {
    res.json({ 
        success: true, 
        data: [{ _id: "1", user: { username: "System_Test", email: "test@test.com" }, status: "verified" }] 
    });
});

// KYC routes (Public for debugging)
router.get('/kyc', kycController.getAllKYC);
router.put('/kyc/:userId', kycController.updateKYCStatus);

router.get('/test', (req, res) => {
    res.json({ success: true, message: "Route found!" });
});

// ==========================================
// 3. PROTECTED ROUTES (Apply Auth Middleware HERE)
// ==========================================
// Everything below this line will require a valid admin token
router.use(authMiddleware);
router.use(adminMiddleware);

// Dashboard
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/recent-transactions', getRecentTransactions);
router.get('/dashboard/revenue-chart', getRevenueChartData);

// Deposit Pool
router.get('/deposit-pool', getDepositPool);
router.get('/deposit-pool/export', exportDeposits);
router.get('/deposit-pool/:id', getDepositRequestById);
router.post('/deposit-pool/:id/approve', approveDeposit);
router.post('/deposit-pool/:id/cancel', cancelDeposit);
router.post('/deposit-pool/bulk-approve', bulkApproveDeposits);
router.post('/deposit-pool/bulk-cancel', bulkCancelDeposits);

// Withdrawal Pool
router.get('/withdrawal-pool', getWithdrawalPool);
router.get('/withdrawal-pool/export', exportWithdrawals);
router.get('/withdrawal-pool/:id', getWithdrawalRequestById);
router.post('/withdrawal-pool/:id/approve', approveWithdrawal);
router.post('/withdrawal-pool/:id/reject', rejectWithdrawal);
router.post('/withdrawal-pool/bulk-approve', bulkApproveWithdrawals);
router.post('/withdrawal-pool/bulk-reject', bulkRejectWithdrawals);

// User Management
router.get('/users', getUsers);
router.get('/users/export', exportUsers);
router.put('/users/:id/status', updateUserStatus);
router.put('/users/bulk-status', bulkUpdateUserStatus);
router.put('/users/:id/iban', updateUserIban);
router.put('/users/:id/balance', updateUserBalance);

// Betting Management
router.get('/bets', getBets);
router.get('/bets/export', exportBets);
router.put('/bets/:id/settle', settleBet);
router.put('/bets/bulk-settle', bulkSettleBets);

// Game Catalog
router.get('/games', getGames);
router.get('/games/providers', getProviders);
router.get('/games/:id', getGameById);
router.post('/games', createGame);
router.put('/games/:id', updateGame);
router.delete('/games/:id', deleteGame);

// Promotion Management
router.get('/promotions', getPromotions);
router.get('/promotions/:id', getPromotionById);
router.post('/promotions', createPromotion);
router.put('/promotions/:id', updatePromotion);
router.delete('/promotions/:id', deletePromotion);

// Content Management
router.get('/content', getContent);
router.get('/content/:id', getContentById);
router.post('/content', createContent);
router.put('/content/:id', updateContent);
router.delete('/content/:id', deleteContent);

// Tournament Management
const {
  getTournaments,
  getTournamentById,
  createTournament,
  updateTournament,
  deleteTournament,
  getTournamentParticipants,
} = require('../controllers/admin/admin.tournament.controller');

router.get('/tournaments', getTournaments);
router.get('/tournaments/:id', getTournamentById);
router.post('/tournaments', createTournament);
router.put('/tournaments/:id', updateTournament);
router.delete('/tournaments/:id', deleteTournament);
router.get('/tournaments/:id/participants', getTournamentParticipants);

// Logs
router.get('/logs', getAdminLogs);

module.exports = router;