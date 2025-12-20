const Settings = require('../models/Settings.model');
const { logAdminAction, getIpAddress, getUserAgent } = require('../utils/adminLogger');

// -------------------------------------------
// @desc    Get settings
// @route   GET /api/admin/settings
// @access  Private (Admin only)
// -------------------------------------------
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Update settings
// @route   PUT /api/admin/settings
// @access  Private (Admin only)
// -------------------------------------------
exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body;
    const adminId = req.user.id;

    // Get current settings
    const currentSettings = await Settings.getSettings();
    const before = { ...currentSettings.toObject() };

    // Update settings
    Object.keys(updates).forEach((key) => {
      if (currentSettings.schema.paths[key]) {
        currentSettings[key] = updates[key];
      }
    });

    await currentSettings.save();
    const after = { ...currentSettings.toObject() };

    // Log admin action
    await logAdminAction({
      adminId,
      action: 'global_settings_updated',
      targetType: 'settings',
      targetId: currentSettings._id,
      description: 'Global settings updated',
      before,
      after,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
      metadata: { updatedFields: Object.keys(updates) },
    });

    res.json({
      message: 'Ayarlar güncellendi',
      settings: currentSettings,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Get public settings (for users)
// @route   GET /api/settings/public
// @access  Public
// -------------------------------------------
exports.getPublicSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    // Only return public settings
    res.json({
      siteName: settings.siteName,
      currency: settings.currency,
      minDeposit: settings.minDeposit,
      maxDeposit: settings.maxDeposit,
      minWithdrawal: settings.minWithdrawal,
      maxWithdrawal: settings.maxWithdrawal,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

