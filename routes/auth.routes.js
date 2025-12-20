
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
  register,
  login,
  refreshToken,
  getMe,forgotPassword,resetPassword,logout
  
} = require('../controllers/auth.controller');

// ------------------------
// PUBLIC ROUTES
// ------------------------
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout); // still public because it just clears cookies
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);

// ------------------------
// PRIVATE ROUTES
// ------------------------
router.get('/me', authMiddleware, getMe);

module.exports = router;
