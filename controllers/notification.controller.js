/**
 * Notification Controller
 * Handles notification operations
 */

const Notification = require('../models/Notification.model');
const User = require('../models/User.model');

// -------------------------------------------
// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
// -------------------------------------------
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const userId = req.user.id;

    const query = { user: userId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });

    res.json({
      notifications,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
// -------------------------------------------
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({ _id: id, user: userId });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
// -------------------------------------------
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    res.json({
      message: 'All notifications marked as read',
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
// -------------------------------------------
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndDelete({ _id: id, user: userId });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get unread count
// @route   GET /api/notifications/unread-count
// @access  Private
// -------------------------------------------
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const unreadCount = await Notification.countDocuments({ user: userId, isRead: false });

    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Create notification (Admin/System)
// @route   POST /api/notifications
// @access  Private (Admin or System)
// -------------------------------------------
exports.createNotification = async (req, res) => {
  try {
    const { userId, type, title, message, link, metadata } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      link,
      metadata: metadata || {},
    });

    res.status(201).json({
      message: 'Notification created successfully',
      notification,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Create bulk notifications (Admin/System)
// @route   POST /api/notifications/bulk
// @access  Private (Admin only)
// -------------------------------------------
exports.createBulkNotifications = async (req, res) => {
  try {
    const { userIds, type, title, message, link, metadata } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    const notifications = userIds.map((userId) => ({
      user: userId,
      type,
      title,
      message,
      link,
      metadata: metadata || {},
    }));

    const created = await Notification.insertMany(notifications);

    res.status(201).json({
      message: `Successfully created ${created.length} notifications`,
      count: created.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

