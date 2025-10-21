/**
 * Geometry utility functions for parcel handling
 */

/**
 * Calculate the centroid of a GeoJSON geometry (Polygon or MultiPolygon)
 * Handles the duplicate closing vertex correctly by excluding it from calculation
 * 
 * @param geometry - GeoJSON geometry object (Polygon or MultiPolygon)
 * @returns Object with lat and lng of the centroid, or null if invalid
 */
export function calculateCentroid(geometry: any): { lat: number; lng: number } | null {
  if (!geometry || !geometry.type) {
    return null;
  }

  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates?.[0];
    if (!ring || ring.length < 4) {
      return null;
    }
    
    // Exclude duplicate closing vertex (first point === last point in GeoJSON)
    const uniquePoints = ring.slice(0, -1);
    let sumLat = 0, sumLng = 0;
    
    uniquePoints.forEach((point: number[]) => {
      sumLng += point[0];  // GeoJSON: [longitude, latitude]
      sumLat += point[1];
    });
    
    return {
      lat: sumLat / uniquePoints.length,
      lng: sumLng / uniquePoints.length
    };
  } 
  
  if (geometry.type === 'MultiPolygon') {
    // Use centroid of first polygon
    const firstPolygon = geometry.coordinates?.[0];
    if (!firstPolygon || !firstPolygon[0] || firstPolygon[0].length < 4) {
      return null;
    }
    
    const ring = firstPolygon[0];
    const uniquePoints = ring.slice(0, -1);
    let sumLat = 0, sumLng = 0;
    
    uniquePoints.forEach((point: number[]) => {
      sumLng += point[0];
      sumLat += point[1];
    });
    
    return {
      lat: sumLat / uniquePoints.length,
      lng: sumLng / uniquePoints.length
    };
  }
  
  return null;
}

/**
 * Haversine distance calculation between two points
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate a bounding box (square) around a center point given a radius in meters
 * @param centerLat - Latitude of center point
 * @param centerLng - Longitude of center point
 * @param radiusMeters - Radius in meters
 * @returns Object with minLat, maxLat, minLng, maxLng
 */
export function calculateBoundingBox(
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  // Earth's radius: 1 degree latitude ≈ 111,320 meters (constant everywhere)
  const metersPerDegreeLat = 111320;
  
  // Longitude varies by latitude: 1 degree longitude ≈ 111,320 × cos(latitude) meters
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos(centerLat * Math.PI / 180);
  
  // Convert radius from meters to degrees
  const latOffset = radiusMeters / metersPerDegreeLat;
  const lngOffset = radiusMeters / metersPerDegreeLng;
  
  return {
    minLat: centerLat - latOffset,
    maxLat: centerLat + latOffset,
    minLng: centerLng - lngOffset,
    maxLng: centerLng + lngOffset,
  };
}
