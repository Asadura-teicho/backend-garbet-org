const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const listEndpoints = require('express-list-endpoints');
const swaggerUi = require('swagger-ui-express');
const swaggerFile = require('./swagger-output.json');
const cookieParser = require('cookie-parser');
const path = require('path');
const adminRoutes = require('./routes/admin.routes');

// Load environment variables
dotenv.config();
 
// Connect to database
connectDB();

const app = express();
app.set("trust proxy", 1);

// Security headers
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "script-src 'self' 'unsafe-eval' 'unsafe-inline';");
  next();
});
// Build allowed origins from environment variables
const allowedOrigins = [];

// Add production frontend URL from environment
if (process.env.FRONTEND_URL) {
  const frontendUrl = process.env.FRONTEND_URL.trim().replace(/\/+$/, '');
  if (frontendUrl) {
    allowedOrigins.push(frontendUrl);
    // Also add with www prefix if not present (and vice versa)
    if (!frontendUrl.includes('www.')) {
      const withWww = frontendUrl.replace(/^(https?:\/\/)/, '$1www.');
      allowedOrigins.push(withWww);
    } else {
      const withoutWww = frontendUrl.replace(/^(https?:\/\/)www\./, '$1');
      allowedOrigins.push(withoutWww);
    }
  }
}

// Add additional allowed origins from environment (comma-separated)
if (process.env.ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(origin => origin.length > 0);
  allowedOrigins.push(...additionalOrigins);
}

// Log configured origins on startup
if (allowedOrigins.length > 0) {
  console.log('✅ CORS configured with origins:', allowedOrigins.join(', '));
} else {
  console.warn('⚠️  No CORS origins configured. Set FRONTEND_URL or ALLOWED_ORIGINS environment variable.');
}

// In development, add default localhost ports
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:3002');
}

// Validate JWT_SECRET in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    console.error('❌ ERROR: JWT_SECRET is required in production!');
    process.exit(1);
  }
  if (process.env.JWT_SECRET.length < 32) {
    console.error('❌ ERROR: JWT_SECRET must be at least 32 characters in production!');
    process.exit(1);
  }
  if (process.env.JWT_SECRET === 'your_super_secret_jwt_key_change_this_in_production') {
    console.error('❌ ERROR: JWT_SECRET must be changed from default value in production!');
    process.exit(1);
  }
}

