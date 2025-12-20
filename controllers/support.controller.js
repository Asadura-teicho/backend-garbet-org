const SupportTicket = require('../models/SupportTicket.model');
const User = require('../models/User.model');

// -------------------------------------------
// @desc    Create support ticket
// @route   POST /api/support/ticket
// @access  Private
// -------------------------------------------
exports.createTicket = async (req, res) => {
  try {
    const { subject, message, category, priority } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (!subject || !message) {
      return res.status(400).json({
        message: 'Konu ve mesaj gereklidir',
      });
    }

    // Create ticket
    const ticket = await SupportTicket.create({
      user: userId,
      subject,
      message,
      category: category || 'general',
      priority: priority || 'medium',
      status: 'open',
      responses: [
        {
          user: userId,
          message,
          isAdmin: false,
        },
      ],
    });

    // Populate user info
    await ticket.populate('user', 'username firstName lastName email');

    res.status(201).json({
      message: 'Destek talebi oluşturuldu',
      ticket,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get user's tickets
// @route   GET /api/support/my-tickets
// @access  Private
// -------------------------------------------
exports.getMyTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 50, page = 1 } = req.query;

    const query = { user: userId };
    if (status) {
      query.status = status;
    }

    const tickets = await SupportTicket.find(query)
      .populate('assignedTo', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SupportTicket.countDocuments(query);

    res.json({
      tickets,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get ticket by ID
// @route   GET /api/support/tickets/:id
// @access  Private
// -------------------------------------------
exports.getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role && ['admin', 'super_admin', 'operator'].includes(req.user.role);

    const ticket = await SupportTicket.findById(id)
      .populate('user', 'username firstName lastName email')
      .populate('assignedTo', 'username')
      .populate('responses.user', 'username firstName lastName email role');

    if (!ticket) {
      return res.status(404).json({ message: 'Destek talebi bulunamadı' });
    }

    // Check if user has access (owner or admin)
    if (!isAdmin && ticket.user._id.toString() !== userId) {
      return res.status(403).json({ message: 'Bu destek talebine erişim yetkiniz yok' });
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Respond to ticket
// @route   POST /api/support/tickets/:id/respond
// @access  Private
// -------------------------------------------
exports.respondToTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.role && ['admin', 'super_admin', 'operator'].includes(req.user.role);

    if (!message) {
      return res.status(400).json({ message: 'Mesaj gereklidir' });
    }

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({ message: 'Destek talebi bulunamadı' });
    }

    // Check if user has access
    if (!isAdmin && ticket.user.toString() !== userId) {
      return res.status(403).json({ message: 'Bu destek talebine yanıt verme yetkiniz yok' });
    }

    // Check if ticket is closed
    if (ticket.status === 'closed' || ticket.status === 'resolved') {
      return res.status(400).json({
        message: 'Bu destek talebi kapatılmış. Yeni yanıt eklenemez.',
      });
    }

    // Add response
    ticket.responses.push({
      user: userId,
      message,
      isAdmin,
    });

    // Update status
    if (ticket.status === 'open' && isAdmin) {
      ticket.status = 'in_progress';
      if (!ticket.assignedTo) {
        ticket.assignedTo = userId;
      }
    }

    ticket.lastResponseAt = new Date();
    await ticket.save();

    // Populate response user info
    await ticket.populate('responses.user', 'username firstName lastName email role');

    res.json({
      message: 'Yanıt eklendi',
      ticket,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Update ticket status
// @route   PUT /api/support/tickets/:id/status
// @access  Private (Admin only)
// -------------------------------------------
exports.updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo } = req.body;
    const userId = req.user.id;

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({ message: 'Destek talebi bulunamadı' });
    }

    // Update status
    if (status) {
      const validStatuses = ['open', 'in_progress', 'closed', 'resolved'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Geçersiz durum' });
      }

      ticket.status = status;

      if (status === 'closed' || status === 'resolved') {
        if (status === 'closed') {
          ticket.closedAt = new Date();
        } else {
          ticket.resolvedAt = new Date();
        }
      }
    }

    // Update assignment
    if (assignedTo !== undefined) {
      ticket.assignedTo = assignedTo || null;
    }

    await ticket.save();

    res.json({
      message: 'Destek talebi güncellendi',
      ticket,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get all tickets (Admin)
// @route   GET /api/support/tickets
// @access  Private (Admin only)
// -------------------------------------------
exports.getAllTickets = async (req, res) => {
  try {
    const {
      status,
      category,
      priority,
      assignedTo,
      search,
      limit = 50,
      page = 1,
    } = req.query;

    const query = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Assigned to filter
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    // Search by user name, username, email, or subject
    if (search) {
      const users = await User.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');

      const userIds = users.map((u) => u._id);
      query.$or = [
        { user: { $in: userIds } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const tickets = await SupportTicket.find(query)
      .populate('user', 'username firstName lastName email')
      .populate('assignedTo', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SupportTicket.countDocuments(query);

    res.json({
      tickets,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Close ticket
// @route   POST /api/support/tickets/:id/close
// @access  Private (Admin only)
// -------------------------------------------
exports.closeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    const ticket = await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({ message: 'Destek talebi bulunamadı' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ message: 'Bu destek talebi zaten kapatılmış' });
    }

    ticket.status = 'closed';
    ticket.closedAt = new Date();

    // Add resolution message if provided
    if (resolution) {
      ticket.responses.push({
        user: req.user.id,
        message: `[Kapatıldı] ${resolution}`,
        isAdmin: true,
      });
    }

    await ticket.save();

    res.json({
      message: 'Destek talebi kapatıldı',
      ticket,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get ticket statistics (Admin)
// @route   GET /api/support/statistics
// @access  Private (Admin only)
// -------------------------------------------
exports.getTicketStatistics = async (req, res) => {
  try {
    const stats = {
      total: await SupportTicket.countDocuments(),
      open: await SupportTicket.countDocuments({ status: 'open' }),
      inProgress: await SupportTicket.countDocuments({ status: 'in_progress' }),
      closed: await SupportTicket.countDocuments({ status: 'closed' }),
      resolved: await SupportTicket.countDocuments({ status: 'resolved' }),
      byCategory: {},
      byPriority: {},
    };

    // Count by category
    const categories = ['general', 'deposit', 'withdrawal', 'betting', 'technical', 'account', 'other'];
    for (const category of categories) {
      stats.byCategory[category] = await SupportTicket.countDocuments({ category });
    }

    // Count by priority
    const priorities = ['low', 'medium', 'high', 'urgent'];
    for (const priority of priorities) {
      stats.byPriority[priority] = await SupportTicket.countDocuments({ priority });
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

