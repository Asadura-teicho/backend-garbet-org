const User = require('../models/User.model');
const { AppError, asyncHandler } = require('./error.middleware');

// Middleware to check if user is admin
const adminMiddleware = asyncHandler(async (req, res, next) => {
  // Auth middleware should already attach req.user
  if (!req.user || !req.user.id) {
    throw new AppError('Unauthorized', 401);
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const adminRoles = ['admin', 'super_admin', 'operator'];
  if (!adminRoles.includes(user.role)) {
    throw new AppError('Access denied. Admin role required.', 403);
  }

  req.adminUser = user; // attach full admin object
  next();
});

module.exports = adminMiddleware;
