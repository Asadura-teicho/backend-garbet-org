const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  uploadProfilePicture,
  deleteProfilePicture,
} = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { uploadProfilePicture: uploadProfilePictureMiddleware } = require('../utils/upload');

// Middleware to check if the logged-in user is admin
const adminMiddleware = (req, res, next) => {
  if (!['admin', 'super_admin', 'operator'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// All routes require authentication
router.use(authMiddleware);

// User profile picture routes (accessible to all authenticated users)
router.post('/profile-picture', uploadProfilePictureMiddleware, uploadProfilePicture);
router.delete('/profile-picture', deleteProfilePicture);

// Admin-only routes
router.get('/', adminMiddleware, getUsers);
router.get('/:id', adminMiddleware, getUserById);
router.put('/:id', adminMiddleware, updateUser);
router.delete('/:id', adminMiddleware, deleteUser);

module.exports = router;
