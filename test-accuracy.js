const toxicityClassifier = require('./toxicity-classifier');

async function testAccuracy() {
  console.log('🎯 Testing Toxicity Detection Accuracy\n');
  
  // Initialize model
  await toxicityClassifier.initialize(0.70);
  
  // Critical test cases that were failing
  const criticalTests = [
    {
      id: 1,
      text: "I'm going to hurt you if this isn't fixed.",
      expected: { toxic: true, minScore: 0.7, category: "THREAT" },
      description: "Direct physical threat"
    },
    {
      id: 2, 
      text: "This is absolutely ridiculous!",
      expected: { toxic: true, minScore: 0.5, category: "INSULT" },
      description: "Moderate insult"
    },
    {
      id: 3,
      text: "I'm disappointed with the quality of work.",
      expected: { toxic: false, maxScore: 0.4, category: "CRITICISM" },
      description: "Constructive criticism"
    },
    {
      id: 4,
      text: "You're a complete idiot!",
      expected: { toxic: true, minScore: 0.8, category: "SEVERE_INSULT" },
      description: "Severe insult"
    },
    {
      id: 5,
      text: "Could you please check this issue?",
      expected: { toxic: false, maxScore: 0.2, category: "POLITE" },
      description: "Polite request"
    },
    {
      id: 6,
      text: "Go to hell you stupid moron!",
      expected: { toxic: true, minScore: 0.9, category: "SEVERE_ABUSE" },
      description: "Severe abusive language"
    }
  ];
  
  console.log('📋 Running Critical Tests:\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of criticalTests) {
    console.log(`\n--- Test ${test.id}: ${test.expected.category} ---`);
    console.log(`📝: "${test.text}"`);
    console.log(`📄: ${test.description}`);
    
    const result = await toxicityClassifier.classify(test.text);
    
    console.log(`📊 Score: ${result.score}`);
    console.log(`🎯 Detected: ${result.isToxic ? '🚨 TOXIC' : '✅ CLEAN'}`);
    console.log(`🔧 Method: ${result.method}`);
    
    // Check if correct toxicity detection
    const toxicCorrect = result.isToxic === test.expected.toxic;
    
    // Check if score in expected range
    let scoreCorrect = false;
    if (test.expected.minScore !== undefined) {
      scoreCorrect = result.score >= test.expected.minScore;
    } else if (test.expected.maxScore !== undefined) {
      scoreCorrect = result.score <= test.expected.maxScore;
    }
    
    if (toxicCorrect && scoreCorrect) {
      console.log('✅ PASS');
      passed++;
    } else {
      console.log('❌ FAIL');
      if (!toxicCorrect) {
        console.log(`   Expected: ${test.expected.toxic ? 'TOXIC' : 'CLEAN'}`);
        console.log(`   Got: ${result.isToxic ? 'TOXIC' : 'CLEAN'}`);
      }
      if (!scoreCorrect) {
        if (test.expected.minScore) {
          console.log(`   Expected min score: ${test.expected.minScore}`);
        } else {
          console.log(`   Expected max score: ${test.expected.maxScore}`);
        }
        console.log(`   Got score: ${result.score}`);
      }
      failed++;
    }
    
    // Show details
    if (result.details && result.details.length > 0) {
      console.log('🔍 Details:');
      result.details.forEach(detail => {
        console.log(`   - ${detail.label}: ${detail.score}`);
      });
    }
  }
  
  console.log('\n📊 FINAL RESULTS:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`🎯 Accuracy: ${((passed / criticalTests.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n⚠️ Some tests failed. Consider:');
    console.log('   1. Lowering the threshold (currently 0.70)');
    console.log('   2. Adding more keyword patterns');
    console.log('   3. Checking model initialization');
  }
}

// Run the test
testAccuracy().catch(console.error);