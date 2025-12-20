/**
 * IBAN Controller (Admin + Public)
 * Handles IBAN management operations
 */

const Iban = require('../models/Iban.model');

// -------------------------------------------
// @desc    Get all IBANs
// @route   GET /api/ibans
// @access  Private (Admin only)
// -------------------------------------------
exports.getIbans = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 50 } = req.query;

    const query = {};

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get IBANs
    const ibans = await Iban.find(query)
      .populate('addedBy', 'username email firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count
    const total = await Iban.countDocuments(query);

    // Format response
    const formattedIbans = ibans.map((iban) => ({
      id: iban._id,
      bankName: iban.bankName,
      accountHolder: iban.accountHolder,
      ibanNumber: iban.ibanNumber,
      isActive: iban.isActive,
      addedBy: iban.addedBy
        ? {
            id: iban.addedBy._id,
            username: iban.addedBy.username,
            email: iban.addedBy.email,
            name: `${iban.addedBy.firstName || ''} ${iban.addedBy.lastName || ''}`.trim(),
          }
        : null,
      createdAt: iban.createdAt,
      updatedAt: iban.updatedAt,
    }));

    res.json({
      ibans: formattedIbans,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get IBANs error:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch IBANs',
    });
  }
};

// -------------------------------------------
// @desc    Get IBAN by ID
// @route   GET /api/ibans/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.getIbanById = async (req, res) => {
  try {
    const { id } = req.params;

    const iban = await Iban.findById(id)
      .populate('addedBy', 'username email firstName lastName')
      .lean();

    if (!iban) {
      return res.status(404).json({
        message: 'IBAN not found',
      });
    }

    res.json({
      iban: {
        id: iban._id,
        bankName: iban.bankName,
        accountHolder: iban.accountHolder,
        ibanNumber: iban.ibanNumber,
        isActive: iban.isActive,
        addedBy: iban.addedBy
          ? {
              id: iban.addedBy._id,
              username: iban.addedBy.username,
              email: iban.addedBy.email,
              name: `${iban.addedBy.firstName || ''} ${iban.addedBy.lastName || ''}`.trim(),
            }
          : null,
        createdAt: iban.createdAt,
        updatedAt: iban.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get IBAN by ID error:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch IBAN',
    });
  }
};

// -------------------------------------------
// @desc    Create new IBAN
// @route   POST /api/ibans
// @access  Private (Admin only)
// -------------------------------------------
exports.createIban = async (req, res) => {
  try {
    const { bankName, accountHolder, ibanNumber, isActive } = req.body;
    const adminId = req.user.id;

    // Validation
    if (!bankName || !accountHolder || !ibanNumber) {
      return res.status(400).json({
        message: 'Missing required fields: bankName, accountHolder, ibanNumber',
      });
    }

    // Check if IBAN already exists
    const existingIban = await Iban.findOne({ ibanNumber: ibanNumber.trim() });
    if (existingIban) {
      return res.status(400).json({
        message: 'IBAN number already exists',
      });
    }

    // Create IBAN
    const iban = await Iban.create({
      bankName: bankName.trim(),
      accountHolder: accountHolder.trim(),
      ibanNumber: ibanNumber.trim(),
      isActive: isActive !== undefined ? isActive : true,
      addedBy: adminId,
    });

    res.status(201).json({
      message: 'IBAN created successfully',
      iban: {
        id: iban._id,
        bankName: iban.bankName,
        accountHolder: iban.accountHolder,
        ibanNumber: iban.ibanNumber,
        isActive: iban.isActive,
        createdAt: iban.createdAt,
      },
    });
  } catch (error) {
    console.error('Create IBAN error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'IBAN number already exists',
      });
    }

    res.status(500).json({
      message: error.message || 'Failed to create IBAN',
    });
  }
};

// -------------------------------------------
// @desc    Update IBAN
// @route   PUT /api/ibans/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.updateIban = async (req, res) => {
  try {
    const { id } = req.params;
    const { bankName, accountHolder, ibanNumber, isActive } = req.body;

    const iban = await Iban.findById(id);

    if (!iban) {
      return res.status(404).json({
        message: 'IBAN not found',
      });
    }

    // Check if IBAN number is being changed and if it already exists
    if (ibanNumber && ibanNumber.trim() !== iban.ibanNumber) {
      const existingIban = await Iban.findOne({ ibanNumber: ibanNumber.trim() });
      if (existingIban) {
        return res.status(400).json({
          message: 'IBAN number already exists',
        });
      }
      iban.ibanNumber = ibanNumber.trim();
    }

    // Update fields
    if (bankName !== undefined) {
      iban.bankName = bankName.trim();
    }
    if (accountHolder !== undefined) {
      iban.accountHolder = accountHolder.trim();
    }
    if (isActive !== undefined) {
      iban.isActive = isActive;
    }

    await iban.save();

    res.json({
      message: 'IBAN updated successfully',
      iban: {
        id: iban._id,
        bankName: iban.bankName,
        accountHolder: iban.accountHolder,
        ibanNumber: iban.ibanNumber,
        isActive: iban.isActive,
        updatedAt: iban.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update IBAN error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'IBAN number already exists',
      });
    }

    res.status(500).json({
      message: error.message || 'Failed to update IBAN',
    });
  }
};

// -------------------------------------------
// @desc    Delete IBAN
// @route   DELETE /api/ibans/:id
// @access  Private (Admin only)
// -------------------------------------------
exports.deleteIban = async (req, res) => {
  try {
    const { id } = req.params;

    const iban = await Iban.findById(id);

    if (!iban) {
      return res.status(404).json({
        message: 'IBAN not found',
      });
    }

    await Iban.findByIdAndDelete(id);

    res.json({
      message: 'IBAN deleted successfully',
    });
  } catch (error) {
    console.error('Delete IBAN error:', error);
    res.status(500).json({
      message: error.message || 'Failed to delete IBAN',
    });
  }
};

// -------------------------------------------
// @desc    Toggle IBAN active status
// @route   PUT /api/ibans/:id/toggle
// @access  Private (Admin only)
// -------------------------------------------
exports.toggleIbanStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const iban = await Iban.findById(id);

    if (!iban) {
      return res.status(404).json({
        message: 'IBAN not found',
      });
    }

    // Toggle status
    iban.isActive = !iban.isActive;
    await iban.save();

    res.json({
      message: `IBAN ${iban.isActive ? 'activated' : 'deactivated'} successfully`,
      iban: {
        id: iban._id,
        isActive: iban.isActive,
        updatedAt: iban.updatedAt,
      },
    });
  } catch (error) {
    console.error('Toggle IBAN status error:', error);
    res.status(500).json({
      message: error.message || 'Failed to toggle IBAN status',
    });
  }
};

// -------------------------------------------
// @desc    Get active IBANs (Public)
// @route   GET /api/public/ibans
// @access  Public (No authentication required)
// -------------------------------------------
exports.getActiveIbans = async (req, res) => {
  try {
    // Get only active IBANs, no sensitive information
    const ibans = await Iban.find({ isActive: true })
      .select('bankName accountHolder ibanNumber')
      .sort({ createdAt: -1 })
      .lean();

    // Format response (no IDs, no admin info)
    const formattedIbans = ibans.map((iban) => ({
      bankName: iban.bankName,
      accountHolder: iban.accountHolder,
      ibanNumber: iban.ibanNumber,
    }));

    res.json({
      ibans: formattedIbans,
      count: formattedIbans.length,
    });
  } catch (error) {
    console.error('Get active IBANs error:', error);
    res.status(500).json({
      message: error.message || 'Failed to fetch IBANs',
    });
  }
};

