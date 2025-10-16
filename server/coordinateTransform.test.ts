import { describe, it } from 'node:test';
import assert from 'node:assert';
import proj4 from 'proj4';

// Define EPSG:2898 for State Plane Michigan South
proj4.defs('EPSG:2898', '+proj=lcc +lat_1=42.1 +lat_2=43.66666666666666 +lat_0=41.5 +lon_0=-84.36666666666666 +x_0=4000000 +y_0=0 +ellps=GRS80 +units=us-ft +no_defs');

// Helper: Detect CRS by checking representative points
function detectCRS(coords: number[][]): 'EPSG:2898' | 'EPSG:4326' {
  const samplePoints = coords.slice(0, Math.min(5, coords.length));
  const avgX = samplePoints.reduce((sum, p) => sum + Math.abs(p[0]), 0) / samplePoints.length;
  return avgX > 1000 ? 'EPSG:2898' : 'EPSG:4326';
}

// Helper: Transform a single ring
function transformRing(ring: number[][], sourceCRS: string): number[][] {
  if (sourceCRS === 'EPSG:4326') {
    return ring.map(p => [p[0], p[1]]);
  }
  return ring.map(point => {
    try {
      const [lng, lat] = proj4('EPSG:2898', 'EPSG:4326', [point[0], point[1]]);
      return [lng, lat];
    } catch (e) {
      return point;
    }
  });
}

// Helper: Transform geometry (Polygon and MultiPolygon)
function transformGeometry(geom: any): any {
  if (!geom || !geom.type || !geom.coordinates) {
    return geom;
  }
  
  if (geom.type === 'Polygon') {
    const sourceCRS = detectCRS(geom.coordinates[0]);
    const transformedRings = geom.coordinates.map((ring: number[][]) => 
      transformRing(ring, sourceCRS)
    );
    return {
      type: 'Polygon',
      coordinates: transformedRings
    };
  } else if (geom.type === 'MultiPolygon') {
    const transformedPolygons = geom.coordinates.map((polygonRings: number[][][]) => {
      const sourceCRS = detectCRS(polygonRings[0]);
      return polygonRings.map((ring: number[][]) => transformRing(ring, sourceCRS));
    });
    return {
      type: 'MultiPolygon',
      coordinates: transformedPolygons
    };
  }
  
  return geom;
}

// Helper: Calculate centroid excluding duplicate closing vertex
function calculateCentroid(ring: number[][]): { lng: number; lat: number } {
  const uniquePoints = ring.slice(0, -1);
  let sumLng = 0, sumLat = 0;
  uniquePoints.forEach(p => {
    sumLng += p[0];
    sumLat += p[1];
  });
  return {
    lng: sumLng / uniquePoints.length,
    lat: sumLat / uniquePoints.length
  };
}

