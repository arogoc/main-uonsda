// ============================================================================
// YEAR OF STUDY NORMALIZER - FIXED VERSION
// ============================================================================

export function normalizeYearOfStudy(input) {
  if (input === null || input === undefined || input === '') {
    console.log(`📚 Year of study: [empty] → null`);
    return null;
  }

  const original = input.toString();
  const cleaned = original
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');

  console.log(`📚 Year of study: "${original}" → cleaned: "${cleaned}"`);

  // Handle "Other" patterns (graduates, associates, etc.)
  const otherPatterns = [
    'other',
    'graduate', 
    'graduated',
    'postgrad',
    'post grad',
    'alumni',
    'completed',
    'done',
    'finished',
    'masters',
    'master',
    'phd',
    'doctorate',
    'associate',     // ← Alumni/graduated members
    'associates',    // ← Plural form
    'continuing',
    'alumnus',
    'alumna'
  ];

  if (otherPatterns.some(pattern => cleaned.includes(pattern))) {
    console.log(`  ✅ Matched "other" pattern → null`);
    return null;
  }

  // Year patterns - exact matches and variations
  const yearPatterns = {
    1: ['1', 'one', 'first', 'first year', 'year 1', 'year one', 'yr1', 'y1', '1st'],
    2: ['2', 'two', 'second', 'second year', 'year 2', 'year two', 'yr2', 'y2', '2nd'],
    3: ['3', 'three', 'third', 'third year', 'year 3', 'year three', 'yr3', 'y3', '3rd'],
    4: ['4', 'four', 'fourth', 'fourth year', 'year 4', 'year four', 'yr4', 'y4', '4th'],
    5: ['5', 'five', 'fifth', 'fifth year', 'year 5', 'year five', 'yr5', 'y5', '5th'],
    6: ['6', 'six', 'sixth', 'sixth year', 'year 6', 'year six', 'yr6', 'y6', '6th'],
    7: ['7', 'seven', 'seventh', 'seventh year', 'year 7', 'year seven', 'yr7', 'y7', '7th'],
  };

  // Try exact or partial match
  for (const [year, patterns] of Object.entries(yearPatterns)) {
    if (patterns.some(pattern => cleaned === pattern || cleaned.includes(pattern))) {
      const yearNum = parseInt(year, 10);
      console.log(`  ✅ Matched year ${yearNum} pattern`);
      return yearNum;
    }
  }

  // Try to extract a number
  const numberMatch = cleaned.match(/\d+/);
  if (numberMatch) {
    const year = parseInt(numberMatch[0], 10);
    if (year >= 1 && year <= 7) {
      console.log(`  ✅ Extracted year number: ${year}`);
      return year;
    } else if (year > 7) {
      console.log(`  ⚠️ Year ${year} is > 7 → treating as null (Other)`);
      return null;
    }
  }

  console.log(`  ⚠️ Could not parse "${original}" → null (Other)`);
  return null;
}

export function getYearOfStudyDisplay(year) {
  if (year === null || year === undefined) return 'Other';
  if (year >= 1 && year <= 7) return `Year ${year}`;
  return 'Other';
}

export function validateYearOfStudy(inputs) {
  const results = {
    valid: [],
    warnings: [],
    summary: {
      year1: 0,
      year2: 0,
      year3: 0,
      year4: 0,
      year5: 0,
      year6: 0,
      year7: 0,
      other: 0,
    },
  };

  for (const input of inputs) {
    const normalized = normalizeYearOfStudy(input);
    
    if (normalized === null) {
      results.summary.other++;
    } else if (normalized >= 1 && normalized <= 7) {
      results.summary[`year${normalized}`]++;
    }

    results.valid.push({
      original: input,
      normalized,
      display: getYearOfStudyDisplay(normalized),
    });
  }

  return results;
}

// ============================================================================
// TEST FUNCTION
// ============================================================================

export function testYearOfStudyNormalizer() {
  console.log('\n🧪 Testing Year of Study Normalizer\n');
  
  const testCases = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    'Associate',
    'Associate ',
    'Done',
    'Graduate',
    'Completed',
    'first',
    'second',
    'Year 3',
    '',
    null,
    'Just finished High school',
  ];

  testCases.forEach(input => {
    console.log(`\n--- Testing: "${input}" ---`);
    const result = normalizeYearOfStudy(input);
    console.log(`Result: ${result === null ? 'null (Other)' : `Year ${result}`}`);
  });
}

// Uncomment to run tests:
// testYearOfStudyNormalizer();