const AdminLog = require('../models/AdminLog.model');

/**
 * Log admin action 
 */
const logAdminAction = async (options) => {
  try {
    const {
      adminId,
      action,
      targetType = 'other',
      targetId = null,
      description,
      before = null,
      after = null,
      ipAddress = null,
      userAgent = null,
      metadata = {},
    } = options;

    if (!adminId || !action || !description) {
      console.error('Admin log: Missing required fields', options);
      return;
    }

    await AdminLog.create({
      admin: adminId,
      action,
      targetType,
      targetId,
      description,
      before,
      after,
      ipAddress,
      userAgent,
      metadata,
    });
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
};

/**
 * Get IP address from request
 */
const getIpAddress = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    'unknown'
  );
};

/**
 * Get user-agent from request
 */
const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

module.exports = {
  logAdminAction,
  getIpAddress,
  getUserAgent,
};
