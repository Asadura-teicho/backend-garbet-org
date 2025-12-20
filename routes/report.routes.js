const express = require('express');
const router = express.Router();
const {
  getDepositsReport,
  getWithdrawalsReport,
  getRegistrationsReport,
  getTurnoverReport,
  exportData,
} = require('../controllers/report.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/deposits', getDepositsReport);
router.get('/withdrawals', getWithdrawalsReport);
router.get('/registrations', getRegistrationsReport);
router.get('/turnover', getTurnoverReport);
router.get('/export', exportData);

module.exports = router;

