/**
 * Message Controller
 * Handles user messaging operations
 */

const Message = require('../models/Message.model');
const User = require('../models/User.model');
const { createNotification } = require('../utils/notificationHelper');

// -------------------------------------------
// @desc    Get user messages
// @route   GET /api/messages
// @access  Private
// -------------------------------------------
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      type,
      category,
      isRead,
      isImportant,
      search,
    } = req.query;

    const query = {
      recipient: userId,
      isDeleted: false,
    };

    // Filter by type
    if (type && type !== 'all') {
      query.type = type;
    }

    // Filter by category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Filter by read status
    if (isRead !== undefined && isRead !== 'all') {
      query.isRead = isRead === 'true';
    }

    // Filter by importance
    if (isImportant === 'true') {
      query.isImportant = true;
    }

    // Search filter
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const messages = await Message.find(query)
      .populate('sender', 'username email firstName lastName')
      .sort({ isImportant: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Message.countDocuments(query);
    const unreadCount = await Message.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: false,
    });

    res.json({
      messages,
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
// @desc    Get message by ID
// @route   GET /api/messages/:id
// @access  Private
// -------------------------------------------
exports.getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const message = await Message.findOne({
      _id: id,
      recipient: userId,
      isDeleted: false,
    }).populate('sender', 'username email firstName lastName');

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Mark as read if not already read
    if (!message.isRead) {
      message.isRead = true;
      message.readAt = new Date();
      await message.save();
    }

    res.json({ message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Send message
// @route   POST /api/messages
// @access  Private
// -------------------------------------------
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipientId, subject, content, type = 'user', category = 'general' } = req.body;

    // Validate required fields
    if (!recipientId || !content) {
      return res.status(400).json({
        message: 'Recipient ID and content are required',
      });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    // Don't allow users to send messages to themselves
    if (recipientId === userId) {
      return res.status(400).json({ message: 'Cannot send message to yourself' });
    }

    // Create message
    const message = await Message.create({
      sender: userId,
      recipient: recipientId,
      subject: subject || '',
      content,
      type,
      category,
    });

    // Populate sender info
    await message.populate('sender', 'username email firstName lastName');

    // Create notification for recipient
    createNotification({
      userId: recipientId,
      type: 'support_ticket_replied',
      title: 'New Message',
      message: `You have received a new message${subject ? `: ${subject}` : ''}`,
      link: '/messages',
      metadata: { messageId: message._id, senderId: userId },
    }).catch((err) => console.error('Notification creation error:', err));

    res.status(201).json({
      message: 'Message sent successfully',
      message: message,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Mark message as read
// @route   PUT /api/messages/:id/read
// @access  Private
// -------------------------------------------
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const message = await Message.findOne({
      _id: id,
      recipient: userId,
      isDeleted: false,
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (!message.isRead) {
      message.isRead = true;
      message.readAt = new Date();
      await message.save();
    }

    res.json({
      message: 'Message marked as read',
      message: message,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Mark all messages as read
// @route   PUT /api/messages/read-all
// @access  Private
// -------------------------------------------
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Message.updateMany(
      {
        recipient: userId,
        isRead: false,
        isDeleted: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    res.json({
      message: 'All messages marked as read',
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private
// -------------------------------------------
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const message = await Message.findOne({
      _id: id,
      recipient: userId,
      isDeleted: false,
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Soft delete
    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get unread message count
// @route   GET /api/messages/unread-count
// @access  Private
// -------------------------------------------
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await Message.countDocuments({
      recipient: userId,
      isRead: false,
      isDeleted: false,
    });

    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Send system message (Admin/System)
// @route   POST /api/messages/system
// @access  Private (Admin or System)
// -------------------------------------------
exports.sendSystemMessage = async (req, res) => {
  try {
    const { userIds, subject, content, type = 'system', category = 'general', isImportant = false } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    // Verify all users exist
    const users = await User.find({ _id: { $in: userIds } });
    if (users.length !== userIds.length) {
      return res.status(400).json({ message: 'Some users not found' });
    }

    // Create messages for all recipients
    const messages = userIds.map((userId) => ({
      sender: null, // System message
      recipient: userId,
      subject: subject || '',
      content,
      type,
      category,
      isImportant,
    }));

    const created = await Message.insertMany(messages);

    // Create notifications for all recipients (async)
    const notificationPromises = userIds.map((userId) =>
      createNotification({
        userId,
        type: 'system_announcement',
        title: subject || 'System Message',
        message: content,
        link: '/messages',
        metadata: { messageId: created.find((m) => m.recipient.toString() === userId.toString())._id },
      })
    );

    Promise.all(notificationPromises).catch((err) =>
      console.error('Notification creation error:', err)
    );

    res.status(201).json({
      message: `Successfully sent ${created.length} messages`,
      count: created.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
