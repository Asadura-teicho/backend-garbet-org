/**
 * Route Testing Utility
 * Tests all routes for cookie-based authentication compatibility
 * Run with: node utils/routeTester.js
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test123456';

// Track results
const results = {
  passed: [],
  failed: [],
  skipped: []
};

/**
 * Test authentication flow
 */
async function testAuth() {
  console.log('\n🔐 Testing Authentication Routes...\n');

  try {
    // ---------------------------------------------
    // 1) Register a fresh user (self-contained test)
    // ---------------------------------------------
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = TEST_PASSWORD;

    console.log('Testing POST /api/auth/register...');
    const registerRes = await axios.post(
      `${API_URL}/auth/register`,
      {
        username: `test_${Date.now()}`,
        firstName: 'Test',
        lastName: 'User',
        email: testEmail,
        phone: '1234567890',
        password: testPassword,
        confirmPassword: testPassword,
        currency: 'TRY',
        is18Plus: true,
        termsAccepted: true,
        kvkkAccepted: true,
      },
      {
        withCredentials: true,
        validateStatus: () => true, // Don't throw on any status
      }
    );

    const registerCookies = registerRes.headers['set-cookie'];

    if (registerRes.status === 201) {
      console.log('✅ Register: PASSED');
      results.passed.push('POST /api/auth/register');

      if (registerCookies && registerCookies.some((c) => c.includes('accessToken'))) {
        console.log('✅ Cookies set correctly (register)');
      } else {
        console.log('⚠️  Warning: No accessToken cookie found on register');
      }
    } else {
      console.log(`❌ Register: FAILED (${registerRes.status})`);
      results.failed.push('POST /api/auth/register');
      return null;
    }

    // ---------------------------------------------
    // 2) Logout to ensure the next step truly tests login
    // ---------------------------------------------
    console.log('\nTesting POST /api/auth/logout (after register)...');
    await axios.post(
      `${API_URL}/auth/logout`,
      {},
      {
        withCredentials: true,
        headers: {
          Cookie: registerCookies ? registerCookies.join('; ') : '',
        },
        validateStatus: () => true,
      }
    );

    // ---------------------------------------------
    // 3) Login using the newly registered user
    // ---------------------------------------------
    console.log('\nTesting POST /api/auth/login...');
    const loginRes = await axios.post(
      `${API_URL}/auth/login`,
      {
        email: testEmail,
        password: testPassword,
      },
      {
        withCredentials: true,
        validateStatus: () => true,
      }
    );

    if (loginRes.status === 200) {
      console.log('✅ Login: PASSED');
      results.passed.push('POST /api/auth/login');

      const loginCookies = loginRes.headers['set-cookie'];
      if (loginCookies && loginCookies.some((c) => c.includes('accessToken'))) {
        console.log('✅ Cookies set correctly (login)');
        return loginCookies; // Return cookies for protected-route tests
      }

      console.log('⚠️  Warning: No accessToken cookie found on login');
      return null;
    }

    console.log(`❌ Login: FAILED (${loginRes.status})`);
    results.failed.push('POST /api/auth/login');
    return null;
  } catch (error) {
    console.log(`❌ Auth test error: ${error.message}`);
    results.failed.push('Authentication flow');
    return null;
  }
}

/**
 * Test protected route with cookies
 */
async function testProtectedRoute(cookies, route, method = 'GET') {
  try {
    const config = {
      method: method.toLowerCase(),
      url: `${API_URL}${route}`,
      withCredentials: true,
      headers: {
        Cookie: cookies ? cookies.join('; ') : ''
      },
      validateStatus: () => true
    };

    const res = await axios(config);

    if (res.status === 200 || res.status === 201) {
      console.log(`✅ ${method} ${route}: PASSED`);
      results.passed.push(`${method} ${route}`);
      return true;
    } else if (res.status === 401) {
      console.log(`❌ ${method} ${route}: FAILED - Unauthorized (cookies not working)`);
      results.failed.push(`${method} ${route}`);
      return false;
    } else if (res.status === 403) {
      console.log(`⚠️  ${method} ${route}: SKIPPED - Forbidden (may need admin role)`);
      results.skipped.push(`${method} ${route}`);
      return false;
    } else {
      console.log(`⚠️  ${method} ${route}: Status ${res.status}`);
      results.skipped.push(`${method} ${route}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${method} ${route}: ERROR - ${error.message}`);
    results.failed.push(`${method} ${route}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Route Testing Utility\n');
  console.log(`API URL: ${API_URL}\n`);

  // Test authentication
  const cookies = await testAuth();

  if (!cookies) {
    console.log('\n⚠️  Could not get authentication cookies. Skipping protected route tests.');
    printResults();
    return;
  }

  // Test protected routes
  console.log('\n🔒 Testing Protected Routes...\n');

  const protectedRoutes = [
    { route: '/auth/me', method: 'GET' },
    { route: '/dashboard/stats', method: 'GET' },
    { route: '/payment/iban-info', method: 'GET' },
    { route: '/bonus/my-bonuses', method: 'GET' },
    { route: '/support/my-tickets', method: 'GET' },
  ];

  for (const route of protectedRoutes) {
    await testProtectedRoute(cookies, route.route, route.method);
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
  }

  // Test logout
  console.log('\n🔓 Testing Logout...\n');
  await testProtectedRoute(cookies, '/auth/logout', 'POST');

  printResults();
}

/**
 * Print test results summary
 */
function printResults() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY\n');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Skipped: ${results.skipped.length}`);
  console.log('='.repeat(50));

  if (results.failed.length > 0) {
    console.log('\n❌ Failed Routes:');
    results.failed.forEach(route => console.log(`  - ${route}`));
  }

  if (results.passed.length > 0) {
    console.log('\n✅ Passed Routes:');
    results.passed.forEach(route => console.log(`  - ${route}`));
  }

  console.log('\n');
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testAuth, testProtectedRoute };

