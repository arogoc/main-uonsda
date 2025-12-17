import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import csv from 'csv-parser';
import { Readable } from 'stream';
import path from 'path';

import { normalizeCampus, validateCampusNames, getCampusDisplayName } from '../utils/campusNormalizer.js';
import { normalizeYearOfStudy, validateYearOfStudy, getYearOfStudyDisplay } from '../utils/yearOfStudyNormalizer.js';
import { 
  normalizeMissionExperience, 
  detectMissionExperience, 
  mergeMissionExperience,
  getMissionExperienceDisplay 
} from '../utils/missionExperienceNormalizer.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=20&pool_timeout=20',
    },
  },
})


// ============================================================================
// STEP 2: ADD HELPER FUNCTION FOR DELAYS
// ============================================================================

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createMissionSchema = z.object({
  name: z.string().min(1). max(200),
  location: z.string().min(1).max(200),
  startDate: z.string().datetime(),
  endDate: z. string().datetime(),
  numberOfSites: z.number().int().min(1).max(20),
});

// ============================================================================
// FAIR DISTRIBUTION ALGORITHM
// ============================================================================

class MissionaryDistributor {
  constructor(registrations, numberOfSites) {
    this.registrations = registrations;
    this.numberOfSites = numberOfSites;
    
    // ✅ UPDATED WEIGHTS - Prioritize balance over diversity
    this.weights = {
      totalBalance: 200,      // HIGHEST - keep sites same size
      genderBalance: 150,     // VERY HIGH - prevent all-male/female sites
      experienceBalance: 100, // HIGH - mix first-timers with veterans
      campusDiversity: 80,    // MEDIUM-HIGH - spread campuses evenly
      visitorSpread: 100,     // HIGH - don't dump all visitors in one site
      yearDiversity: 40,      // MEDIUM - spread years
    };
    
    this.maxOptimizationPasses = 10;
    this.convergenceThreshold = 0.001;
    
    this.sites = Array.from({ length: numberOfSites }, (_, i) => ({
      siteNumber: i + 1,
      missionaries: [],
      stats: {
        total: 0,
        male: 0,
        female: 0,
        campuses: {},
        yearsOfStudy: {},
        visitors: 0,
        firstTimers: 0,
        experienced: 0,
        veterans: 0,
      },
    }));
    
    this.globalStats = this.calculateGlobalStats();
  }

  // Main distribution entry point
  distribute() {
    console.log('🎲 Starting smart distribution...');
    
    // Phase 1: Initial balanced distribution
    this.initialBalancedDistribution();
    
    // Phase 2: Multi-pass optimization
    this.optimizeDistribution();
    
    // Phase 3: Final polish
    this.finalBalanceCheck();
    this.balanceCampuses();
    this.balanceYearsOfStudy();
    
    const totalDistributed = this.sites.reduce((sum, site) => sum + site.stats.total, 0);
    console.log('\n📊 FINAL DISTRIBUTION SUMMARY:');
    console.log(`  Total to distribute: ${this.registrations.length}`);
    console.log(`  Total distributed: ${totalDistributed}`);
    console.log(`  Missing: ${this.registrations.length - totalDistributed}`);

    if (totalDistributed !== this.registrations.length) {
      console.error(`\n❌ CRITICAL ERROR: ${this.registrations.length - totalDistributed} people were not assigned! `);
      
      // Find missing people
      const assignedIds = new Set();
      this.sites.forEach(site => {
        site.missionaries.forEach(m => assignedIds.add(m.id));
      });
      const missing = this.registrations.filter(r => !assignedIds.has(r.id));
      console.error('Missing:', missing.map(m => `${m.firstName} ${m. lastName}`));
    }

    console.log('✅ Distribution complete');
    return this.sites;
  }

  // ========================================
  // PHASE 1: STRATIFIED INITIAL DISTRIBUTION
  // ========================================
  
  initialBalancedDistribution() {
    console.log(`🎯 Starting strategic distribution of ${this.registrations.length} people to ${this.numberOfSites} sites...`);
    
    // ✅ NEW:  Create stratified buckets for EVEN distribution
    const buckets = this.createStratifiedBuckets();
    
    console.log('📦 Created stratified buckets:');
    Object.entries(buckets).forEach(([key, people]) => {
      if (people.length > 0) {
        console.log(`  ${key}: ${people.length} people`);
      }
    });
    
    // ✅ NEW: Deal people round-robin from each bucket
    let currentSiteIndex = 0;
    let totalAssigned = 0;
    
    // Process each bucket and deal people one-by-one to sites
    Object.keys(buckets).forEach(bucketKey => {
      const shuffled = this.shuffleArray(buckets[bucketKey]);
      
      shuffled.forEach(person => {
        const targetSite = this.sites[currentSiteIndex];
        this.addToSite(targetSite, person);
        totalAssigned++;
        
        // Move to next site (round-robin)
        currentSiteIndex = (currentSiteIndex + 1) % this.numberOfSites;
        
        if (totalAssigned % 20 === 0) {
          console.log(`  Assigned ${totalAssigned}/${this.registrations.length} people`);
        }
      });
    });
    
    console.log('✅ Initial distribution complete');
    console.log('📊 Sites after initial distribution:');
    this.sites.forEach(site => {
      const genderRatio = site.stats.female > 0 
        ? `${(site.stats.male / site.stats.female).toFixed(1)}:1` 
        : site.stats.male > 0 ?  `all male` : `empty`;
      console.log(`  Site ${site.siteNumber}: ${site.stats.total} people (M:  ${site.stats.male}, F: ${site.stats.female}, ratio: ${genderRatio}, visitors: ${site.stats.visitors})`);
    });
  }

  // ✅ NEW FUNCTION: Create stratified buckets for even distribution
  createStratifiedBuckets() {
    const buckets = {};
    
    // Create a unique bucket for each combination of characteristics
    this.registrations.forEach(person => {
      // Create bucket key based on multiple characteristics
      const gender = person.gender;
      const experience = person.previousMissionsCount === 0 ? 'firstTimer' : 
                        person.previousMissionsCount === 1 ? 'experienced' : 'veteran';
      const isVisitor = person.isVisitor ?  'visitor' : 'student';
      const campus = person.campus || 'unknown';
      
      // Bucket key combines:  gender_experience_visitorStatus_campus
      // This ensures even distribution of ALL characteristics
      const bucketKey = `${gender}_${experience}_${isVisitor}_${campus}`;
      
      if (!buckets[bucketKey]) {
        buckets[bucketKey] = [];
      }
      
      buckets[bucketKey].push(person);
    });
    
    return buckets;
  }

  groupByCharacteristics(registrations) {
    const groups = {
      maleFirstTimers: registrations.filter((r) => r.gender === 'MALE' && r.previousMissionsCount === 0),
      maleExperienced: registrations. filter((r) => r.gender === 'MALE' && r.previousMissionsCount === 1),
      maleVeterans: registrations.filter((r) => r.gender === 'MALE' && r.previousMissionsCount >= 2),
      femaleFirstTimers: registrations. filter((r) => r.gender === 'FEMALE' && r.previousMissionsCount === 0),
      femaleExperienced: registrations.filter((r) => r.gender === 'FEMALE' && r.previousMissionsCount === 1),
      femaleVeterans: registrations.filter((r) => r.gender === 'FEMALE' && r.previousMissionsCount >= 2),
    };
    
    console.log('📦 Group breakdown:');
    Object.entries(groups).forEach(([name, arr]) => {
      console.log(`  ${name}: ${arr.length}`);
    });
    
    return groups;
  }

  interleaveGroups(groups) {
    const result = [];
    const groupArrays = Object.values(groups);
    const maxLength = Math.max(...groupArrays.map(g => g.length));
    
    console.log(`🔀 Interleaving ${groupArrays.reduce((sum, g) => sum + g.length, 0)} people... `);
    
    // Deal people like cards - one from each group at a time
    for (let i = 0; i < maxLength; i++) {
      groupArrays.forEach(group => {
        if (group[i]) result.push(group[i]);
      });
    }
    
    console.log(`✅ Interleaved queue size: ${result.length}`);
    return result;
  }

  // ========================================
  // PHASE 2: ITERATIVE OPTIMIZATION
  // ========================================
  
