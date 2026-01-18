const express = require('express');
const router = express.Router();
const { getActiveIbans } = require('../controllers/iban.controller');

// Public routes (no authentication required)

// Get active IBANs for deposit page
router.get('/ibans', getActiveIbans);

module.exports = router;


