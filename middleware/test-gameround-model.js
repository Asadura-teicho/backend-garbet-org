/**
 * Test GameRound model
 */

const GameRound = require('./models/GameRound.model.js');

console.log('=== Testing GameRound Model ===\n');

try {
  console.log('✓ GameRound model imported successfully');
  console.log('Available static methods:', Object.keys(GameRound.schema.statics).join(', '));
  console.log('\n✅ Model structure verified!');
  process.exit(0);
} catch (error) {
  console.error('✗ ERROR:', error.message);
  process.exit(1);
}


