// ============================================================================
// MISSION EXPERIENCE NORMALIZER - FIXED VERSION
// ============================================================================

export function normalizeMissionExperience(input) {
  // Handle null/undefined/empty
  if (input === null || input === undefined || input === '') {
    console.log(`📊 Mission experience: [empty] → First Time (0)`);
    return { count: 0, isFirstTime: true };
  }

  // Convert to string and clean
  const original = input.toString();
  const cleaned = original
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s+]/g, ''); // Keep + sign for "2+"

  console.log(`📊 Mission experience: "${original}" → cleaned: "${cleaned}"`);

  // Text patterns - ORDER MATTERS! Check more specific patterns first
  const patterns = {
    // First timers - check these first
    none: ['none', 'no', 'zero', 'first time', 'firsttime', 'never', 'nil'],
    
    // Multiple missions - check before single number patterns
    moreThanOne: [
      'more than 1',
      'more than one', 
      'morethan1',
      'morethanone',
      'multiple', 
      'several', 
      'many',
      '2+',
      'more'
    ],
    
    // Single mission
    one: ['1 mission', 'one mission', 'once'],
  };

  // Check for "none" patterns
  if (patterns.none.some(pattern => cleaned === pattern || cleaned.includes(pattern))) {
    console.log(`  ✅ Matched "none" pattern → First Time (0)`);
    return { count: 0, isFirstTime: true };
  }

  // Check for "more than one" patterns - MUST be before number extraction
  if (patterns.moreThanOne.some(pattern => cleaned.includes(pattern))) {
    console.log(`  ✅ Matched "more than one" pattern → Experienced (2)`);
    return { count: 2, isFirstTime: false };
  }

  // Check for "one" patterns
  if (patterns.one.some(pattern => cleaned === pattern || cleaned.includes(pattern))) {
    console.log(`  ✅ Matched "one" pattern → Experienced (1)`);
    return { count: 1, isFirstTime: false };
  }

  // Try to extract a number
  const numberMatch = cleaned.match(/\d+/);
  if (numberMatch) {
    const count = parseInt(numberMatch[0], 10);
    if (!isNaN(count) && count >= 0) {
      const isFirstTime = count === 0;
      console.log(`  ✅ Extracted number: ${count} → ${isFirstTime ? 'First Time' : 'Experienced'}`);
      return { count, isFirstTime };
    }
  }

  // Default to first time if we can't parse
  console.log(`  ⚠️ Could not parse "${original}" → Defaulting to First Time (0)`);
  return { count: 0, isFirstTime: true };
}

export async function detectMissionExperience(email, currentMissionId, prisma) {
  try {
    const previousMissions = await prisma.missionRegistration.count({
      where: {
        email: email.toLowerCase().trim(),
        missionId: { not: currentMissionId },
      },
    });

    console.log(`🔍 Auto-detect for ${email}: ${previousMissions} previous missions`);

    return {
      count: previousMissions,
      isFirstTime: previousMissions === 0,
    };
  } catch (error) {
    console.error(`❌ Error detecting mission experience for ${email}:`, error);
    return { count: 0, isFirstTime: true };
  }
}

export function mergeMissionExperience(userInput, autoDetected) {
  // If user provided input, use it
  if (userInput !== null && userInput !== undefined && userInput !== '') {
    const normalized = normalizeMissionExperience(userInput);
    console.log(`  📝 Using USER INPUT: ${normalized.count} missions`);
    return { ...normalized, source: 'user_input' };
  }

  // Otherwise use auto-detected
  console.log(`  🤖 Using AUTO-DETECTED: ${autoDetected.count} missions`);
  return { ...autoDetected, source: 'auto_detected' };
}

export function getMissionExperienceDisplay(count) {
  if (count === 0) return 'First Time';
  if (count === 1) return '1 Mission';
  return `${count} Missions`;
}

// ============================================================================
// TEST FUNCTION - Run this to verify the fixes
// ============================================================================

export function testMissionExperienceNormalizer() {
  console.log('\n🧪 Testing Mission Experience Normalizer\n');
  
  const testCases = [
    'More than 1',
    '1',
    '',
    null,
    'none',
    'first time',
    '2',
    '3',
    'More than one',
    'multiple',
    'once',
    '1 mission',
  ];

  testCases.forEach(input => {
    console.log(`\n--- Testing: "${input}" ---`);
    const result = normalizeMissionExperience(input);
    console.log(`Result: ${result.count} missions, First Time: ${result.isFirstTime}`);
  });
}

// Uncomment to run tests:
// testMissionExperienceNormalizer();