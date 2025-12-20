const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User.model');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/emailService');

// -----------------------------
// TOKEN GENERATION
// -----------------------------
const generateAccessToken = (user) => {
  // Use environment variable for token expiration, default to 15m
  // In production, consider using shorter expiration (15m-1h)
  // In development, can use longer expiration for convenience
  const expiresIn = process.env.JWT_EXPIRES_IN || 
    (process.env.NODE_ENV === 'production' ? '15m' : '24h');
  
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      status: user.status
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      type: 'refresh'
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

const generateToken = (user) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user)
  };
};

// -----------------------------
// COOKIE HELPERS
// -----------------------------
const makeCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';

  // IMPORTANT:
  // - Do NOT set `domain` in local dev. Many browsers reject `Domain=localhost` cookies.
  // - In production, prefer setting COOKIE_DOMAIN explicitly if you need cross-subdomain cookies.
  const cookieOptions = {
    httpOnly: true,
    secure: isProd, // SameSite=None requires Secure in modern browsers
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };

  if (process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }

  return cookieOptions;
};

const setAuthCookies = (res, accessToken, refreshToken, isAdminFlag = 'false') => {
  const cookieOptions = makeCookieOptions();

  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000 // 15 min
  });

  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  res.cookie('isAdmin', isAdminFlag, {
    ...cookieOptions,
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
};

const clearAuthCookies = (res) => {
  const cookieOptions = makeCookieOptions();
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  res.clearCookie('isAdmin', cookieOptions);
};

// -----------------------------
// SANITIZE USER OBJECT
// -----------------------------
const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;
  let user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete user.password;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.__v;
  delete user.registrationCode;
  delete user.confirmPassword;
  return user;
};

// -------------------------------------------
// REGISTER
// -------------------------------------------
exports.register = async (req, res) => {
  try {
    const {
      username,
      firstName,
      lastName,
      email,
      phone,
      password,
      confirmPassword,
      is18Plus,
      termsAccepted,
      kvkkAccepted,
      role,
      registrationCode
    } = req.body;

    if (!username || !firstName || !lastName || !email || !phone || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!is18Plus || !termsAccepted || !kvkkAccepted) {
      return res.status(400).json({ message: 'Legal terms must be accepted' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ message: 'Email or username already in use' });

    // Role handling
    let userRole = 'user';
    if (role && ['admin', 'super_admin', 'operator'].includes(role)) {
      const validCode = process.env.ADMIN_REGISTRATION_CODE || 'ADMIN_SECRET_2024';
      if ((registrationCode || '').trim() !== validCode.trim()) {
        return res.status(403).json({ message: 'Invalid registration code for admin role' });
      }
      userRole = role;
    }

    const newUser = new User({
      username,
      firstName,
      lastName,
      email: email.toLowerCase().trim(),
      phone,
      password,
      role: userRole,
      status: 'active'
    });

    newUser.confirmPassword = confirmPassword;
    try {
  await newUser.save();
} catch (saveError) {
  if (saveError.message === "Passwords do not match") {
    return res.status(400).json({ message: "Passwords do not match" });
  }
  throw saveError; // Let the 500 block handle other database errors
}
// 2. TRY TO SEND EMAIL (Non-blocking, so it doesn't cause a 500 error)
    // Notice there is NO 'await' here.
    sendWelcomeEmail(newUser).catch(err => {
        console.error('📧 Email failed but user was created:', err.message);
    });
    // sendWelcomeEmail(newUser).catch(err => console.error('Welcome email error:', err));

    const tokens = generateToken(newUser);
    const isAdminFlag = ['admin', 'super_admin', 'operator'].includes(userRole) ? 'true' : 'false';
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, isAdminFlag);

    return res.status(201).json({
      token: tokens.accessToken,
      user: sanitizeUser(newUser),
      redirectPath: isAdminFlag === 'true' ? '/admin' : '/dashboard'
    });

  } catch (error) {
    // 1. Handle Duplicate Email/Username (409)
    if (error.code === 11000) {
      const dupKey = Object.keys(error.keyValue || {})[0] || 'field';
      return res.status(409).json({ message: `${dupKey} already in use` });
    }

    // 2. Handle Mongoose Validation Errors (400) - THIS IS THE FIX
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ message: messages.join(', ') });
    }

    // 3. Everything else (500)
    console.error("Registration Error:", error);
    return res.status(500).json({ message: error.message });
  }
}
// -------------------------------------------
// LOGIN
// -------------------------------------------
exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    email = email.toLowerCase().trim();
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.status === 'banned') return res.status(403).json({ message: 'Account banned' });
    if (user.status === 'self_excluded') return res.status(403).json({ message: 'Self exclusion active' });

    const tokens = generateToken(user);
    const isAdminFlag = ['admin', 'super_admin', 'operator'].includes(user.role) ? 'true' : 'false';
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, isAdminFlag);

    return res.json({
      token: tokens.accessToken,
      user: sanitizeUser(user),
      redirectPath: isAdminFlag === 'true' ? '/admin' : '/dashboard'
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// GET LOGGED-IN USER
// -------------------------------------------
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -__v');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// LOGOUT
// -------------------------------------------
exports.logout = (req, res) => {
  try {
    clearAuthCookies(res);
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// REFRESH TOKEN
// -------------------------------------------
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token found' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    if (decoded.type !== 'refresh') return res.status(401).json({ message: 'Invalid token type' });

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.status === 'banned') return res.status(403).json({ message: 'Account banned' });
    if (user.status === 'self_excluded') return res.status(403).json({ message: 'Self exclusion active' });

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const isAdminFlag = ['admin', 'super_admin', 'operator'].includes(user.role) ? 'true' : 'false';
    setAuthCookies(res, newAccessToken, newRefreshToken, isAdminFlag);

    return res.json({ message: 'Token refreshed' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
// -------------------------------------------
// @desc    Forgot password - generate reset token
// @route   POST /api/auth/forgot-password
// @access  Public
// -------------------------------------------
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });

    // Always return success to avoid leaking existence
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
      await user.save({ validateBeforeSave: false });

      try {
        await sendPasswordResetEmail(user, resetToken);
      } catch (emailError) {
        // rollback token on email failure
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        console.error('Password reset email error:', emailError);
        return res.status(500).json({ message: 'Email could not be sent. Please try again later.' });
      }
    }

    return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// -------------------------------------------
// @desc    Reset password with token
// @route   POST /api/auth/reset-password
// @access  Public
// -------------------------------------------
exports.resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Token, password and confirmPassword are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Password and confirm password do not match' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken');

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
