/**
 * Production Readiness Checker
 * Validates environment configuration for production deployment
 * Run with: node utils/productionCheck.js
 */

require('dotenv').config();

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

function check(name, condition, message, isWarning = false) {
  if (condition) {
    checks.passed.push({ name, message });
    console.log(`✅ ${name}: ${message}`.green);
  } else {
    if (isWarning) {
      checks.warnings.push({ name, message });
      console.log(`⚠️  ${name}: ${message}`.yellow);
    } else {
      checks.failed.push({ name, message });
      console.log(`❌ ${name}: ${message}`.red);
    }
  }
}

function runChecks() {
  console.log('\n🔍 Production Readiness Check\n'.cyan.bold);
  console.log('='.repeat(60).gray);

  // Environment
  console.log('\n📋 Environment Configuration\n'.cyan);
  check(
    'NODE_ENV',
    process.env.NODE_ENV === 'production',
    `Current: ${process.env.NODE_ENV || 'not set'} (should be 'production')`,
    process.env.NODE_ENV !== 'production'
  );

  // Database
  console.log('\n💾 Database Configuration\n'.cyan);
  check(
    'MONGODB_URI',
    !!process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('localhost'),
    'MongoDB URI is set and not using localhost',
    process.env.MONGODB_URI?.includes('localhost')
  );

  // Security
  console.log('\n🔐 Security Configuration\n'.cyan);
  check(
    'JWT_SECRET',
    !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32,
    `JWT_SECRET is set and ${process.env.JWT_SECRET?.length || 0} characters (min 32)`,
    !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32
  );

  check(
    'JWT_SECRET',
    process.env.JWT_SECRET !== 'your_super_secret_jwt_key_change_this_in_production',
    'JWT_SECRET is not using default value',
    process.env.JWT_SECRET === 'your_super_secret_jwt_key_change_this_in_production'
  );

  check(
    'ADMIN_REGISTRATION_CODE',
    !!process.env.ADMIN_REGISTRATION_CODE && process.env.ADMIN_REGISTRATION_CODE !== 'ADMIN_SECRET_2024',
    'ADMIN_REGISTRATION_CODE is set and not using default',
    process.env.ADMIN_REGISTRATION_CODE === 'ADMIN_SECRET_2024'
  );

  // Frontend URLs
  console.log('\n🌐 Frontend Configuration\n'.cyan);
  check(
    'FRONTEND_URL',
    !!process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost'),
    `FRONTEND_URL: ${process.env.FRONTEND_URL || 'not set'}`,
    !process.env.FRONTEND_URL || process.env.FRONTEND_URL.includes('localhost')
  );

  check(
    'FRONTEND_ORIGIN',
    !!process.env.FRONTEND_ORIGIN && !process.env.FRONTEND_ORIGIN.includes('localhost'),
    `FRONTEND_ORIGIN: ${process.env.FRONTEND_ORIGIN || 'not set'}`,
    !process.env.FRONTEND_ORIGIN || process.env.FRONTEND_ORIGIN.includes('localhost')
  );

  // Email Configuration
  console.log('\n📧 Email Configuration\n'.cyan);
  check(
    'SMTP_HOST',
    !!process.env.SMTP_HOST,
    `SMTP_HOST: ${process.env.SMTP_HOST || 'not set'}`
  );

  check(
    'SMTP_USER',
    !!process.env.SMTP_USER,
    `SMTP_USER: ${process.env.SMTP_USER || 'not set'}`
  );

  check(
    'SMTP_PASS',
    !!process.env.SMTP_PASS,
    'SMTP_PASS is set',
    !process.env.SMTP_PASS
  );

  check(
    'EMAIL_FROM',
    !!process.env.EMAIL_FROM,
    `EMAIL_FROM: ${process.env.EMAIL_FROM || 'not set'}`
  );

  // Cookie Configuration
  console.log('\n🍪 Cookie Configuration\n'.cyan);
  check(
    'Cookie Domain',
    !process.env.COOKIE_DOMAIN || process.env.COOKIE_DOMAIN.startsWith('.'),
    'COOKIE_DOMAIN should start with dot (e.g., .yourdomain.com) or be empty',
    process.env.COOKIE_DOMAIN && !process.env.COOKIE_DOMAIN.startsWith('.')
  );

  // Port Configuration
  console.log('\n🔌 Server Configuration\n'.cyan);
  check(
    'PORT',
    !!process.env.PORT,
    `PORT: ${process.env.PORT || 'not set (will use 5000)'}`,
    !process.env.PORT
  );

  // RapidAPI (Optional)
  console.log('\n🎮 Game Integration (Optional)\n'.cyan);
  check(
    'RAPIDAPI_KEY',
    !!process.env.RAPIDAPI_KEY,
    'RAPIDAPI_KEY is set (optional for game integration)',
    true
  );

  // Summary
  console.log('\n' + '='.repeat(60).gray);
  console.log('\n📊 Summary\n'.cyan.bold);
  console.log(`✅ Passed: ${checks.passed.length}`.green);
  console.log(`⚠️  Warnings: ${checks.warnings.length}`.yellow);
  console.log(`❌ Failed: ${checks.failed.length}`.red);

  if (checks.failed.length > 0) {
    console.log('\n❌ Critical Issues (Must Fix):\n'.red.bold);
    checks.failed.forEach(item => {
      console.log(`  - ${item.name}: ${item.message}`.red);
    });
  }

  if (checks.warnings.length > 0) {
    console.log('\n⚠️  Warnings (Should Fix):\n'.yellow.bold);
    checks.warnings.forEach(item => {
      console.log(`  - ${item.name}: ${item.message}`.yellow);
    });
  }

  if (checks.failed.length === 0 && checks.warnings.length === 0) {
    console.log('\n🎉 All checks passed! Ready for production.'.green.bold);
  } else if (checks.failed.length === 0) {
    console.log('\n✅ No critical issues. Review warnings before deployment.'.green);
  } else {
    console.log('\n⚠️  Please fix critical issues before deploying.'.red.bold);
    process.exit(1);
  }

  console.log('\n');
}

// Run if executed directly
if (require.main === module) {
  // Try to load colors if available
  try {
    require('colors');
  } catch (e) {
    // Colors not installed, continue without colors
  }
  runChecks();
}

module.exports = { runChecks, checks };

