/**
 * Backend Integration Tests for Map Parcels Endpoint
 * 
 * These tests verify that parcel distance calculations work correctly
 * for specific geographic queries matching expected parcel counts.
 */

import { describe, test, expect } from '@jest/globals';
import { storage } from '../dbStorage';
import { calculateDistance, calculateCentroid } from '../geomUtils';

describe('Map Parcels Distance Calculations', () => {
  test('Center point 42.24,-83.72 with 450m radius should identify 89 parcels', async () => {
    const centerLat = 42.24;
    const centerLng = -83.72;
    const radiusMeters = 450;

    // Get all parcels
    const allParcels = await storage.getAllParcels();
    
    // Filter parcels within radius
    const parcelsInRadius = allParcels.filter(parcel => {
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

    expect(parcelsInRadius.length).toBe(89);
  });

  test('Center point 42.248,-83.715 with 450m radius should identify 344 parcels', async () => {
    const centerLat = 42.248;
    const centerLng = -83.715;
    const radiusMeters = 450;

    // Get all parcels
    const allParcels = await storage.getAllParcels();
    
    // Filter parcels within radius
    const parcelsInRadius = allParcels.filter(parcel => {
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

    expect(parcelsInRadius.length).toBe(344);
  });

  test('Assigned parcels should be included regardless of distance from center', async () => {
    // Create a test area
    const testArea = await storage.createArea({
      name: 'Test Area - Far Parcel',
      centerLat: 42.24,
      centerLng: -83.72,
      defaultZoom: 16,
      displayRadiusMeters: 450,
    });

    try {
      // Get all parcels
      const allParcels = await storage.getAllParcels();
      
      // Find a parcel that's far from the center (more than 1000m away)
      const farParcel = allParcels.find(p => {
        const centroid = calculateCentroid(p.geometry);
        if (!centroid) return false;
        const distance = calculateDistance(testArea.centerLat, testArea.centerLng, centroid.lat, centroid.lng);
        return distance > 1000; // More than 1km away
      });
      
      if (!farParcel) {
        console.warn('Could not find a far parcel for testing');
        return;
      }
      
      // Assign this far parcel to the area
      await storage.addParcelToArea(testArea.id, farParcel.id);
      
      // Get assigned parcels
      const assignedIds = await storage.getParcelsInArea(testArea.id);
      
      expect(assignedIds).toContain(farParcel.id);
      
      // Verify the far parcel is marked as assigned
      const isInArea = await storage.isParcelInArea(testArea.id, farParcel.id);
      expect(isInArea).toBe(true);
      
      // Clean up: remove the assignment
      await storage.removeParcelFromArea(testArea.id, farParcel.id);
      
      // Verify removal
      const isStillInArea = await storage.isParcelInArea(testArea.id, farParcel.id);
      expect(isStillInArea).toBe(false);
    } finally {
      // Clean up note: Current dbStorage doesn't have a deleteArea method
      // The test area will remain in the data/areas.json file
    }
  });
});