  optimizeDistribution() {
    console.log('🔧 Optimization passes.. .');
    
    let bestScore = this.calculateTotalScore();
    let bestState = this.saveSiteState();
    let noImprovementCount = 0;
    
    console.log(`  Initial score: ${bestScore. toFixed(2)}`);
    
    for (let pass = 0; pass < this.maxOptimizationPasses; pass++) {
      console.log(`  --- Pass ${pass + 1} ---`);
      
      const scoreBefore = this.calculateTotalScore();
      
      // Try different optimization strategies
      this.optimizeBySwapping();
      this.optimizeByMoving();
      
      // Only use simulated annealing early on, with decreasing temperature
      if (pass < 2) {
        this.simulatedAnnealing(0.3 - pass * 0.15);
      }
      
      const currentScore = this.calculateTotalScore();
      const improvement = scoreBefore - currentScore;
      
      console.log(`  Score after pass ${pass + 1}: ${currentScore.toFixed(2)} (change: ${improvement.toFixed(2)})`);
      
      // Show site distribution after each pass
      this.sites.forEach(site => {
        console.log(`    Site ${site.siteNumber}: ${site.stats.total} people (M: ${site.stats.male}, F: ${site.stats. female})`);
      });
      
      // Track best solution found
      if (currentScore < bestScore) {
        bestScore = currentScore;
        bestState = this.saveSiteState();
        noImprovementCount = 0;
        console.log(`    ✨ New best score! `);
      } else {
        noImprovementCount++;
      }
      
      // If no improvement for 3 passes, stop
      if (noImprovementCount >= 3) {
        console.log('  ✓ No improvement for 3 passes - stopping optimization');
        break;
      }
      
      // Check convergence
      if (Math.abs(improvement) < this.convergenceThreshold) {
        console.log('  ✓ Converged - optimal solution found');
        break;
      }
    }
    
    // Restore best state if current state is worse
    if (this.calculateTotalScore() > bestScore) {
      console.log('  ⏮ Restoring best solution found');
      this.restoreSiteState(bestState);
    }
  }

  optimizeBySwapping() {
    let swapsMade = 0;
    
    for (let i = 0; i < this.sites.length; i++) {
      for (let j = i + 1; j < this.sites.length; j++) {
        const siteA = this.sites[i];
        const siteB = this.sites[j];
        
        const bestSwap = this.findBestSwap(siteA, siteB);
        
        if (bestSwap && bestSwap.improvement > 0.1) {
          this.swapPeople(siteA, bestSwap.personA, siteB, bestSwap.personB);
          swapsMade++;
        }
      }
    }
  }

  findBestSwap(siteA, siteB) {
    let bestSwap = null;
    let bestImprovement = 0;
    
    const currentScore = this.calculateSitesPairScore(siteA, siteB);
    
    const candidatesA = this.getSwapCandidates(siteA, siteB);
    const candidatesB = this.getSwapCandidates(siteB, siteA);
    
    for (const personA of candidatesA) {
      for (const personB of candidatesB) {
        // Temporarily swap
        this.removePersonFromSite(personA, siteA);
        this.removePersonFromSite(personB, siteB);
        this.addToSite(siteB, personA);
        this.addToSite(siteA, personB);
        
        const newScore = this.calculateSitesPairScore(siteA, siteB);
        const improvement = currentScore - newScore;
        
        // Revert
        this.removePersonFromSite(personA, siteB);
        this.removePersonFromSite(personB, siteA);
        this.addToSite(siteA, personA);
        this.addToSite(siteB, personB);
        
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestSwap = { personA, personB, improvement };
        }
      }
    }
    
