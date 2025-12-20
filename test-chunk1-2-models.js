/**
 * Test Chunk 1-2: GameRound and BetRound Models
 * Verify models are created correctly and linked properly
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/garbet');
    console.log('✓ MongoDB Connected');
  } catch (error) {
    console.error('✗ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

async function testModels() {
  console.log('\n=== Testing Chunk 1-2: Models ===\n');

  try {
    await connectDB();

    // Test 1: Import GameRound model
    console.log('Test 1: Importing GameRound model...');
    const GameRound = require('./models/GameRound.model.js');
    console.log('✓ GameRound model imported');

    // Test 2: Check GameRound schema fields
    console.log('\nTest 2: Checking GameRound schema fields...');
    const gameRoundFields = Object.keys(GameRound.schema.paths).filter(k => !k.startsWith('_'));
    const requiredFields = ['roundNumber', 'status', 'multiplier', 'totalBets', 'totalBetAmount', 'totalPlayers'];
    const hasAllFields = requiredFields.every(field => gameRoundFields.includes(field));
    console.log(`  Fields found: ${gameRoundFields.join(', ')}`);
    console.log(hasAllFields ? '✓ All required fields present' : '✗ Missing required fields');

    // Test 3: Check GameRound static methods
    console.log('\nTest 3: Checking GameRound static methods...');
    const staticMethods = Object.keys(GameRound.schema.statics);
    const hasGetCurrentRound = staticMethods.includes('getCurrentRound');
    const hasGetNextRoundNumber = staticMethods.includes('getNextRoundNumber');
    console.log(`  Static methods: ${staticMethods.join(', ')}`);
    console.log(hasGetCurrentRound && hasGetNextRoundNumber ? '✓ All static methods present' : '✗ Missing static methods');

    // Test 4: Import BetRound model
    console.log('\nTest 4: Importing BetRound model...');
    const BetRound = require('./models/BetRound.model.js');
    console.log('✓ BetRound model imported');

    // Test 5: Check BetRound has gameRound field
    console.log('\nTest 5: Checking BetRound has gameRound field...');
    const betRoundFields = Object.keys(BetRound.schema.paths).filter(k => !k.startsWith('_'));
    const hasGameRoundField = betRoundFields.includes('gameRound');
    console.log(`  Fields found: ${betRoundFields.join(', ')}`);
    console.log(hasGameRoundField ? '✓ gameRound field present' : '✗ gameRound field missing');

    // Test 6: Check gameRound field references GameRound
    console.log('\nTest 6: Checking gameRound field references...');
    const gameRoundPath = BetRound.schema.paths.gameRound;
    const referencesGameRound = gameRoundPath && gameRoundPath.options.ref === 'GameRound';
    console.log(referencesGameRound ? '✓ gameRound references GameRound model' : '✗ gameRound does not reference GameRound');

    // Test 7: Check indexes
    console.log('\nTest 7: Checking indexes...');
    const gameRoundIndexes = GameRound.schema.indexes();
    const betRoundIndexes = BetRound.schema.indexes();
    console.log(`  GameRound indexes: ${gameRoundIndexes.length}`);
    console.log(`  BetRound indexes: ${betRoundIndexes.length}`);
    console.log(gameRoundIndexes.length > 0 && betRoundIndexes.length > 0 ? '✓ Indexes created' : '✗ Missing indexes');

    console.log('\n=== Chunk 1-2 Test Results ===');
    const allTestsPassed = hasAllFields && hasGetCurrentRound && hasGetNextRoundNumber && 
                           hasGameRoundField && referencesGameRound && 
                           gameRoundIndexes.length > 0 && betRoundIndexes.length > 0;
    
    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED - Models are correctly configured!\n');
      process.exit(0);
    } else {
      console.log('❌ SOME TESTS FAILED - Please check the errors above\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

testModels();