describe('Coordinate Transformation Tests', () => {
  
  it('should transform State Plane Polygon to WGS84', () => {
    const statePlanePolygon = {
      type: 'Polygon',
      coordinates: [[[13525896.77, 688831.78], [13525900, 688835], [13525890, 688840], [13525896.77, 688831.78]]]
    };
    
    const result = transformGeometry(statePlanePolygon);
    
    assert.strictEqual(result.type, 'Polygon');
    assert.ok(result.coordinates && result.coordinates[0]);
    
    // Check all points are in Michigan WGS84 range
    result.coordinates[0].forEach((point: number[]) => {
      assert.ok(point[0] >= -85 && point[0] <= -82, `Longitude ${point[0]} should be in Michigan range`);
      assert.ok(point[1] >= 41 && point[1] <= 44, `Latitude ${point[1]} should be in Michigan range`);
    });
  });
  
  it('should preserve WGS84 Polygon unchanged', () => {
    const wgs84Polygon = {
      type: 'Polygon',
      coordinates: [[[-83.715442, 42.247982], [-83.715000, 42.248000], [-83.714500, 42.247500], [-83.715442, 42.247982]]]
    };
    
    const result = transformGeometry(wgs84Polygon);
    
    // Should be identical (no transformation)
    assert.deepStrictEqual(result, wgs84Polygon);
  });
  
  it('should transform Polygon with interior rings (holes)', () => {
    const polygonWithHole = {
      type: 'Polygon',
      coordinates: [
        // Outer ring in State Plane
        [[13525896.77, 688831.78], [13525900, 688835], [13525890, 688840], [13525896.77, 688831.78]],
        // Inner ring (hole) in State Plane
        [[13525897, 688833], [13525898, 688834], [13525896, 688834], [13525897, 688833]]
      ]
    };
    
    const result = transformGeometry(polygonWithHole);
    
    assert.strictEqual(result.type, 'Polygon');
    assert.strictEqual(result.coordinates.length, 2, 'Should preserve both outer and inner rings');
    
    // Check both rings are transformed
    result.coordinates.forEach((ring: number[][]) => {
      ring.forEach((point: number[]) => {
        assert.ok(point[0] >= -85 && point[0] <= -82, `Longitude in ring should be in Michigan range`);
        assert.ok(point[1] >= 41 && point[1] <= 44, `Latitude in ring should be in Michigan range`);
      });
    });
  });
  
  it('should transform MultiPolygon geometries', () => {
    const multiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        // First polygon in State Plane
        [[[13525896.77, 688831.78], [13525900, 688835], [13525890, 688840], [13525896.77, 688831.78]]],
        // Second polygon in State Plane
        [[[13526000, 689000], [13526010, 689010], [13526005, 689015], [13526000, 689000]]]
      ]
    };
    
    const result = transformGeometry(multiPolygon);
    
    assert.strictEqual(result.type, 'MultiPolygon');
    assert.strictEqual(result.coordinates.length, 2, 'Should preserve both polygons');
    
    // Check all polygons are transformed
    result.coordinates.forEach((polygon: number[][][]) => {
      polygon.forEach((ring: number[][]) => {
        ring.forEach((point: number[]) => {
          assert.ok(point[0] >= -85 && point[0] <= -82, `Longitude should be in Michigan range`);
          assert.ok(point[1] >= 41 && point[1] <= 44, `Latitude should be in Michigan range`);
        });
      });
    });
  });
  
  it('should correctly detect CRS using averaged sample points', () => {
    // State Plane: all points > 1000
    const statePlaneRing = [[13525896, 688831], [13525900, 688835], [13525890, 688840]];
    assert.strictEqual(detectCRS(statePlaneRing), 'EPSG:2898');
    
    // WGS84: all points < 100
    const wgs84Ring = [[-83.5, 42.4], [-83.6, 42.5], [-83.4, 42.3]];
    assert.strictEqual(detectCRS(wgs84Ring), 'EPSG:4326');
  });
  
  it('should calculate centroid excluding duplicate closing vertex', () => {
    // Square with 4 unique points + 1 duplicate closing point
    const ring = [
      [-83.716, 42.248], // Point 1
      [-83.715, 42.248], // Point 2
      [-83.715, 42.247], // Point 3
      [-83.716, 42.247], // Point 4
      [-83.716, 42.248]  // Duplicate of Point 1 (closing)
    ];
    
    const centroid = calculateCentroid(ring);
    
    // Centroid of square should be at center
    const expectedLng = (-83.716 + -83.715 + -83.715 + -83.716) / 4;
    const expectedLat = (42.248 + 42.248 + 42.247 + 42.247) / 4;
    
    assert.ok(Math.abs(centroid.lng - expectedLng) < 0.0001, 'Centroid longitude should exclude closing point');
    assert.ok(Math.abs(centroid.lat - expectedLat) < 0.0001, 'Centroid latitude should exclude closing point');
  });
  
  it('should handle mixed CRS in same dataset', () => {
    const mixedGeometries = [
      {
        type: 'Polygon',
        coordinates: [[[13525896.77, 688831.78], [13525900, 688835], [13525890, 688840], [13525896.77, 688831.78]]]
      },
      {
        type: 'Polygon',
        coordinates: [[[-83.715, 42.248], [-83.714, 42.247], [-83.713, 42.246], [-83.715, 42.248]]]
      }
    ];
    
    mixedGeometries.forEach(geom => {
      const result = transformGeometry(geom);
      
      // All results should be valid WGS84
      result.coordinates[0].forEach((point: number[]) => {
        assert.ok(point[0] >= -180 && point[0] <= 180, 'Longitude in valid range');
        assert.ok(point[1] >= -90 && point[1] <= 90, 'Latitude in valid range');
        assert.ok(point[0] >= -85 && point[0] <= -82, 'Longitude in Michigan range');
        assert.ok(point[1] >= 41 && point[1] <= 44, 'Latitude in Michigan range');
      });
    });
  });
  
  it('should return GeoJSON format [lng, lat] for all transformations', () => {
    const testCases = [
      { 
        input: { type: 'Polygon', coordinates: [[[13525896, 688831], [13525900, 688835], [13525890, 688840], [13525896, 688831]]] },
        desc: 'State Plane Polygon' 
      },
      { 
        input: { type: 'Polygon', coordinates: [[[-83.715, 42.248], [-83.714, 42.247], [-83.715, 42.248]]] },
        desc: 'WGS84 Polygon' 
      }
    ];
    
    testCases.forEach(({ input, desc }) => {
      const result = transformGeometry(input);
      
      result.coordinates[0].forEach((point: number[]) => {
        // GeoJSON: first coordinate is longitude, second is latitude
        assert.ok(Math.abs(point[0]) < 180, `${desc}: First value should be longitude (< 180)`);
        assert.ok(Math.abs(point[1]) < 90, `${desc}: Second value should be latitude (< 90)`);
      });
    });
  });
});

console.log('✓ All coordinate transformation tests ready to run');
console.log('  Run with: npx tsx --test server/coordinateTransform.test.ts');