    return bestSwap;
  }

  getSwapCandidates(fromSite, toSite) {
    const candidates = [];
    const needsMoreMales = toSite.stats.male < toSite.stats.female;
    const needsMoreFemales = toSite.stats.female < toSite.stats.male;
    
    fromSite.missionaries.forEach(person => {
      if ((needsMoreMales && person. gender === 'MALE') ||
          (needsMoreFemales && person.gender === 'FEMALE') ||
          Math.abs(toSite.stats.male - toSite.stats.female) <= 1) {
        candidates. push(person);
      }
    });
    
    return candidates. slice(0, 10);
  }

  // ✅ UPDATED:  Add strict constraints to prevent terrible distributions
  optimizeByMoving() {
    let movesMade = 0;
    const avgPerSite = this.registrations.length / this.numberOfSites;
    const MIN_SITE_SIZE = Math.max(10, avgPerSite * 0.75); // Sites can't go below 75% of average
    const MAX_SITE_SIZE = avgPerSite * 1.25; // Sites can't exceed 125% of average
    
    this.sites.forEach(site => {
      const moveCandidates = site.missionaries.filter(person => {
        const currentFit = this.calculatePersonFitScore(person, site);
        const bestAlternative = this.findBestSite(person, site);
        const alternativeFit = this.calculatePersonFitScore(person, bestAlternative);
        
        return alternativeFit < currentFit - 1.0;
      });
      
      moveCandidates.forEach(person => {
        const newSite = this.findBestSite(person, site);
        
        if (newSite !== site) {
          // ✅ CRITICAL CONSTRAINTS:  Prevent tiny/huge sites and single-gender sites
          const wouldMakeSiteTooSmall = (site.stats.total - 1) < MIN_SITE_SIZE;
          const wouldMakeSiteTooLarge = (newSite.stats.total + 1) > MAX_SITE_SIZE;
          
          // ✅ CRITICAL:  Prevent single-gender sites
          const genderKey = person.gender === 'MALE' ? 'male' : 'female';
          const otherGenderKey = person.gender === 'MALE' ? 'female' : 'male';
          const wouldLeaveNoGender = site.stats[genderKey] <= 2 && site.stats[otherGenderKey] > 5;
          const wouldCreateSingleGender = newSite.stats. total >= 8 && newSite.stats[otherGenderKey] === 0;
          
          // Only allow the move if it doesn't violate constraints
          if (! wouldMakeSiteTooSmall && 
              !wouldMakeSiteTooLarge && 
              !wouldLeaveNoGender && 
              !wouldCreateSingleGender) {
            this.movePerson(site, newSite, person);
            movesMade++;
          }
        }
      });
    });
    
    console.log(`  ℹ️ Made ${movesMade} moves during optimization`);
  }

  simulatedAnnealing(temperature) {
    const iterations = 50;
    
    for (let i = 0; i < iterations; i++) {
      const siteA = this.sites[Math.floor(Math.random() * this.sites.length)];
      const siteB = this. sites[Math.floor(Math. random() * this.sites.length)];
      
      if (siteA === siteB || siteA.missionaries.length === 0 || siteB.missionaries.length === 0) continue;
      
      const personA = siteA.missionaries[Math.floor(Math.random() * siteA.missionaries.length)];
      const personB = siteB.missionaries[Math.floor(Math.random() * siteB.missionaries.length)];
      
      const currentScore = this.calculateTotalScore();
      
      this.swapPeople(siteA, personA, siteB, personB);
      const newScore = this.calculateTotalScore();
      
      const delta = newScore - currentScore;
      
      // Accept if better, or sometimes if worse (based on temperature)
      if (delta > 0 && Math.random() > Math.exp(-delta / temperature)) {
        this.swapPeople(siteA, personB, siteB, personA);
      }
    }
  }

  // ========================================
  // SCORING SYSTEM
  // ========================================
  
  findBestSite(person, excludeSite = null) {
    const scores = this.sites
      .filter(site => site !== excludeSite)
      .map(site => ({
        site,
        score:  this.calculateSiteScore(site, person)
      }));

    scores.sort((a, b) => a.score - b.score);
    return scores[0].site;
  }

  calculateSiteScore(site, person) {
    let score = 0;
    const avgPerSite = this.registrations.length / this. numberOfSites;

    // 1.  TOTAL BALANCE - progressive penalty (HIGHEST PRIORITY)
    const totalDiff = Math.abs(site.stats.total - avgPerSite);
    const totalPenalty = Math.pow(totalDiff, 1.5) * this.weights.totalBalance;
    score += isFinite(totalPenalty) ? totalPenalty : 0;

    // 2. GENDER BALANCE (VERY HIGH PRIORITY)
    const genderKey = person.gender === 'MALE' ? 'male' :  'female';
    const otherGenderKey = person.gender === 'MALE' ? 'female' : 'male';
    const afterAddingMe = (site.stats[genderKey] + 1) - site.stats[otherGenderKey];
    const genderPenalty = Math.pow(Math.max(0, afterAddingMe), 2) * this.weights.genderBalance;
    score += isFinite(genderPenalty) ? genderPenalty : 0;

    // 3. EXPERIENCE BALANCE
    const expKey = person.previousMissionsCount === 0 ? 'firstTimers' : 
                  person.previousMissionsCount === 1 ? 'experienced' :  'veterans';
    const expCount = site.stats[expKey];
    const avgExp = this.globalStats.experienceLevels[expKey] / this.numberOfSites;
    const expPenalty = Math.pow(Math.abs(expCount - avgExp), 1.5) * this.weights.experienceBalance;
    score += isFinite(expPenalty) ? expPenalty : 0;

    // 4. CAMPUS DIVERSITY
    const campusCount = site.stats.campuses[person.campus] || 0;
    if (campusCount === 0) {
      score -= this.weights.campusDiversity;
    } else {
      score += campusCount * this.weights.campusDiversity * 0.5;
    }

    // 5. YEAR DIVERSITY
    if (person.yearOfStudy) {
      const yearCount = site.stats.yearsOfStudy[person.yearOfStudy] || 0;
      if (yearCount === 0) {
        score -= this.weights. yearDiversity * 0.5;
      } else {
        score += yearCount * this.weights.yearDiversity;
      }
    }

    // 6. VISITOR DISTRIBUTION (HIGH PRIORITY - spread evenly)
    if (person.isVisitor) {
      const avgVisitors = this.globalStats. totalVisitors / this.numberOfSites;
      const visitorDiff = Math.abs(site. stats.visitors - avgVisitors);
      score += visitorDiff * this.weights.visitorSpread;
    }

    // Safety check
    if (! isFinite(score)) {
      console.warn('⚠️ Invalid score calculated, using fallback');
      return 1000;
    }

    return score;
  }

  calculatePersonFitScore(person, site) {
    return this.calculateSiteScore(site, person);
  }

  calculateTotalScore() {
    return this.sites.reduce((sum, site) => {
      return sum + site.missionaries.reduce((siteSum, person) => {
        return siteSum + this.calculatePersonFitScore(person, site);
      }, 0);
    }, 0);
  }

  calculateSitesPairScore(siteA, siteB) {
    return siteA.missionaries.reduce((sum, p) => sum + this.calculatePersonFitScore(p, siteA), 0) +
           siteB.missionaries. reduce((sum, p) => sum + this.calculatePersonFitScore(p, siteB), 0);
  }

  // ========================================
  // PHASE 3: FINAL BALANCING
  // ========================================
  
  finalBalanceCheck() {
    console.log('🔧 Final balance check...');
    
    // Balance gender across all sites
    for (let iteration = 0; iteration < 5; iteration++) {
      let madeSwap = false;
      
      const genderImbalances = this.sites.map(site => ({
        site,
        imbalance: Math.abs(site.stats.male - site.stats.female),
        needsGender: site.stats.male > site.stats.female ?  'FEMALE' : 'MALE'
      })).sort((a, b) => b.imbalance - a.imbalance);

      for (const imbalanced of genderImbalances) {
        if (imbalanced. imbalance <= 1) break;

        const donor = this.sites.find(s => {
          if (s === imbalanced.site) return false;
          const donorNeeds = s.stats.male > s.stats.female ? 'FEMALE' : 'MALE';
          return donorNeeds !== imbalanced.needsGender;
        });

        if (donor) {
          const personToMove = donor.missionaries.find(m => 
            m.gender === imbalanced.needsGender
          );

          if (personToMove) {
            this.movePerson(donor, imbalanced.site, personToMove);
            madeSwap = true;
            break;
          }
        }
      }

      if (!madeSwap) break;
    }
    
    // Balance totals across sites
    this.balanceTotalsAcrossAllSites();
  }

  balanceTotalsAcrossAllSites() {
    const avgPerSite = this.registrations.length / this.numberOfSites;
    
    console.log(`  🔧 Balancing totals (target: ${avgPerSite.toFixed(1)} per site)`);
    
    for (let i = 0; i < 5; i++) {
      const overstaffed = this.sites.filter(s => s.stats.total > avgPerSite + 0.5);
      const understaffed = this.sites.filter(s => s.stats.total < avgPerSite - 0.5);
      
      if (overstaffed.length === 0 || understaffed.length === 0) break;
      
      overstaffed.forEach(fromSite => {
        const toSite = understaffed[0];
        
        if (toSite.stats.total >= avgPerSite) return;
        
        const person = this.findBestPersonToMove(fromSite, toSite);
        
        if (person) {
          console.log(`    Moving ${person.firstName} from Site ${fromSite.siteNumber} (${fromSite.stats.total}) to Site ${toSite.siteNumber} (${toSite.stats.total})`);
          this.movePerson(fromSite, toSite, person);
        }
      });
    }
    
    // Verify no one was lost
    const totalAfter = this.sites.reduce((sum, s) => sum + s.stats.total, 0);
    if (totalAfter !== this.registrations.length) {
      console.error(`❌ BALANCE ERROR: Started with ${this.registrations.length}, now have ${totalAfter}`);
    }
  }

  balanceCampuses() {
    const allCampuses = {};
    this.registrations.forEach((r) => {
      allCampuses[r.campus] = (allCampuses[r.campus] || 0) + 1;
    });

    const majorCampuses = Object.keys(allCampuses)
      .filter((campus) => allCampuses[campus] >= this.numberOfSites * 2)
      .sort((a, b) => allCampuses[b] - allCampuses[a]);

    majorCampuses.forEach((campus) => {
      this.balanceSingleCampus(campus);
    });
  }

  balanceSingleCampus(campus) {
    const campusCount = this.sites.map((site) => ({
      site,
      count:  site.stats.campuses[campus] || 0,
    }));

    const max = Math.max(...campusCount.map((c) => c.count));
    const min = Math.min(... campusCount.map((c) => c.count));

    if (max - min <= 2) return;

    const maxSite = campusCount.find((c) => c.count === max)?.site;
    const minSite = campusCount.find((c) => c.count === min)?.site;

    if (maxSite && minSite) {
      const personToMove = maxSite.missionaries.find(
        (m) => m.campus === campus && this.canSwapLenient(maxSite, minSite, m)
      );

      if (personToMove) {
        this.movePerson(maxSite, minSite, personToMove);
      }
    }
  }

  balanceYearsOfStudy() {
    const allYears = {};
    this.registrations.forEach((r) => {
      if (r.yearOfStudy) {
        allYears[r.yearOfStudy] = (allYears[r.yearOfStudy] || 0) + 1;
      }
    });

    const majorYears = Object.keys(allYears)
      .filter((year) => allYears[year] >= this.numberOfSites * 1.5)
      .sort((a, b) => allYears[b] - allYears[a]);

    majorYears.forEach((year) => {
      this.balanceSingleYear(parseInt(year, 10));
    });
  }

  balanceSingleYear(year) {
    const yearCounts = this.sites.map((site) => ({
      site,
      count: site.stats. yearsOfStudy[year] || 0,
    }));

    const max = Math.max(...yearCounts.map((c) => c.count));
    const min = Math.min(...yearCounts.map((c) => c.count));

    if (max - min <= 2) return;

    const maxSite = yearCounts.find((c) => c.count === max)?.site;
    const minSite = yearCounts.find((c) => c.count === min)?.site;

    if (maxSite && minSite) {
      const personToMove = maxSite.missionaries.find(
        (m) => m.yearOfStudy === year && this. canSwapLenient(maxSite, minSite, m)
      );

      if (personToMove) {
        this.movePerson(maxSite, minSite, personToMove);
      }
    }
  }

  // ========================================
  // HELPER FUNCTIONS
  // ========================================
  
  canSwapLenient(fromSite, toSite, person) {
    const genderKey = person.gender === 'MALE' ? 'male' : 'female';
    const genderDiff = Math.abs((fromSite.stats[genderKey] - 1) - (toSite.stats[genderKey] + 1));
    
    // Also check total balance
    const totalDiff = Math.abs((fromSite.stats.total - 1) - (toSite.stats.total + 1));
    
    return genderDiff <= 3 && totalDiff <= 3;
  }

  canSwap(fromSite, toSite, person) {
    const genderKey = person.gender === 'MALE' ? 'male' : 'female';
    const genderDiff = Math. abs((fromSite.stats[genderKey] - 1) - (toSite.stats[genderKey] + 1));
    
    const experienceKey = person.previousMissionsCount === 0 ? 'firstTimers' :  
                          person.previousMissionsCount === 1 ? 'experienced' : 'veterans';
    const experienceDiff = Math.abs(
      (fromSite.stats[experienceKey] - 1) - (toSite.stats[experienceKey] + 1)
    );

    return genderDiff <= 1 && experienceDiff <= 2;
  }

  findBestPersonToMove(fromSite, toSite) {
    const needsGender = toSite.stats.male < toSite.stats.female ?  'MALE' : 'FEMALE';
    
    const candidates = fromSite.missionaries. filter(m => 
      m.gender === needsGender && this.canSwapLenient(fromSite, toSite, m)
    );
    
    if (candidates.length === 0) {
      // If no candidates match needed gender, try anyone
      return fromSite.missionaries. find(m => this.canSwapLenient(fromSite, toSite, m));
    }
    
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  addToSite(site, person) {
    site.missionaries.push(person);
    this.updateSiteStats(site, person, 1);
  }

  removePersonFromSite(person, site) {
    site.missionaries = site.missionaries.filter((m) => m.id !== person.id);
    this.updateSiteStats(site, person, -1);
  }

  movePerson(fromSite, toSite, person) {
    this.removePersonFromSite(person, fromSite);
    this.addToSite(toSite, person);
  }

  swapPeople(siteA, personA, siteB, personB) {
    this.removePersonFromSite(personA, siteA);
    this.removePersonFromSite(personB, siteB);
    this.addToSite(siteB, personA);
    this.addToSite(siteA, personB);
  }

  updateSiteStats(site, person, delta) {
    site.stats.total += delta;
    site.stats[person.gender === 'MALE' ? 'male' : 'female'] += delta;
    site.stats. campuses[person.campus] = (site.stats.campuses[person.campus] || 0) + delta;
    
    if (person.yearOfStudy) {
      site.stats.yearsOfStudy[person.yearOfStudy] = (site. stats.yearsOfStudy[person.yearOfStudy] || 0) + delta;
    }
    
    if (person.isVisitor) {
      site.stats.visitors += delta;
    }

    if (person.previousMissionsCount === 0) {
      site.stats.firstTimers += delta;
    } else if (person.previousMissionsCount === 1) {
      site.stats.experienced += delta;
    } else {
      site. stats.veterans += delta;
    }
  }

  calculateGlobalStats() {
    return {
      totalPeople: this.registrations.length,
      totalMales: this.registrations.filter(r => r.gender === 'MALE').length,
      totalFemales: this.registrations.filter(r => r. gender === 'FEMALE').length,
      totalVisitors: this.registrations.filter(r => r. isVisitor).length,
      experienceLevels: {
        firstTimers: this. registrations.filter(r => r. previousMissionsCount === 0).length,
        experienced: this.registrations.filter(r => r.previousMissionsCount === 1).length,
        veterans: this.registrations.filter(r => r.previousMissionsCount >= 2).length,
      }
    };
  }

  shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  saveSiteState() {
    return this.sites.map(site => ({
      siteNumber: site.siteNumber,
      missionaries: [... site.missionaries],
      stats: JSON.parse(JSON.stringify(site.stats))
    }));
  }

  restoreSiteState(savedState) {
    savedState.forEach((savedSite, index) => {
      this.sites[index].missionaries = [... savedSite.missionaries];
      this.sites[index].stats = JSON.parse(JSON.stringify(savedSite.stats));
    });
  }
}


