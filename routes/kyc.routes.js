const express = require('express');
const router = express.Router();

const {
  submitKYC,
  getKYC,
  uploadKYCDocuments,
  getKYCForAdmin,
  getAllKYCForAdmin
} = require('../controllers/kyc.controller');

const { uploadKYC } = require('../utils/upload');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// All routes require auth
router.use(authMiddleware);

// User routes
router.get('/', getKYC);
router.post('/submit', submitKYC);

// ✅ FIXED: single multer middleware
router.post('/upload', uploadKYC, uploadKYCDocuments);

// Admin route
router.get('/:userId', adminMiddleware, getKYCForAdmin);
router.get('/kyc/all', adminMiddleware, getAllKYCForAdmin);

module.exports = router;
