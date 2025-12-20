const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  createNotification,
  createBulkNotifications,
} = require('../controllers/notification.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// All routes require authentication
router.use(authMiddleware);

// User routes
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead); // Must come before /:id/read to avoid route conflicts
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

// Admin routes (create notifications)
router.post('/', adminMiddleware, createNotification);
router.post('/bulk', adminMiddleware, createBulkNotifications);

module.exports = router;