// ============================================================================
// MISSION CONTROLLER CLASS
// ============================================================================

class MissionController {
  /**
   * Create a new mission
   * @route POST /api/missions
   */
  async createMission(req, res) {
    try {
        const data = createMissionSchema.parse(req. body);

        // ✅ Check if mission with same name already exists
        const existingMission = await prisma.mission.findUnique({
        where: { name: data.name },
        });

        if (existingMission) {
        return res.status(400).json({
            success: false,
            message: `A mission named "${data.name}" already exists.  Please use a different name.`,
        });
        }

        // Deactivate other missions
        await prisma.mission.updateMany({
        where: { isActive: true },
        data: { isActive: false },
        });

        const mission = await prisma.mission. create({
        data: {
            ... data,
            isActive: true,
        },
        });

        res.status(201).json({
        success: true,
        message: 'Mission created successfully',
        data: mission,
        });
    } catch (error) {
        console.error('Create mission error:', error);
        
        // ✅ Handle Prisma unique constraint error
        if (error.code === 'P2002') {
        return res. status(400).json({
            success: false,
            message: 'A mission with this name already exists.  Please use a different name.',
        });
        }

        res.status(400).json({
        success: false,
        message: error.message,
        });
    }
    }

  /**
   * Get all missions
   * @route GET /api/missions
   */
  async getMissions(req, res) {
    try {
      const missions = await prisma.mission.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              registrations: true,
              distributions: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: missions,
      });
    } catch (error) {
      console. error('Get missions error:', error);
      res.status(500). json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get active mission
   * @route GET /api/missions/active
   */
  async getActiveMission(req, res) {
    try {
      const mission = await prisma.mission. findFirst({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              registrations: true,
              distributions: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: mission,
      });
    } catch (error) {
      console.error('Get active mission error:', error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Upload and preview registrations from CSV/Excel
   * @route POST /api/missions/:id/upload
   */
  async uploadRegistrations(req, res) {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    console.log(`📤 File upload:  ${req.file.originalname} (${req.file.mimetype})`);

    const mission = await prisma.mission.findUnique({ where: { id } });
    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found',
      });
    }

    let registrations = [];
    
    // Get file extension to determine type
    const fileExtension = path.extname(req.file. originalname).toLowerCase();
    console.log(`📋 File extension: ${fileExtension}`);

    // Parse file based on extension
    if (fileExtension === '.csv') {
      console.log('📊 Parsing as CSV...');
      registrations = await this.parseCSV(req.file. buffer);
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      console.log('📊 Parsing as Excel...');
      registrations = await this.parseExcel(req. file.buffer);
    } else {
      return res.status(400).json({
        success: false,
        message: `Unsupported file type: ${fileExtension}.  Please upload a .csv, .xls, or .xlsx file.`,
      });
    }

    console.log(`✅ Parsed ${registrations. length} rows`);

    if (! registrations || registrations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid data found in the uploaded file.  Please check the file format.',
      });
    }

    console.log('🔄 Normalizing registrations in batches...');

    // ✅ FIX:  Normalize in batches to avoid connection pool exhaustion
    const NORMALIZE_BATCH_SIZE = 10;
    const normalized = [];
    const errors = [];
    
    for (let i = 0; i < registrations. length; i += NORMALIZE_BATCH_SIZE) {
      const batch = registrations.slice(i, i + NORMALIZE_BATCH_SIZE);
      console.log(`  Normalizing batch ${Math.floor(i / NORMALIZE_BATCH_SIZE) + 1}/${Math.ceil(registrations.length / NORMALIZE_BATCH_SIZE)}`);
      
      for (const reg of batch) {
        try {
          const normalizedReg = await this.normalizeRegistration(reg, id);
          normalized.push(normalizedReg);
        } catch (error) {
          errors.push({ row: registrations.indexOf(reg) + 2, error: error.message });
        }
      }
      
      // Small delay between batches to let connections close
      if (i + NORMALIZE_BATCH_SIZE < registrations.length) {
        await delay(100); // 100ms delay
      }
    }

    // If more than 50% failed, something is wrong
    if (errors.length > registrations.length / 2) {
      return res.status(400).json({
        success: false,
        message: `Failed to parse most rows. Please check your file format.`,
        errors: errors.slice(0, 5),
      });
    }

    console.log(`✅ Normalized ${normalized. length} registrations`);
    if (errors.length > 0) {
      console.log(`⚠️ ${errors. length} rows had errors`);
    }

    // Validate
    const campusNames = registrations.map((r) => r.campus).filter(Boolean);
    const campusValidation = validateCampusNames(campusNames);

    const yearsOfStudy = registrations
      . map((r) => r.yearOfStudy || r['What´s your year of study?'] || r["What's your year of study?"])
      .filter(Boolean);
    const yearValidation = validateYearOfStudy(yearsOfStudy);

    console.log('💾 Saving to database in batches...');

    // ✅ Process database inserts in batches
    const DB_BATCH_SIZE = 10;
    const created = [];
    
    for (let i = 0; i < normalized.length; i += DB_BATCH_SIZE) {
      const batch = normalized.slice(i, i + DB_BATCH_SIZE);
      console.log(`  Saving batch ${Math.floor(i / DB_BATCH_SIZE) + 1}/${Math.ceil(normalized.length / DB_BATCH_SIZE)} (${batch.length} records)`);
      
      const batchResults = await Promise.all(
        batch. map((reg) =>
          prisma.missionRegistration.upsert({
            where: {
              missionId_email:  {
                missionId: id,
                email: reg.email,
              },
            },
            update: reg,
            create: {
              ...reg,
              missionId: id,
            },
          })
        )
      );
      
      created.push(...batchResults);
      
      // Small delay between batches
      if (i + DB_BATCH_SIZE < normalized. length) {
        await delay(100);
      }
    }

    console.log(`✅ Saved ${created.length} registrations`);

    // ✅ FIX: Wait for database to fully commit before responding
    await delay(500); // Give database time to commit all transactions

    // ✅ Verify count in database
    const verifyCount = await prisma.missionRegistration.count({
      where: { missionId: id }
    });

    console.log(`🔍 Verification:  ${created.length} created, ${verifyCount} in database`);

    res.json({
      success: true,
      message: errors.length === 0 
        ? `${created.length} registrations uploaded successfully`
        : `${created.length} registrations uploaded successfully (${errors.length} rows skipped due to errors)`,
      data: {
        count: created.length,
        errors: errors.length > 0 ? errors : undefined,
        warnings: {
          campus: campusValidation.warnings,
          yearOfStudy: yearValidation.warnings,
        },
        stats: {
          male: normalized.filter((r) => r.gender === 'MALE').length,
          female: normalized.filter((r) => r.gender === 'FEMALE').length,
          firstTimers: normalized.filter((r) => r.isFirstTime).length,
          visitors: normalized.filter((r) => r.isVisitor).length,
          byCampus:  normalized.reduce((acc, r) => {
            acc[r. campus] = (acc[r. campus] || 0) + 1;
            return acc;
          }, {}),
        },
      },
    });
  } catch (error) {
    console.error('Upload registrations error:', error);
    res.status(500).json({
      success: false,
      message: error. message || 'Failed to upload registrations',
    });
  }
}

  /**
   * Distribute missionaries across sites
   * @route POST /api/missions/:id/distribute
   */
  async distributeMissionaries(req, res) {
    try {
      const { id } = req.params;

      const mission = await prisma.mission.findUnique({
        where: { id },
        include:  {
          registrations: true,
        },
      });

      if (! mission) {
        return res. status(404).json({
          success: false,
          message:  'Mission not found',
        });
      }

      if (mission.registrations.length === 0) {
        return res. status(400).json({
          success: false,
          message:  'No registrations found for this mission',
        });
      }

      // Run distribution algorithm
      const distributor = new MissionaryDistributor(
        mission. registrations,
        mission.numberOfSites
      );
      
      // In distributeMissionaries method, right before calling distributor.distribute()
      console.log('📊 Registration Analysis:');
      console.log('Total registrations:', mission.registrations.length);
      console.log('Males:', mission.registrations.filter(r => r.gender === 'MALE').length);
      console.log('Females:', mission.registrations.filter(r => r.gender === 'FEMALE').length);
      console.log('Null/Invalid gender:', mission.registrations.filter(r => !r. gender || (r.gender !== 'MALE' && r.gender !== 'FEMALE')).length);
      console.log('First timers:', mission.registrations. filter(r => r.previousMissionsCount === 0).length);
      console.log('Sample registration:', mission.registrations[0]);
      
      const distributedSites = distributor. distribute();

      // ✅ FIX: Verify EVERYONE got assigned
      const totalAssigned = distributedSites.reduce((sum, site) => sum + site.missionaries.length, 0);
      const totalRegistrations = mission.registrations.length;

      console.log(`\n📊 Distribution verification:  ${totalAssigned}/${totalRegistrations} assigned`);

      if (totalAssigned !== totalRegistrations) {
        console.error(`❌ DISTRIBUTION ERROR: ${totalRegistrations - totalAssigned} people not assigned! `);
        
        // Find who's missing
        const assignedIds = new Set();
        distributedSites.forEach(site => {
          site. missionaries.forEach(m => assignedIds.add(m.id));
        });
        
        const missing = mission.registrations.filter(r => !assignedIds.has(r.id));
        console.error('❌ Missing people:', missing.map(m => `${m.firstName} ${m. lastName} (${m.email})`));
        
        // Force assign missing people using round-robin
        let siteIndex = 0;
        missing.forEach(person => {
          console.log(`  🔧 Force-assigning ${person.firstName} ${person.lastName} to Site ${distributedSites[siteIndex]. siteNumber}`);
          distributedSites[siteIndex]. missionaries.push(person);
          
          // Update site stats
          distributedSites[siteIndex].stats.total++;
          distributedSites[siteIndex].stats[person.gender === 'MALE' ? 'male' : 'female']++;
          distributedSites[siteIndex].stats.campuses[person.campus] = (distributedSites[siteIndex].stats.campuses[person.campus] || 0) + 1;
          if (person.yearOfStudy) {
            distributedSites[siteIndex].stats.yearsOfStudy[person.yearOfStudy] = (distributedSites[siteIndex].stats.yearsOfStudy[person.yearOfStudy] || 0) + 1;
          }
          if (person.isVisitor) distributedSites[siteIndex]. stats.visitors++;
          if (person.previousMissionsCount === 0) distributedSites[siteIndex].stats.firstTimers++;
          else if (person.previousMissionsCount === 1) distributedSites[siteIndex].stats.experienced++;
          else distributedSites[siteIndex]. stats.veterans++;
          
          siteIndex = (siteIndex + 1) % distributedSites.length;
        });
        
        const finalAssigned = distributedSites.reduce((sum, site) => sum + site.missionaries.length, 0);
        console.log(`✅ After force-assignment: ${finalAssigned}/${totalRegistrations} assigned`);
      }

      // Delete old distributions
      await prisma.missionDistribution.deleteMany({
        where: { missionId: id },
      });

      // Save new distributions
      const distributions = [];
      for (const site of distributedSites) {
        for (const missionary of site.missionaries) {
          distributions. push({
            missionId:  id,
            registrationId:  missionary.id,
            siteNumber: site.siteNumber,
          });
        }
      }

      await prisma.missionDistribution.createMany({
        data: distributions,
      });

      // ✅ Final verification after saving to database
      console.log(`💾 Saved ${distributions.length} distributions to database`);

      res.json({
        success: true,
        message: `Successfully distributed all ${totalRegistrations} missionaries`,
        data: {
          totalRegistrations,
          totalDistributed: distributions.length,
          sites: distributedSites.map((site) => ({
            siteNumber: site.siteNumber,
            total: site.stats. total,
            male: site. stats.male,
            female: site.stats.female,
            firstTimers: site.stats. firstTimers,
            experienced:  site.stats.experienced,
            veterans: site.stats.veterans,
            campuses: site.stats.campuses,
            yearsOfStudy: site.stats. yearsOfStudy,
            visitors: site.stats.visitors,
          })),
        },
      });
    } catch (error) {
      console.error('Distribute missionaries error:', error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get distribution results
   * @route GET /api/missions/:id/distribution
   */
  async getDistribution(req, res) {
  try {
    const { id } = req.params;

    const distributions = await prisma.missionDistribution.findMany({
      where: { missionId: id },
      include: {
        registration: true,
      },
      orderBy: [{ siteNumber: 'asc' }],
    });

    // Group by site
    const sites = {};
    distributions. forEach((dist) => {
      if (!sites[dist.siteNumber]) {
        sites[dist.siteNumber] = {
          siteNumber: dist.siteNumber,
          missionaries: [],
          total: 0,              // ✅ At root level, not in stats
          male: 0,               // ✅ At root level
          female: 0,             // ✅ At root level
          campuses: {},          // ✅ At root level
          yearsOfStudy: {},      // ✅ At root level
          visitors: 0,           // ✅ At root level
          firstTimers: 0,        // ✅ At root level
          experienced: 0,        // ✅ At root level
          veterans: 0,           // ✅ At root level
        };
      }

      sites[dist.siteNumber]. missionaries.push(dist.registration);
      const site = sites[dist.siteNumber];
      
      // ✅ Update root-level properties
      site.total++;
      site[dist.registration.gender === 'MALE' ? 'male' : 'female']++;
      site.campuses[dist.registration.campus] =
        (site.campuses[dist. registration.campus] || 0) + 1;
      
      if (dist.registration.yearOfStudy) {
        site.yearsOfStudy[dist.registration.yearOfStudy] =
          (site.yearsOfStudy[dist.registration. yearOfStudy] || 0) + 1;
      }
      
      if (dist. registration.isVisitor) {
        site.visitors++;
      }
      
      if (dist. registration.previousMissionsCount === 0) {
        site. firstTimers++;
      } else if (dist.registration.previousMissionsCount === 1) {
        site.experienced++;
      } else {
        site.veterans++;
      }
    });

    res.json({
      success: true,
      data: Object.values(sites),
    });
  } catch (error) {
    console.error('Get distribution error:', error);
    res.status(500).json({
      success: false,
      message: error. message,
    });
  }
  }

 /**
 * Export distribution to Excel
 * @route GET /api/missions/:id/export
 */
  async exportDistribution(req, res) {
  try {
    const { id } = req.params;

    const [mission, distributions] = await Promise.all([
      prisma.mission.findUnique({ where: { id } }),
      prisma.missionDistribution.findMany({
        where: { missionId: id },
        include: { registration: true },
        orderBy: [{ siteNumber: 'asc' }],
      }),
    ]);

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found',
      });
    }

    if (distributions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No distribution data available. Please run distribution first.',
      });
    }

    const workbook = new ExcelJS.Workbook();
    
    // Set workbook properties
    workbook.creator = 'UONSDA Mission Management';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ============================================================================
    // SUMMARY SHEET
    // ============================================================================
    
    const summarySheet = workbook.addWorksheet('Summary', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }]
    });

    // Mission Info Section
    summarySheet.mergeCells('A1:H1');
    const titleRow = summarySheet.getCell('A1');
    titleRow.value = `${mission.name} - Distribution Summary`;
    titleRow.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFF6600' }
    };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 30;

    // Mission Details
    summarySheet.mergeCells('A2:H2');
    summarySheet.getCell('A2').value = `Location: ${mission.location} | ${new Date(mission.startDate).toLocaleDateString()} - ${new Date(mission.endDate).toLocaleDateString()}`;
    summarySheet.getCell('A2').font = { size: 12, bold: true };
    summarySheet.getCell('A2').alignment = { horizontal: 'center' };
    summarySheet.getRow(2).height = 20;

    summarySheet.addRow([]); // Empty row

    // Headers
    const summaryHeaderRow = summarySheet.getRow(4);
    summaryHeaderRow.values = ['Site', 'Total', 'Male', 'Female', 'First Timers', 'Experienced', 'Veterans', 'Visitors'];
    summaryHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summaryHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    summaryHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
    summaryHeaderRow.height = 25;

    // Set column widths
    summarySheet.columns = [
      { width: 12 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
    ];

    // Calculate site summaries
    const siteSummary = {};
    distributions.forEach((dist) => {
      if (!siteSummary[dist.siteNumber]) {
        siteSummary[dist.siteNumber] = { 
          total: 0, male: 0, female: 0, 
          firstTimers: 0, experienced: 0, veterans: 0, visitors: 0 
        };
      }
      siteSummary[dist.siteNumber].total++;
      if (dist.registration.gender === 'MALE') siteSummary[dist.siteNumber].male++;
      else siteSummary[dist.siteNumber].female++;
      
      if (dist.registration.previousMissionsCount === 0) siteSummary[dist.siteNumber].firstTimers++;
      else if (dist.registration.previousMissionsCount === 1) siteSummary[dist.siteNumber].experienced++;
      else siteSummary[dist.siteNumber].veterans++;
      
      if (dist.registration.isVisitor) siteSummary[dist.siteNumber].visitors++;
    });

    // Add data rows
    let totalMissionaries = 0;
    let totalMale = 0;
    let totalFemale = 0;
    let totalFirstTimers = 0;
    let totalExperienced = 0;
    let totalVeterans = 0;
    let totalVisitors = 0;

    Object.entries(siteSummary).forEach(([site, stats]) => {
      const row = summarySheet.addRow([
        `Site ${site}`,
        stats.total,
        stats.male,
        stats.female,
        stats.firstTimers,
        stats.experienced,
        stats.veterans,
        stats.visitors
      ]);
      row.alignment = { horizontal: 'center' };
      
      // Alternate row colors
      if (parseInt(site) % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' }
        };
      }

      totalMissionaries += stats.total;
      totalMale += stats.male;
      totalFemale += stats.female;
      totalFirstTimers += stats.firstTimers;
      totalExperienced += stats.experienced;
      totalVeterans += stats.veterans;
      totalVisitors += stats.visitors;
    });

    // Add totals row
    const totalsRow = summarySheet.addRow([
      'TOTAL',
      totalMissionaries,
      totalMale,
      totalFemale,
      totalFirstTimers,
      totalExperienced,
      totalVeterans,
      totalVisitors
    ]);
    totalsRow.font = { bold: true };
    totalsRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD966' }
    };
    totalsRow.alignment = { horizontal: 'center' };

    // Add borders to all cells
    summarySheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 4) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }
    });

    // ============================================================================
    // INDIVIDUAL SITE SHEETS
    // ============================================================================

    for (let i = 1; i <= mission.numberOfSites; i++) {
      const siteSheet = workbook.addWorksheet(`Site ${i}`, {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
      });

      // Site Title
      siteSheet.mergeCells('A1:J1');
      const siteTitleCell = siteSheet.getCell('A1');
      siteTitleCell.value = `Site ${i} - ${mission.name}`;
      siteTitleCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      siteTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF6600' }
      };
      siteTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      siteSheet.getRow(1).height = 25;

      // Site Stats
      const siteStats = siteSummary[i] || { total: 0, male: 0, female: 0, firstTimers: 0, experienced: 0, veterans: 0, visitors: 0 };
      siteSheet.mergeCells('A2:J2');
      const statsCell = siteSheet.getCell('A2');
      statsCell.value = `Total: ${siteStats.total} | Male: ${siteStats.male} | Female: ${siteStats.female} | First Timers: ${siteStats.firstTimers} | Experienced: ${siteStats.experienced} | Veterans: ${siteStats.veterans} | Visitors: ${siteStats.visitors}`;
      statsCell.font = { size: 11, bold: true };
      statsCell.alignment = { horizontal: 'center' };
      siteSheet.getRow(2).height = 20;

      // Headers
      const siteHeaderRow = siteSheet.getRow(3);
      siteHeaderRow.values = ['#', 'First Name', 'Last Name', 'Gender', 'Campus', 'Year of Study', 'Mission Experience', 'Email', 'Phone', 'Church/Status'];
      siteHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      siteHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      siteHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
      siteHeaderRow.height = 25;

      // Set column widths
      siteSheet.columns = [
        { width: 6 },
        { width: 18 },
        { width: 18 },
        { width: 10 },
        { width: 20 },
        { width: 15 },
        { width: 20 },
        { width: 30 },
        { width: 15 },
        { width: 25 },
      ];

      // Get missionaries for this site
      const siteMissionaries = distributions
        .filter((d) => d.siteNumber === i)
        .map((d) => d.registration);

      // Add missionary data
      siteMissionaries.forEach((m, index) => {
        // Church/visitor status
        let churchStatus = '';
        if (m.isVisitor) {
          churchStatus = m.homeChurch || 'Visitor';
        } else {
          churchStatus = 'UONSDA Member';
        }

        const row = siteSheet.addRow([
          index + 1,
          m.firstName,
          m.lastName,
          m.gender,
          getCampusDisplayName(m.campus),
          m.yearOfStudy ? `Year ${m.yearOfStudy}` : 'N/A',
          m.previousMissionsCount === 0 ? 'First Time' : 
          m.previousMissionsCount === 1 ? '1 Mission' : 
          `${m.previousMissionsCount}+ Missions`,
          m.email,
          m.phone || 'N/A',
          churchStatus
        ]);

        // Alternate row colors
        if (index % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' }
          };
        }

        // ✅ Highlight N/A cells in yellow
        row.eachCell((cell) => {
          if (cell.value === 'N/A') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFF3CD' }
            };
            cell.font = { 
              color: { argb: 'FF856404' },
              italic: true 
            };
          }
        });

        // Highlight visitors
        if (m.isVisitor) {
          row.getCell(5).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE7E6FF' }
          };
          row.getCell(5).font = { color: { argb: 'FF6B46C1' }, bold: true };
          
          row.getCell(10).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE7E6FF' }
          };
          row.getCell(10).font = { color: { argb: 'FF6B46C1' }, bold: true };
        }

        // Color code experience
        const expCell = row.getCell(7);
        if (m.previousMissionsCount === 0) {
          expCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC6F6D5' }
          };
          expCell.font = { color: { argb: 'FF047857' }, bold: true };
        } else if (m.previousMissionsCount === 1) {
          expCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFEF3C7' }
          };
          expCell.font = { color: { argb: 'FFB45309' }, bold: true };
        } else {
          expCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFED7AA' }
          };
          expCell.font = { color: { argb: 'FFC2410C' }, bold: true };
        }

        // Color code gender
        const genderCell = row.getCell(4);
        if (m.gender === 'MALE') {
          genderCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFBFDBFE' }
          };
          genderCell.font = { color: { argb: 'FF1E40AF' } };
        } else {
          genderCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFCE7F3' }
          };
          genderCell.font = { color: { argb: 'FF9F1239' } };
        }
      });

      // Add borders to all data cells
      siteSheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 3) {
          row.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
          });
        }
      });

      // Add campus breakdown at the bottom
      if (siteMissionaries.length > 0) {
        siteSheet.addRow([]); // Empty row
        
        const campusBreakdownRow = siteSheet.addRow(['Campus Breakdown']);
        campusBreakdownRow.font = { bold: true, size: 12 };
        siteSheet.mergeCells(campusBreakdownRow.number, 1, campusBreakdownRow.number, 10);
        
        const campusStats = {};
        siteMissionaries.forEach(m => {
          campusStats[m.campus] = (campusStats[m.campus] || 0) + 1;
        });

        Object.entries(campusStats)
          .sort(([, a], [, b]) => b - a)
          .forEach(([campus, count]) => {
            const row = siteSheet.addRow([
              getCampusDisplayName(campus),
              count,
              `${Math.round((count / siteMissionaries.length) * 100)}%`
            ]);
            row.font = { size: 11 };
          });

        // ✅ Add incomplete data note
        const incompleteCount = siteMissionaries.filter(m => 
          !m.phone || !m.yearOfStudy
        ).length;

        if (incompleteCount > 0) {
          siteSheet.addRow([]); // Empty row
          
          const noteRow = siteSheet.addRow([
            '⚠️ Note:',
            `${incompleteCount} ${incompleteCount === 1 ? 'person has' : 'people have'} incomplete data (shown as N/A)`
          ]);
          noteRow.font = { italic: true, color: { argb: 'FF856404' } };
          siteSheet.mergeCells(noteRow.number, 1, noteRow.number, 10);
        }
      }
    }

    // ============================================================================
    // ALL MISSIONARIES SHEET (Alphabetical)
    // ============================================================================

    const allSheet = workbook.addWorksheet('All Missionaries', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
    });

    // Title
    allSheet.mergeCells('A1:K1');
    const allTitleCell = allSheet.getCell('A1');
    allTitleCell.value = 'Complete Missionary List (Alphabetical)';
    allTitleCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    allTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }
    };
    allTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    allSheet.getRow(1).height = 25;

    // Headers
    const allHeaderRow = allSheet.getRow(2);
    allHeaderRow.values = ['#', 'Site', 'First Name', 'Last Name', 'Gender', 'Campus', 'Year', 'Experience', 'Email', 'Phone', 'Church/Status'];
    allHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    allHeaderRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }
    };
    allHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
    allHeaderRow.height = 25;

    // Set column widths
    allSheet.columns = [
      { width: 6 },
      { width: 8 },
      { width: 18 },
      { width: 18 },
      { width: 10 },
      { width: 20 },
      { width: 10 },
      { width: 18 },
      { width: 30 },
      { width: 15 },
      { width: 25 },
    ];

    // Sort alphabetically by last name, then first name
    const allMissionaries = distributions
      .map(d => ({ ...d.registration, siteNumber: d.siteNumber }))
      .sort((a, b) => {
        if (a.lastName !== b.lastName) return a.lastName.localeCompare(b.lastName);
        return a.firstName.localeCompare(b.firstName);
      });

    allMissionaries.forEach((m, index) => {
      // Church/visitor status
      let churchStatus = '';
      if (m.isVisitor) {
        churchStatus = m.homeChurch || 'Visitor';
      } else {
        churchStatus = 'UONSDA Member';
      }

      const row = allSheet.addRow([
        index + 1,
        m.siteNumber,
        m.firstName,
        m.lastName,
        m.gender,
        getCampusDisplayName(m.campus),
        m.yearOfStudy ? `Year ${m.yearOfStudy}` : 'N/A',
        m.previousMissionsCount === 0 ? 'First Time' : 
        m.previousMissionsCount === 1 ? '1 Mission' : 
        `${m.previousMissionsCount}+ Missions`,
        m.email,
        m.phone || 'N/A',
        churchStatus
      ]);

      if (index % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0FDF4' }
        };
      }

      // ✅ Highlight N/A cells
      row.eachCell((cell) => {
        if (cell.value === 'N/A') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF3CD' }
          };
          cell.font = { 
            color: { argb: 'FF856404' },
            italic: true 
          };
        }
        
        // Add borders
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
      });
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${mission.name.replace(/\s+/g, '_')}_Distribution.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export distribution error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

  // Helper methods
  async parseCSV(buffer) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = Readable.from(buffer. toString());

      stream
        .pipe(csv())
        .on('data', (row) => {
          results.push(row);
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async parseExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  
  const results = [];
  const headers = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // ✅ FIX: Keep original case of column names
      row.eachCell((cell) => {
        const headerValue = cell.value?.toString().trim();
        headers.push(headerValue);
      });
      
      // Log the actual column names found (helps with debugging)
      console.log('\n📋 Excel columns found:');
      headers.forEach((h, i) => {
        console.log(`  ${i + 1}. "${h}"`);
      });
      console.log('');
    } else {
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      if (Object.keys(rowData).length > 0) {
        results.push(rowData);
      }
    }
  });

  console.log(`✅ Parsed ${results.length} data rows from Excel`);
  return results;
}

 async normalizeRegistration(row, missionId) {
  console.log('\n🔍 Processing registration row.. .');
  
  // ============================================================================
  // HELPER:  Smart column finder
  // ============================================================================
  function getColumn(row, ...possibleNames) {
    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        return row[name];
      }
    }
    
    const rowKeys = Object.keys(row);
    for (const name of possibleNames) {
      const lowerName = name.toLowerCase();
      const matchingKey = rowKeys.find(k => k.toLowerCase() === lowerName);
      if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null && row[matchingKey] !== '') {
        return row[matchingKey];
      }
    }
    
    return null;
  }

  // ============================================================================
  // NAME - CRITICAL:  Must have a name!  (MOVED TO TOP)
  // ============================================================================
  let firstName, lastName;

  const firstNameRaw = getColumn(row, 'firstName', 'First Name', 'firstname', 'first name');
  const lastNameRaw = getColumn(row, 'lastName', 'Last Name', 'lastname', 'last name');

  if (firstNameRaw && lastNameRaw) {
    firstName = firstNameRaw.toString().trim().toLowerCase();
    lastName = lastNameRaw.toString().trim().toLowerCase();
  } else {
    const fullNameRaw = getColumn(row, 'Name', 'name', 'Full Name', 'full name', 'fullname');

    if (fullNameRaw) {
      const nameParts = this.parseFullName(fullNameRaw. toString().trim());
      firstName = nameParts. firstName;
      lastName = nameParts.lastName;
    }
  }

  // ✅ NAME IS THE ONLY REQUIRED FIELD
  if (!firstName || !lastName) {
    throw new Error(`Name is required. Cannot process row without a name.`);
  }

  // ============================================================================
  // EMAIL - Generate placeholder if missing (MOVED AFTER NAME)
  // ============================================================================
  let email = getColumn(row, 'email', 'Email', 'Email Address', 'contact', 'Contact');

  if (email) {
    email = email.toString().trim().toLowerCase();
  }

  if (!email || !email.includes('@')) {
    const phoneRaw = getColumn(row, 'Contact', 'contact', 'Phone', 'phone', 'Phone Number');
    const phone = phoneRaw?. toString().trim();
    
    if (phone && ! phone.includes('@')) {
      email = `${phone. replace(/\s+/g, '')}@placeholder.mission`;
    } else {
      // ✅ NOW firstName and lastName exist! 
      const nameSlug = `${firstName}_${lastName}`
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      
      email = `${nameSlug}@placeholder.mission`;
    }
    
    console.log(`⚠️ No email provided for ${firstName} ${lastName}, generated: ${email}`);
  }

  // ============================================================================
  // CAMPUS - Use Source_Sheet as fallback, normalize properly
  // ============================================================================
  let campusRaw = getColumn(row, 'Campus', 'campus', 'Campus Name', 'campus name');
  
  // Try Source_Sheet if Campus is empty
  if (!campusRaw || campusRaw.toString().trim() === '') {
    console.log(`  ⚠️ Campus empty for ${firstName} ${lastName}, trying Source_Sheet... `);
    campusRaw = getColumn(row, 'Source_Sheet', 'source_sheet', 'Source Sheet', 'source sheet');
  }
  
  const campus = normalizeCampus(campusRaw);
  const isVisitor = campus === 'VISITOR';
  
  console.log(`  Campus for ${firstName} ${lastName}: "${campusRaw}" → ${campus} (visitor: ${isVisitor})`);

  // ============================================================================
  // YEAR OF STUDY - Accept null/empty (shows as "N/A" in distribution)
  // ============================================================================
  const yearRaw = getColumn(
    row,
    "What´s your year of study?",
    "What's your year of study?",
    "Whats your year of study?",
    'Year of Study',
    'year of study',
    'Year',
    'year',
    'yearOfStudy'
  );
  
  const yearOfStudy = normalizeYearOfStudy(yearRaw); // Returns null if empty
  
  if (! yearOfStudy) {
    console.log(`  ⚠️ Year of study empty for ${firstName} ${lastName} - will show as N/A`);
  }

  // ============================================================================
  // MISSION EXPERIENCE - Default to 0 (First Time) if missing
  // ============================================================================
  const missionExpRaw = getColumn(
    row,
    'Number of missions attended before',
    'number of missions attended before',
    'Previous Missions',
    'previous missions',
    'previousMissions',
    'missions attended',
    'missionsAttended'
  );

  const autoDetected = await detectMissionExperience(email, missionId, prisma);
  const experience = mergeMissionExperience(missionExpRaw, autoDetected);
  
  if (!missionExpRaw) {
    console.log(`  ⚠️ Mission experience empty for ${firstName} ${lastName}, using:  ${experience. source}`);
  }

  // ============================================================================
  // PHONE/CONTACT - Accept null/empty (shows as "N/A" in distribution)
  // ============================================================================
  const phoneRaw = getColumn(row, 'Contact', 'contact', 'Phone', 'phone', 'Phone Number');
  
  let phone = null;
  if (phoneRaw && ! phoneRaw.toString().includes('@')) {
    phone = phoneRaw.toString().trim();
  } else {
    console.log(`  ⚠️ Phone empty for ${firstName} ${lastName} - will show as N/A`);
  }

  // ============================================================================
  // GENDER - Default to MALE if missing (better than excluding person)
  // ============================================================================
  let genderRaw = getColumn(row, 'Gender', 'gender', 'Sex', 'sex');
  
  let gender;
  if (! genderRaw || genderRaw.toString().trim() === '') {
    console.log(`  ⚠️ Gender missing for ${firstName} ${lastName}, defaulting to MALE`);
    gender = 'MALE'; // Default - distribute as male for balance purposes
  } else {
    const genderStr = genderRaw.toString().toUpperCase().trim();
    gender = genderStr === 'FEMALE' || genderStr === 'F' ? 'FEMALE' :  'MALE';
  }

  // ============================================================================
  // HOME CHURCH - For visitors, try to capture their institution/church
  // ============================================================================
  let homeChurch = null;
  if (isVisitor) {
    // Try multiple possible column names for home church/institution
    homeChurch = getColumn(
      row, 
      'homeChurch', 
      'Home Church', 
      'home church', 
      'church',
      'Campus', // For visitors, campus column might have their university
      'campus'
    )?.toString().trim();
    
    // If we found the campus name and it's a visitor, use that as homeChurch
    if (! homeChurch && campusRaw) {
      homeChurch = campusRaw. toString().trim();
    }
    
    if (!homeChurch) {
      homeChurch = 'External Member'; // Better default than N/A
    }
    
    console.log(`  Home church/institution for ${firstName} ${lastName}:  ${homeChurch}`);
  }

  console.log(`✅ ${firstName} ${lastName} processed successfully`);

  return {
    firstName,
    lastName,
    email,
    phone:  phone || null,  // null will show as "N/A" in exports
    gender,
    campus,
    yearOfStudy:  yearOfStudy || null,  // null will show as "N/A" 
    isVisitor,
    homeChurch,
    previousMissionsCount: experience.count,
    isFirstTime: experience.isFirstTime,
  };
}


