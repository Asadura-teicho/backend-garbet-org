const express = require('express');
const router = express.Router();
const {
  getMessages,
  getMessageById,
  sendMessage,
  markAsRead,
  markAllAsRead,
  deleteMessage,
  getUnreadCount,
  sendSystemMessage,
} = require('../controllers/message.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

// All routes require authentication
router.use(authMiddleware);

// User routes
router.get('/', getMessages);
router.get('/unread-count', getUnreadCount);
router.post('/', sendMessage);
router.put('/read-all', markAllAsRead); // Must come before /:id/read to avoid route conflicts
router.put('/:id/read', markAsRead);
router.get('/:id', getMessageById);
router.delete('/:id', deleteMessage);

// Admin routes (send system messages)
router.post('/system', adminMiddleware, sendSystemMessage);

module.exports = router;
