const express = require('express');
const router = express.Router();
const {
  getIbanInfo,
  createIbanDeposit,
  getMyDepositRequests,
  getDepositMethods,
  createWithdrawalRequest,
  getMyWithdrawalRequests,
  cancelWithdrawalRequest,
  updateProfile,
} = require('../controllers/payment.controller');
const authMiddleware = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authMiddleware);

// Deposit routes
router.get('/iban-info', getIbanInfo);
router.post('/iban-deposit', createIbanDeposit);
router.get('/deposit-requests', getMyDepositRequests);
router.get('/deposit-methods', getDepositMethods);

// Withdrawal routes
router.post('/withdrawal/request', createWithdrawalRequest);
router.get('/withdrawal-requests', getMyWithdrawalRequests);
router.post('/withdrawal/:id/cancel', cancelWithdrawalRequest);

// Profile routes
router.put('/profile', updateProfile);

module.exports = router;

