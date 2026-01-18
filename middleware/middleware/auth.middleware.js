
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { AppError, asyncHandler } = require('./error.middleware');

const authMiddleware = asyncHandler(async (req, res, next) => {
  // Validate JWT_SECRET is set
  if (!process.env.JWT_SECRET) {
    throw new AppError('Server configuration error: JWT_SECRET not set', 500);
  }

  // 1️⃣ Get token from Authorization header (primary method for production)
  let token = null;
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Fallback to httpOnly cookie (for backward compatibility)
  if (!token) {
    token = req.cookies?.accessToken;
  }

  if (!token) {
    throw new AppError('No access token found', 401);
  }

  // 2️⃣ Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const error = new AppError('Token expired', 401);
      error.code = 'TOKEN_EXPIRED';
      throw error;
    }
    if (err.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token', 401);
    }
    throw new AppError('Token verification failed', 401);
  }

  // 3️⃣ Fetch user from DB
  const user = await User.findById(decoded.id).select('-password -__v');
  if (!user) {
    throw new AppError('User not found', 404);
  }
  
  if (user.status === 'banned') {
    throw new AppError('Account banned', 403);
  }
  
  if (user.status === 'self_excluded') {
    throw new AppError('Self exclusion active', 403);
  }

  // 4️⃣ Attach user to request
  req.user = user;

  next();
});

module.exports = authMiddleware;
