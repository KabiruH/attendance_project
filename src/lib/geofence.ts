// lib/geofence.ts

interface Coordinates {
  latitude: number;
  longitude: number;
}

// Center point of the allowed area 
const CENTER_COORDINATES: Coordinates = {
  latitude: -1.22486,  // Replace with your actual center latitude
  longitude: 36.70958, // Replace with your actual center longitude
  // latitude: -1.3022715,  
  // longitude: 36.7505527, 
  
};

const MAX_DISTANCE_METERS = 50; // 50m radius

// Haversine formula to calculate distance between two points in meters
function getDistanceInMeters(
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

// Check if user's location is within allowed distance
export const checkLocation = async (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        const distance = getDistanceInMeters(
          latitude,
          longitude,
          CENTER_COORDINATES.latitude,
          CENTER_COORDINATES.longitude
        );

        const isWithinAllowedArea = distance <= MAX_DISTANCE_METERS;
        resolve(isWithinAllowedArea);
      },
      (error) => {
        reject(new Error('Failed to get location'));
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  });
};
