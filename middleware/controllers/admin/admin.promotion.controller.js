/**
 * Admin Promotion Controller
 * Handles promotion management (CRUD operations)
 */

const Promotion = require('../../models/Promotion.model');
const { logAdminAction, getIpAddress, getUserAgent } = require('../../utils/adminLogger');

// -------------------------------------------
// @desc    Get all promotions (with filters and pagination)
// @route   GET /api/admin/promotions
// @access  Private (Admin only)
// -------------------------------------------
exports.getPromotions = async (req, res) => {
  try {
    const {
      search,
      type,
      status,
      limit = 20,
      page = 1,
    } = req.query;

    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Type filter
    if (type && type !== 'all') {
      query.type = type;
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    const promotions = await Promotion.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Promotion.countDocuments(query);

    res.json({
      promotions,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get promotion by ID
// @route   GET /api/admin/promotions/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.getPromotionById = async (req, res) => {
  try {
    const promotion = await Promotion.findById(req.params.id)
      .populate('eligibleUsers', 'username email')
      .populate('excludedUsers', 'username email');

    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    res.json(promotion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Create new promotion
// @route   POST /api/admin/promotions
// @access  Private (Admin only)
// -------------------------------------------
exports.createPromotion = async (req, res) => {
  try {
    const adminId = req.user.id;
    const {
      title,
      type,
      description,
      startDate,
      endDate,
      status,
      minDeposit,
      maxDeposit,
      bonusPercent,
      bonusAmount,
      maxBonus,
      rolloverMultiplier,
      eligibleUsers,
      excludedUsers,
      maxUses,
      maxUsesPerUser,
      bannerImage,
      termsAndConditions,
      isFeatured,
      priority,
    } = req.body;

    // Validate required fields
    if (!title || !type || !startDate || !endDate) {
      return res.status(400).json({
        message: 'Title, type, startDate, and endDate are required',
      });
    }

    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        message: 'End date must be after start date',
      });
    }

    // Create promotion
    const promotion = await Promotion.create({
      title,
      type,
      description: description || '',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: status || 'active',
      minDeposit: minDeposit || 0,
      maxDeposit: maxDeposit || null,
      bonusPercent: bonusPercent || 0,
      bonusAmount: bonusAmount || 0,
      maxBonus: maxBonus || null,
      rolloverMultiplier: rolloverMultiplier || 5,
      eligibleUsers: eligibleUsers || [],
      excludedUsers: excludedUsers || [],
      maxUses: maxUses || null,
      maxUsesPerUser: maxUsesPerUser || 1,
      bannerImage: bannerImage || null,
      termsAndConditions: termsAndConditions || '',
      isFeatured: isFeatured || false,
      priority: priority || 0,
    });

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'promotion_created',
      targetType: 'promotion',
      targetId: promotion._id,
      description: `Promotion "${title}" created`,
      after: promotion.toObject(),
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.status(201).json({
      message: 'Promotion created successfully',
      promotion,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Update promotion
// @route   PUT /api/admin/promotions/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.updatePromotion = async (req, res) => {
  try {
    const adminId = req.user.id;
    const promotionId = req.params.id;

    const promotion = await Promotion.findById(promotionId);

    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    const before = { ...promotion.toObject() };

    // Validate dates if provided
    if (req.body.startDate && req.body.endDate) {
      if (new Date(req.body.startDate) >= new Date(req.body.endDate)) {
        return res.status(400).json({
          message: 'End date must be after start date',
        });
      }
    }

    // Update fields
    const allowedFields = [
      'title',
      'type',
      'description',
      'startDate',
      'endDate',
      'status',
      'minDeposit',
      'maxDeposit',
      'bonusPercent',
      'bonusAmount',
      'maxBonus',
      'rolloverMultiplier',
      'eligibleUsers',
      'excludedUsers',
      'maxUses',
      'maxUsesPerUser',
      'bannerImage',
      'termsAndConditions',
      'isFeatured',
      'priority',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'startDate' || field === 'endDate') {
          promotion[field] = new Date(req.body[field]);
        } else {
          promotion[field] = req.body[field];
        }
      }
    });

    await promotion.save();
    const after = { ...promotion.toObject() };

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'promotion_updated',
      targetType: 'promotion',
      targetId: promotion._id,
      description: `Promotion "${promotion.title}" updated`,
      before,
      after,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
      metadata: { updatedFields: Object.keys(req.body) },
    });

    res.json({
      message: 'Promotion updated successfully',
      promotion,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Delete promotion
// @route   DELETE /api/admin/promotions/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.deletePromotion = async (req, res) => {
  try {
    const adminId = req.user.id;
    const promotionId = req.params.id;

    const promotion = await Promotion.findById(promotionId);

    if (!promotion) {
      return res.status(404).json({ message: 'Promotion not found' });
    }

    const before = { ...promotion.toObject() };

    await Promotion.findByIdAndDelete(promotionId);

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'promotion_deleted',
      targetType: 'promotion',
      targetId: promotionId,
      description: `Promotion "${promotion.title}" deleted`,
      before,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    });

    res.json({
      message: 'Promotion deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
