/**
 * Comprehensive API Testing Script
 * Tests all API routes to verify they're properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('\n=== Testing All API Routes ===\n');

const routesDir = path.join(__dirname, 'routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

const apiTests = {
  passed: 0,
  failed: 0,
  errors: []
};

// Route mapping from server.js
const routeMappings = {
  'auth.routes.js': '/api/auth',
  'user.routes.js': '/api/users',
  'transaction.routes.js': '/api/transactions',
  'game.routes.js': '/api/games',
  'payment.routes.js': '/api/payment',
  'match.routes.js': '/api/matches',
  'bonus.routes.js': '/api/bonus',
  'support.routes.js': '/api/support',
  'report.routes.js': '/api/reports',
  'kyc.routes.js': '/api/user/kyc',
  'settings.routes.js': '/api/settings',
  'gameProvider.routes.js': '/api/games/provider',
  'admin.routes.js': '/api/admin',
  'notification.routes.js': '/api/notifications',
  'promotion.routes.js': '/api/promotions',
  'message.routes.js': '/api/messages',
  'tournament.routes.js': '/api/tournaments',
  'stats.routes.js': '/api/stats',
  'dashboard.routes.js': '/api/dashboard',
  'bet.routes.js': '/api/bets',
  'betRound.routes.js': '/api/bet-rounds',
  'iban.routes.js': '/api/ibans',
  'public.routes.js': '/api/public',
  'content.routes.js': '/api/content',
  'rapidapi.routes.js': '/api/rapidapi'
};

function testRouteFile(filename) {
  const filePath = path.join(routesDir, filename);
  const basePath = routeMappings[filename] || '/api/unknown';
  
  console.log(`\n📁 Testing: ${filename} (${basePath})`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      apiTests.failed++;
      apiTests.errors.push(`${filename}: File not found`);
      console.log('  ❌ File not found');
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if it exports router
    const hasRouter = content.includes('module.exports = router') || 
                     content.includes('module.exports') ||
                     content.includes('export default router');
    
    if (!hasRouter) {
      apiTests.failed++;
      apiTests.errors.push(`${filename}: No router export found`);
      console.log('  ❌ No router export');
      return;
    }
    
    // Count routes
    const getRoutes = (content.match(/router\.get\(/g) || []).length;
    const postRoutes = (content.match(/router\.post\(/g) || []).length;
    const putRoutes = (content.match(/router\.put\(/g) || []).length;
    const deleteRoutes = (content.match(/router\.delete\(/g) || []).length;
    const patchRoutes = (content.match(/router\.patch\(/g) || []).length;
    const totalRoutes = getRoutes + postRoutes + putRoutes + deleteRoutes + patchRoutes;
    
    // Check for middleware
    const hasAuthMiddleware = content.includes('authMiddleware');
    const hasAdminMiddleware = content.includes('adminMiddleware');
    
    // Extract route paths
    const routeMatches = content.match(/router\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g) || [];
    const routes = routeMatches.map(m => {
      const match = m.match(/router\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/);
      return match ? { method: match[1].toUpperCase(), path: match[2] } : null;
    }).filter(Boolean);
    
    console.log(`  ✓ File exists and exports router`);
    console.log(`  ✓ Routes: GET(${getRoutes}) POST(${postRoutes}) PUT(${putRoutes}) DELETE(${deleteRoutes}) PATCH(${patchRoutes}) = ${totalRoutes} total`);
    if (hasAuthMiddleware) console.log(`  ✓ Uses authMiddleware`);
    if (hasAdminMiddleware) console.log(`  ✓ Uses adminMiddleware`);
    
    if (routes.length > 0 && routes.length <= 10) {
      console.log(`  Routes:`);
      routes.forEach(r => {
        console.log(`    ${r.method} ${basePath}${r.path}`);
      });
    } else if (routes.length > 10) {
      console.log(`  Routes: (showing first 10 of ${routes.length})`);
      routes.slice(0, 10).forEach(r => {
        console.log(`    ${r.METHOD} ${basePath}${r.path}`);
      });
    }
    
    apiTests.passed++;
    return { filename, basePath, routes, totalRoutes, hasAuthMiddleware, hasAdminMiddleware };
    
  } catch (error) {
    apiTests.failed++;
    apiTests.errors.push(`${filename}: ${error.message}`);
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

// Test all route files
const routeResults = [];
routeFiles.forEach(file => {
  const result = testRouteFile(file);
  if (result) routeResults.push(result);
});

// Test server.js registration
console.log('\n📁 Testing: server.js (Route Registration)');
try {
  const serverPath = path.join(__dirname, 'server.js');
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  let allRegistered = true;
  Object.keys(routeMappings).forEach(routeFile => {
    const requirePathWithExt = `./routes/${routeFile}`;
    const requirePathNoExt = `./routes/${routeFile.replace(/\.js$/, '')}`;

    const hasRequire =
      serverContent.includes(`require('${requirePathWithExt}')`) ||
      serverContent.includes(`require(\"${requirePathWithExt}\")`) ||
      serverContent.includes(`require('${requirePathNoExt}')`) ||
      serverContent.includes(`require(\"${requirePathNoExt}\")`);

    if (!hasRequire) {
      console.log(`  ⚠️  ${routeFile} may not be registered in server.js`);
      allRegistered = false;
    }
  });
  
  if (allRegistered) {
    console.log('  ✓ All routes appear to be registered in server.js');
    apiTests.passed++;
  } else {
    apiTests.failed++;
  }
} catch (error) {
  console.log(`  ❌ Error checking server.js: ${error.message}`);
  apiTests.failed++;
}

// Summary
console.log('\n=== Test Summary ===');
console.log(`✅ Passed: ${apiTests.passed}`);
console.log(`❌ Failed: ${apiTests.failed}`);
console.log(`📊 Total Route Files: ${routeFiles.length}`);
console.log(`📊 Total Routes Found: ${routeResults.reduce((sum, r) => sum + (r?.totalRoutes || 0), 0)}`);

if (apiTests.errors.length > 0) {
  console.log('\n⚠️  Errors:');
  apiTests.errors.forEach(err => console.log(`  - ${err}`));
}

// Generate route summary
const routeSummary = routeResults.map(r => ({
  file: r.filename,
  basePath: r.basePath,
  totalRoutes: r.totalRoutes,
  requiresAuth: r.hasAuthMiddleware,
  requiresAdmin: r.hasAdminMiddleware
}));

// Save results
const resultsPath = path.join(__dirname, 'api-test-results.json');
fs.writeFileSync(resultsPath, JSON.stringify({
  summary: {
    passed: apiTests.passed,
    failed: apiTests.failed,
    totalFiles: routeFiles.length,
    totalRoutes: routeResults.reduce((sum, r) => sum + (r?.totalRoutes || 0), 0)
  },
  routes: routeSummary,
  errors: apiTests.errors
}, null, 2));

console.log(`\n📄 Detailed results saved to: api-test-results.json\n`);

if (apiTests.failed === 0) {
  console.log('✅ ALL ROUTE FILES PASSED!\n');
  process.exit(0);
} else {
  console.log('⚠️  SOME ISSUES FOUND - Please review errors above\n');
  process.exit(1);
}

