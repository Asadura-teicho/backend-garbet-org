const express = require('express');
const router = express.Router();
const {
  getIbans,
  getIbanById,
  createIban,
  updateIban,
  deleteIban,
  toggleIbanStatus,
} = require('../controllers/iban.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

// Get all IBANs
router.get('/', getIbans);

// Get IBAN by ID
router.get('/:id', getIbanById);

// Create new IBAN
router.post('/', createIban);

// Update IBAN
router.put('/:id', updateIban);

// Toggle IBAN status
router.put('/:id/toggle', toggleIbanStatus);

// Delete IBAN
router.delete('/:id', deleteIban);

module.exports = router;

