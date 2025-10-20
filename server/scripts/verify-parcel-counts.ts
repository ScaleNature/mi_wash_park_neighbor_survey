/**
 * Verification script for parcel count calculations
 * 
 * Run with: npx tsx server/scripts/verify-parcel-counts.ts
 * 
 * This script verifies that:
 * 1. Center point 42.24,-83.72 with 450m radius contains 89 parcels
 * 2. Center point 42.248,-83.715 with 450m radius contains 344 parcels
 */

import { storage } from '../dbStorage';
import { calculateDistance, calculateCentroid } from '../geomUtils';

interface TestCase {
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  expectedCount: number;
}

const testCases: TestCase[] = [
  {
    name: 'Test Point 1',
    centerLat: 42.24,
    centerLng: -83.72,
    radiusMeters: 450,
    expectedCount: 89,
  },
  {
    name: 'Test Point 2',
    centerLat: 42.248,
    centerLng: -83.715,
    radiusMeters: 450,
    expectedCount: 344,
  },
];

function getBoundingBox(lat: number, lng: number, radiusMeters: number) {
  // Approximate degrees per meter
  const latDegPerMeter = 1 / 111000;
  const lngDegPerMeter = 1 / (111000 * Math.cos(lat * Math.PI / 180));
  
  const latOffset = radiusMeters * latDegPerMeter;
  const lngOffset = radiusMeters * lngDegPerMeter;
  
  return {
    minLat: lat - latOffset,
    maxLat: lat + latOffset,
    minLng: lng - lngOffset,
    maxLng: lng + lngOffset,
  };
}

async function verifyParcelCounts() {
  console.log('🔍 Verifying parcel count calculations...\n');

  let allPassed = true;

  for (const testCase of testCases) {
    const { name, centerLat, centerLng, radiusMeters, expectedCount } = testCase;

    console.log(`📍 ${name}:`);
    console.log(`   Center: ${centerLat}, ${centerLng}`);
    console.log(`   Radius: ${radiusMeters}m`);

    // Get bounding box for efficient querying
    const bbox = getBoundingBox(centerLat, centerLng, radiusMeters * 1.5); // 1.5x for safety
    
    // Get parcels in bounding box
    const parcelsInBox = await storage.getParcelsInBoundingBox(
      bbox.minLat,
      bbox.maxLat,
      bbox.minLng,
      bbox.maxLng
    );

    console.log(`   Parcels in bounding box: ${parcelsInBox.length}`);

    // Filter parcels within actual radius
    const parcelsInRadius = parcelsInBox.filter(parcel => {
      const centroid = calculateCentroid(parcel.geometry);
      if (!centroid) return false;

      const distance = calculateDistance(
        centerLat,
        centerLng,
        centroid.lat,
        centroid.lng
      );

      return distance <= radiusMeters;
    });

    const actualCount = parcelsInRadius.length;
    const passed = actualCount === expectedCount;
    allPassed = allPassed && passed;

    if (passed) {
      console.log(`   ✅ PASS: Found ${actualCount} parcels (expected ${expectedCount})`);
    } else {
      console.log(`   ❌ FAIL: Found ${actualCount} parcels (expected ${expectedCount})`);
      console.log(`   Difference: ${actualCount - expectedCount}`);
      
      // Show sample parcel IDs for debugging
      if (parcelsInRadius.length > 0) {
        console.log(`   Sample parcel IDs: ${parcelsInRadius.slice(0, 3).map(p => p.id).join(', ')}`);
      }
    }
    console.log();
  }

  // Test assigned parcel logic
  console.log('📋 Testing assigned parcel logic...');
  const testArea = await storage.createArea({
    name: 'Verification Test Area',
    centerLat: 42.24,
    centerLng: -83.72,
    defaultZoom: 16,
    displayRadiusMeters: 450,
  });

  try {
    // Get some parcels from first bounding box
    const bbox = getBoundingBox(42.24, -83.72, 2000); // Large bbox to find far parcels
    const someParcels = await storage.getParcelsInBoundingBox(
      bbox.minLat,
      bbox.maxLat,
      bbox.minLng,
      bbox.maxLng
    );

    // Find a parcel far from center
    const farParcel = someParcels.find(p => {
      const centroid = calculateCentroid(p.geometry);
      if (!centroid) return false;
      const distance = calculateDistance(testArea.centerLat, testArea.centerLng, centroid.lat, centroid.lng);
      return distance > 1000;
    });

    if (farParcel) {
      // Assign far parcel
      await storage.addParcelToArea(testArea.id, farParcel.id);
      const assignedIds = await storage.getParcelsInArea(testArea.id);
      const isAssigned = assignedIds.includes(farParcel.id);

      if (isAssigned) {
        console.log(`   ✅ PASS: Far parcel correctly assigned to area`);
      } else {
        console.log(`   ❌ FAIL: Far parcel assignment failed`);
        allPassed = false;
      }

      // Clean up
      await storage.removeParcelFromArea(testArea.id, farParcel.id);
      const stillAssigned = await storage.isParcelInArea(testArea.id, farParcel.id);

      if (!stillAssigned) {
        console.log(`   ✅ PASS: Far parcel correctly removed from area`);
      } else {
        console.log(`   ❌ FAIL: Far parcel removal failed`);
        allPassed = false;
      }
    } else {
      console.log(`   ⚠️  WARN: Could not find a far parcel for testing`);
    }
  } catch (error) {
    console.error(`   ❌ ERROR: ${error}`);
    allPassed = false;
  }

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

verifyParcelCounts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