// ============================================================================
// HELPER METHOD - Keep this as is
// ============================================================================

parseFullName(fullName) {
  if (!fullName || fullName.trim().length === 0) {
    throw new Error('Name cannot be empty');
  }

  const cleaned = fullName.trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ');

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: parts[0]
    };
  } else if (parts.length === 2) {
    return {
      firstName: parts[0],
      lastName: parts[1]
    };
  } else if (parts.length === 3) {
    const middlePart = parts[1];
    if (middlePart.length <= 2 && (middlePart.endsWith('.') || middlePart.length === 1)) {
      return {
        firstName: parts[0],
        lastName: parts[2]
      };
    } else {
      return {
        firstName: `${parts[0]} ${parts[1]}`,
        lastName: parts[2]
      };
    }
  } else {
    const lastName = parts[parts.length - 1];
    const firstName = parts.slice(0, -1).join(' ');
    
    return {
      firstName,
      lastName
    };
  }
}

// ============================================================================
// UPDATED uploadRegistrations METHOD
// ============================================================================

async uploadRegistrations(req, res) {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    console.log(`📤 File upload: ${req.file.originalname} (${req.file.mimetype})`);

    const mission = await prisma.mission.findUnique({ where: { id } });
    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found',
      });
    }

    let registrations = [];
    
    // Get file extension to determine type
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    console.log(`📋 File extension: ${fileExtension}`);

    // Parse file based on extension
    if (fileExtension === '.csv') {
      console.log('📊 Parsing as CSV...');
      registrations = await this.parseCSV(req.file.buffer);
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      console.log('📊 Parsing as Excel...');
      registrations = await this.parseExcel(req.file.buffer);
    } else {
      return res.status(400).json({
        success: false,
        message: `Unsupported file type: ${fileExtension}. Please upload a .csv, .xls, or .xlsx file.`,
      });
    }

    console.log(`✅ Parsed ${registrations.length} rows`);

    if (!registrations || registrations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid data found in the uploaded file. Please check the file format.',
      });
    }

    console.log('🔄 Normalizing registrations...');

    // Normalize with better error handling
    const normalized = [];
    const errors = [];
    
    for (let i = 0; i < registrations.length; i++) {
      try {
        const reg = await this.normalizeRegistration(registrations[i], id);
        normalized.push(reg);
      } catch (error) {
        errors.push({ row: i + 2, error: error.message });
      }
    }

    // If more than 50% failed, something is wrong
    if (errors.length > registrations.length / 2) {
      return res.status(400).json({
        success: false,
        message: `Failed to parse most rows. Please check your file format.`,
        errors: errors.slice(0, 5),
      });
    }

    console.log(`✅ Normalized ${normalized.length} registrations`);
    if (errors.length > 0) {
      console.log(`⚠️ ${errors.length} rows had errors`);
    }

    // Validate
    const campusNames = registrations.map((r) => r.campus).filter(Boolean);
    const campusValidation = validateCampusNames(campusNames);

    const yearsOfStudy = registrations
      .map((r) => r.yearOfStudy || r['What´s your year of study?'] || r["What's your year of study?"])
      .filter(Boolean);
    const yearValidation = validateYearOfStudy(yearsOfStudy);

    console.log('💾 Saving to database...');

    // Insert into database
    const created = await Promise.all(
      normalized.map((reg) =>
        prisma.missionRegistration. upsert({
          where:  {
            missionId_email_firstName_lastName: {  // ✅ CHANGED
              missionId: id,
              email: reg.email,
              firstName: reg.firstName,             // ✅ ADDED
              lastName: reg.lastName,               // ✅ ADDED
            },
          },
          update: reg,
          create: {
            ...reg,
            missionId: id,
          },
        })
      )
    );

    console.log(`✅ Saved ${created.length} registrations`);

    res.json({
      success: true,
      message: errors.length === 0 
        ? `${created.length} registrations uploaded successfully`
        : `${created.length} registrations uploaded successfully (${errors.length} rows skipped due to errors)`,
      data: {
        count: created.length,
        errors: errors.length > 0 ? errors : undefined,
        warnings: {
          campus: campusValidation.warnings,
          yearOfStudy: yearValidation.warnings,
        },
        stats: {
          male: normalized.filter((r) => r.gender === 'MALE').length,
          female: normalized.filter((r) => r.gender === 'FEMALE').length,
          firstTimers: normalized.filter((r) => r.isFirstTime).length,
          visitors: normalized.filter((r) => r.isVisitor).length,
          byCampus: normalized.reduce((acc, r) => {
            acc[r.campus] = (acc[r.campus] || 0) + 1;
            return acc;
          }, {}),
        },
      },
    });
  } catch (error) {
    console.error('Upload registrations error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload registrations',
    });
  }
}