// CORS configuration function
const corsOptions = {
  origin: function(origin, callback) {
    // allow requests with no origin (like Postman, mobile apps, server-to-server)
    if (!origin) {
      console.log('📥 Request with no origin (server-to-server or tool)');
      return callback(null, true);
    }

    // Normalize origin - remove trailing slash and ensure proper format
    const normalizedOrigin = origin.replace(/\/+$/, '');
    
    // Log incoming origin for debugging (always log in production for CORS issues)
    console.log(`🌐 CORS check for origin: ${normalizedOrigin}`);
    console.log(`📋 Allowed origins: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : 'NONE (allowing all)'}`);

    // In development, allow any localhost port
    if (process.env.NODE_ENV === 'development') {
      if (normalizedOrigin.startsWith('http://localhost:') || normalizedOrigin.startsWith('http://127.0.0.1:')) {
        console.log(`✅ CORS allowed (localhost): ${normalizedOrigin}`);
        return callback(null, true);
      }
    }

    // Normalize allowed origins for comparison (remove trailing slashes)
    const normalizedAllowedOrigins = allowedOrigins.map(orig => orig.replace(/\/+$/, ''));

    // In production, check against allowed origins
    if (process.env.NODE_ENV === 'production') {
      if (normalizedAllowedOrigins.length === 0) {
        // If no origins configured, allow all with strong warning (TEMPORARY - should be fixed)
        console.warn('⚠️  WARNING: No allowed origins configured! Allowing all origins temporarily.');
        console.warn('⚠️  SECURITY RISK: Set FRONTEND_URL or ALLOWED_ORIGINS in environment variables!');
        console.warn(`⚠️  Allowing origin: ${normalizedOrigin}`);
        return callback(null, true);
      }
      
      // Check exact match first
      if (normalizedAllowedOrigins.indexOf(normalizedOrigin) !== -1) {
        console.log(`✅ CORS allowed origin (exact match): ${normalizedOrigin}`);
        return callback(null, true);
      }
      
      // Also check if origin matches any allowed origin (handles www vs non-www, http vs https)
      const originMatches = normalizedAllowedOrigins.some(allowed => {
        // Exact match
        if (allowed === normalizedOrigin) return true;
        // Check if origin is a subdomain or matches domain pattern
        try {
          const originUrl = new URL(normalizedOrigin);
          const allowedUrl = new URL(allowed);
          // Match same domain (with or without www)
          if (originUrl.hostname === allowedUrl.hostname) return true;
          // Match domain without www prefix
          if (originUrl.hostname.replace(/^www\./, '') === allowedUrl.hostname.replace(/^www\./, '')) return true;
        } catch (e) {
          // Invalid URL, skip
        }
        return false;
      });
      
      if (originMatches) {
        console.log(`✅ CORS allowed origin (domain match): ${normalizedOrigin}`);
        return callback(null, true);
      }
      
      // Origin not allowed
      console.warn(`🚫 CORS blocked origin: ${normalizedOrigin}`);
      console.warn(`📋 Allowed origins: ${normalizedAllowedOrigins.join(', ')}`);
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    } else {
      // In development, check against allowed origins but be more permissive
      if (normalizedAllowedOrigins.length > 0 && normalizedAllowedOrigins.indexOf(normalizedOrigin) === -1) {
        console.warn(`⚠️  Origin not in allowed list: ${normalizedOrigin}`);
        console.warn(`📋 Allowed origins: ${normalizedAllowedOrigins.join(', ')}`);
        // In development, still allow but warn
        console.log(`✅ CORS allowed (dev mode): ${normalizedOrigin}`);
        return callback(null, true);
      }
      console.log(`✅ CORS allowed origin: ${normalizedOrigin}`);
    }

    return callback(null, true);
  },
  credentials: true, // allow cookies (still needed for some endpoints)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours for preflight cache
  preflightContinue: false, // Let CORS handle preflight
  optionsSuccessStatus: 200 // Some legacy browsers (IE11) choke on 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Explicitly handle preflight requests (OPTIONS) - this ensures they're handled correctly
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());


// =====================
// Routes
// =====================
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/admin', adminRoutes); // Important for KYC
app.use('/api/user/kyc', require('./routes/kyc.routes'));
app.use('/api/transactions', require('./routes/transaction.routes'));
app.use('/api/games', require('./routes/game.routes'));
app.use('/api/payment', require('./routes/payment.routes'));
app.use('/api/sweet-bonanza', require('./routes/sweetBonanza.routes'));
app.use('/api/matches', require('./routes/match.routes'));
app.use('/api/bonus', require('./routes/bonus.routes'));
app.use('/api/support', require('./routes/support.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/user/kyc', require('./routes/kyc.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/games/provider', require('./routes/gameProvider.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/promotions', require('./routes/promotion.routes'));
app.use('/api/messages', require('./routes/message.routes'));
app.use('/api/tournaments', require('./routes/tournament.routes'));
app.use('/api/stats', require('./routes/stats.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/bets', require('./routes/bet.routes'));
app.use('/api/bet-rounds', require('./routes/betRound.routes'));
app.use('/api/ibans', require('./routes/iban.routes'));
app.use('/api/public', require('./routes/public.routes')); // Public endpoints (no auth)
app.use('/api/content', require('./routes/content.routes'));
app.use('/api/rapidapi', require('./routes/rapidapi.routes'));
app.use('/api/dice-roll-games', require('./routes/diceRollGame.routes'));
app.use('/api/dice-roll-bets', require('./routes/diceRollBet.routes'));
app.use('/api/financial', require('./routes/financial.routes'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    message: 'Server is running!',
    status: 'OK',
    database: 'Connected',
    timestamp: new Date().toISOString()
  });
});

// =====================
// Swagger UI
// =====================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// =====================
// List all routes in console
// =====================
console.log('API Routes:');
console.log(listEndpoints(app));

// =====================
// Error handling middleware
// =====================
const {
  errorHandler,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException,
} = require('./middleware/error.middleware');

// Handle 404 - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// Handle unhandled promise rejections
handleUnhandledRejection();

// Handle uncaught exceptions
handleUncaughtException();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
