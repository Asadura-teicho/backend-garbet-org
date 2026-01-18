const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  getPublicSettings,
} = require('../controllers/settings.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// Public route
router.get('/public', getPublicSettings);

// Admin routes
router.get('/', authMiddleware, adminMiddleware, getSettings);
router.put('/', authMiddleware, adminMiddleware, updateSettings);

module.exports = router;

