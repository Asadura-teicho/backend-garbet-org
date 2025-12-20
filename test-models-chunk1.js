/**
 * Test Chunk 1: GameRound and BetRound Models
 */

const GameRound = require('./models/GameRound.model.js');
const BetRound = require('./models/BetRound.model.js');

console.log('=== Chunk 1 Verification: Models ===\n');

try {
  // Test GameRound model
  console.log('1. GameRound Model:');
  console.log('   ✓ Imported successfully');
  console.log('   Static methods:', Object.keys(GameRound.schema.statics).join(', '));
  console.log('   Fields:', Object.keys(GameRound.schema.paths).filter(k => !k.startsWith('_')).join(', '));
  
  // Test BetRound model
  console.log('\n2. BetRound Model:');
  console.log('   ✓ Imported successfully');
  console.log('   Has gameRound field:', GameRound.schema.paths.gameRound ? 'YES' : 'NO');
  const hasGameRound = BetRound.schema.paths.gameRound !== undefined;
  console.log('   Has gameRound field:', hasGameRound ? 'YES ✓' : 'NO ✗');
  
  if (hasGameRound) {
    console.log('\n✅ Chunk 1: PASSED - Both models created and linked correctly!');
    process.exit(0);
  } else {
    console.log('\n❌ Chunk 1: FAILED - BetRound missing gameRound field');
    process.exit(1);
  }
} catch (error) {
  console.error('\n❌ Chunk 1: ERROR -', error.message);
  process.exit(1);
}


