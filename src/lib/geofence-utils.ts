// lib/geofence-utils.ts
interface Coordinates {
  latitude: number;
  longitude: number;
}

// Center point - matches your geofence.ts
export const CENTER_COORDINATES: Coordinates = {
  latitude: -0.028622,  
  longitude: 37.658329, 
};

export const MAX_DISTANCE_METERS = 100; // 100m radius

// Haversine formula to calculate distance between two points in meters
export function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check if coordinates are within geofence
export function isWithinGeofence(latitude: number, longitude: number): boolean {
  const distance = getDistanceInMeters(
    latitude,
    longitude,
    CENTER_COORDINATES.latitude,
    CENTER_COORDINATES.longitude
  );
  return distance <= MAX_DISTANCE_METERS;
}