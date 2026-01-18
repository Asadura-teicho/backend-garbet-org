/**
 * Test Chunk 1-2: Model Structure Verification
 * Tests model files without database connection
 */

const fs = require('fs');
const path = require('path');

console.log('\n=== Testing Chunk 1-2: Model Structure ===\n');

// Test 1: Check if GameRound model file exists
console.log('Test 1: Checking GameRound model file...');
const gameRoundPath = path.join(__dirname, 'models', 'GameRound.model.js');
if (fs.existsSync(gameRoundPath)) {
  console.log('✓ GameRound.model.js exists');
  
  // Check file content for key components
  const gameRoundContent = fs.readFileSync(gameRoundPath, 'utf8');
  const hasRoundNumber = gameRoundContent.includes('roundNumber');
  const hasStatus = gameRoundContent.includes('status');
  const hasMultiplier = gameRoundContent.includes('multiplier');
  const hasGetCurrentRound = gameRoundContent.includes('getCurrentRound');
  const hasGetNextRoundNumber = gameRoundContent.includes('getNextRoundNumber');
  
  console.log(`  - Has roundNumber field: ${hasRoundNumber ? '✓' : '✗'}`);
  console.log(`  - Has status field: ${hasStatus ? '✓' : '✗'}`);
  console.log(`  - Has multiplier field: ${hasMultiplier ? '✓' : '✗'}`);
  console.log(`  - Has getCurrentRound method: ${hasGetCurrentRound ? '✓' : '✗'}`);
  console.log(`  - Has getNextRoundNumber method: ${hasGetNextRoundNumber ? '✓' : '✗'}`);
} else {
  console.log('✗ GameRound.model.js not found');
}

// Test 2: Check if BetRound model file exists
console.log('\nTest 2: Checking BetRound model file...');
const betRoundPath = path.join(__dirname, 'models', 'BetRound.model.js');
if (fs.existsSync(betRoundPath)) {
  console.log('✓ BetRound.model.js exists');
  
  // Check file content for gameRound field
  const betRoundContent = fs.readFileSync(betRoundPath, 'utf8');
  const hasGameRound = betRoundContent.includes('gameRound');
  const referencesGameRound = betRoundContent.includes("ref: 'GameRound'") || betRoundContent.includes('ref: "GameRound"');
  
  console.log(`  - Has gameRound field: ${hasGameRound ? '✓' : '✗'}`);
  console.log(`  - References GameRound model: ${referencesGameRound ? '✓' : '✗'}`);
} else {
  console.log('✗ BetRound.model.js not found');
}

// Test 3: Check service files
console.log('\nTest 3: Checking service files...');
const gameRoundServicePath = path.join(__dirname, 'services', 'gameRound.service.js');
const betRoundServicePath = path.join(__dirname, 'services', 'betRound.service.js');

if (fs.existsSync(gameRoundServicePath)) {
  console.log('✓ gameRound.service.js exists');
  const serviceContent = fs.readFileSync(gameRoundServicePath, 'utf8');
  const hasStartRound = serviceContent.includes('startRound');
  const hasCrashRound = serviceContent.includes('crashRound');
  const hasGetCurrentRound = serviceContent.includes('getCurrentRound');
  console.log(`  - Has startRound function: ${hasStartRound ? '✓' : '✗'}`);
  console.log(`  - Has crashRound function: ${hasCrashRound ? '✓' : '✗'}`);
  console.log(`  - Has getCurrentRound function: ${hasGetCurrentRound ? '✓' : '✗'}`);
} else {
  console.log('✗ gameRound.service.js not found');
}

if (fs.existsSync(betRoundServicePath)) {
  console.log('✓ betRound.service.js exists');
  const serviceContent = fs.readFileSync(betRoundServicePath, 'utf8');
  const hasGameRoundImport = serviceContent.includes('GameRound') || serviceContent.includes('gameRound.service');
  const hasProcessBetRound = serviceContent.includes('processBetRound');
  console.log(`  - References GameRound: ${hasGameRoundImport ? '✓' : '✗'}`);
  console.log(`  - Has processBetRound function: ${hasProcessBetRound ? '✓' : '✗'}`);
} else {
  console.log('✗ betRound.service.js not found');
}

// Test 4: Check controller files
console.log('\nTest 4: Checking controller files...');
const gameRoundControllerPath = path.join(__dirname, 'controllers', 'admin', 'admin.gameRound.controller.js');
if (fs.existsSync(gameRoundControllerPath)) {
  console.log('✓ admin.gameRound.controller.js exists');
  const controllerContent = fs.readFileSync(gameRoundControllerPath, 'utf8');
  const hasStartRound = controllerContent.includes('startRound');
  const hasCrashRound = controllerContent.includes('crashRound');
  const hasGetCurrentRound = controllerContent.includes('getCurrentRound');
  console.log(`  - Has startRound export: ${hasStartRound ? '✓' : '✗'}`);
  console.log(`  - Has crashRound export: ${hasCrashRound ? '✓' : '✗'}`);
  console.log(`  - Has getCurrentRound export: ${hasGetCurrentRound ? '✓' : '✗'}`);
} else {
  console.log('✗ admin.gameRound.controller.js not found');
}

// Test 5: Check routes
console.log('\nTest 5: Checking route files...');
const adminRoutesPath = path.join(__dirname, 'routes', 'admin.routes.js');
if (fs.existsSync(adminRoutesPath)) {
  console.log('✓ admin.routes.js exists');
  const routesContent = fs.readFileSync(adminRoutesPath, 'utf8');
  const hasGameRoundsRoute = routesContent.includes('game-rounds');
  const hasStartRoute = routesContent.includes('game-rounds/start');
  const hasCrashRoute = routesContent.includes('game-rounds/crash');
  console.log(`  - Has game-rounds routes: ${hasGameRoundsRoute ? '✓' : '✗'}`);
  console.log(`  - Has start route: ${hasStartRoute ? '✓' : '✗'}`);
  console.log(`  - Has crash route: ${hasCrashRoute ? '✓' : '✗'}`);
} else {
  console.log('✗ admin.routes.js not found');
}

const publicRoutesPath = path.join(__dirname, 'routes', 'public.routes.js');
if (fs.existsSync(publicRoutesPath)) {
  console.log('✓ public.routes.js exists');
  const routesContent = fs.readFileSync(publicRoutesPath, 'utf8');
  const hasIbansRoute = routesContent.includes('/ibans');
  console.log(`  - Has /ibans route: ${hasIbansRoute ? '✓' : '✗'}`);
} else {
  console.log('✗ public.routes.js not found');
}

// Test 6: Check IBAN controller
console.log('\nTest 6: Checking IBAN controller...');
const ibanControllerPath = path.join(__dirname, 'controllers', 'iban.controller.js');
if (fs.existsSync(ibanControllerPath)) {
  console.log('✓ iban.controller.js exists');
  const controllerContent = fs.readFileSync(ibanControllerPath, 'utf8');
  const hasGetActiveIbans = controllerContent.includes('getActiveIbans');
  console.log(`  - Has getActiveIbans function: ${hasGetActiveIbans ? '✓' : '✗'}`);
} else {
  console.log('✗ iban.controller.js not found');
}

console.log('\n=== Structure Test Complete ===\n');
console.log('Note: This test only verifies file structure.');
console.log('For full functionality testing, run with database connection.\n');


