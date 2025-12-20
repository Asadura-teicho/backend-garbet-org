/**
 * Notification Helper Utility
 * Provides easy functions to create notifications
 */

const Notification = require('../models/Notification.model');

/**
 * Create a notification for a user
 * @param {Object} options - Notification options
 * @param {String} options.userId - User ID to notify
 * @param {String} options.type - Notification type
 * @param {String} options.title - Notification title
 * @param {String} options.message - Notification message
 * @param {String} options.link - Optional link
 * @param {Object} options.metadata - Optional metadata
 */
async function createNotification({ userId, type, title, message, link = null, metadata = {} }) {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      link,
      metadata,
    });
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Create notifications for multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {Object} notificationData - Notification data
 */
async function createBulkNotifications(userIds, notificationData) {
  try {
    const notifications = userIds.map((userId) => ({
      user: userId,
      ...notificationData,
    }));

    const created = await Notification.insertMany(notifications);
    return created;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    return [];
  }
}

module.exports = {
  createNotification,
  createBulkNotifications,
};

