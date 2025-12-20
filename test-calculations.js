/**
 * Quick test for calculateRoundResult function
 */

const { calculateRoundResult } = require('./services/betRound.service.js');

console.log('=== Testing calculateRoundResult ===\n');

const tests = [
  { percentage: 50, betAmount: 100, expected: { resultType: 'win', amountChange: 50 } },
  { percentage: -30, betAmount: 100, expected: { resultType: 'loss', amountChange: -30 } },
  { percentage: 0, betAmount: 100, expected: { resultType: 'neutral', amountChange: 0 } },
  { percentage: 200, betAmount: 50, expected: { resultType: 'win', amountChange: 100 } },
  { percentage: -100, betAmount: 50, expected: { resultType: 'loss', amountChange: -50 } },
];

let passed = 0;
let failed = 0;

tests.forEach((test, i) => {
  const result = calculateRoundResult(test.percentage, test.betAmount);
  const match = result.resultType === test.expected.resultType && 
                Math.abs(result.amountChange - test.expected.amountChange) < 0.01;
  
  if (match) {
    console.log(`✓ Test ${i+1}: PASSED - ${test.percentage}%, ${test.betAmount} = ${result.resultType}, ${result.amountChange}`);
    passed++;
  } else {
    console.log(`✗ Test ${i+1}: FAILED`);
    console.log(`  Expected: ${test.expected.resultType}, ${test.expected.amountChange}`);
    console.log(`  Got: ${result.resultType}, ${result.amountChange}`);
    failed++;
  }
});

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}/${tests.length}`);
console.log(`Failed: ${failed}/${tests.length}`);

if (failed === 0) {
  console.log('\n✅ All tests passed!');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
}