// ✅ NEW: HELPER METHOD TO PARSE FULL NAME
parseFullName(fullName) {
  if (!fullName || fullName.trim(). length === 0) {
    throw new Error('Name cannot be empty');
  }

  const cleaned = fullName.trim(). replace(/\s+/g, ' '); // Remove extra spaces
  const parts = cleaned.split(' ');

  if (parts.length === 1) {
    // Only one name provided - treat as both first and last
    return {
      firstName: parts[0],
      lastName: parts[0]
    };
  } else if (parts.length === 2) {
    // Standard: "John Doe"
    return {
      firstName: parts[0],
      lastName: parts[1]
    };
  } else if (parts.length === 3) {
    // Three names: "John Peter Doe" → First: "John Peter", Last: "Doe"
    // OR "John P. Doe" → First: "John", Last: "Doe"
    
    // Check if middle part is an initial (single letter or letter with period)
    const middlePart = parts[1];
    if (middlePart.length <= 2 && (middlePart.endsWith('.') || middlePart.length === 1)) {
      // It's an initial: "John P.  Doe"
      return {
        firstName: parts[0],
        lastName: parts[2]
      };
    } else {
      // Full middle name: "John Peter Doe"
      return {
        firstName: `${parts[0]} ${parts[1]}`,
        lastName: parts[2]
      };
    }
  } else {
    // Four or more names: "John Peter Paul Doe"
    // First name: everything except last word
    // Last name: last word
    const lastName = parts[parts.length - 1];
    const firstName = parts.slice(0, -1).join(' ');
    
    return {
      firstName,
      lastName
    };
  }
}

  /**
   * Delete a mission
   * @route DELETE /api/missions/:id
   */
  async deleteMission(req, res) {
    try {
      const { id } = req.params;

      // Check if mission exists
      const mission = await prisma.mission.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              registrations: true,
              distributions: true,
            },
          },
        },
      });

      if (!mission) {
        return res.status(404).json({
          success: false,
          message: 'Mission not found',
        });
      }

      // Delete related data first (due to foreign key constraints)
      await prisma.$transaction([
        // Delete distributions
        prisma.missionDistribution.deleteMany({
          where: { missionId: id },
        }),
        // Delete registrations
        prisma.missionRegistration.deleteMany({
          where: { missionId: id },
        }),
        // Delete mission
        prisma.mission.delete({
          where: { id },
        }),
      ]);

      res.json({
        success: true,
        message: `Mission "${mission.name}" deleted successfully`,
      });
    } catch (error) {
      console.error('Delete mission error:', error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

const controller = new MissionController();

export const createMission = (req, res) => controller.createMission(req, res);
export const getMissions = (req, res) => controller.getMissions(req, res);
export const getActiveMission = (req, res) => controller.getActiveMission(req, res);
export const uploadRegistrations = (req, res) => controller.uploadRegistrations(req, res);
export const distributeMissionaries = (req, res) => controller.distributeMissionaries(req, res);
export const getDistribution = (req, res) => controller.getDistribution(req, res);
export const exportDistribution = (req, res) => controller.exportDistribution(req, res);
export const deleteMission = (req, res) => controller.deleteMission(req, res);

export default MissionController;