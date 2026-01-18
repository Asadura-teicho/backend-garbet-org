const express = require('express');
const router = express.Router();
const {
  createDeposit,
  createWithdrawal,
  getTransactions,
  getTransaction,
} = require('../controllers/transaction.controller');
const protect = require('../middleware/auth.middleware');

// All routes require authentication
router.use(protect);

router.post('/deposit', createDeposit);
router.post('/withdraw', createWithdrawal);
router.get('/', getTransactions);
router.get('/:id', getTransaction);

module.exports = router;

