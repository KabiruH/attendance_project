// lib/geofence.ts
interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationResult {
  isWithinArea: boolean;
  distanceFromCenter: number;
  distanceFromEdge: number;
  userLocation: Coordinates;
  formattedDistance: string;
}

// Center point of the allowed area
const CENTER_COORDINATES: Coordinates = {
  latitude: -0.0284967,  
  longitude: 37.658594, 
};

const MAX_DISTANCE_METERS = 100; // 70m radius

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

// Format distance for display
function formatDistance(distanceFromEdge: number): string {
  if (distanceFromEdge === 0) {
    return 'Within check-in range ✓';
  }
  
  if (distanceFromEdge < 1000) {
    return `${Math.round(distanceFromEdge)}m from check-in area`;
  } else {
    return `${(distanceFromEdge / 1000).toFixed(1)}km from check-in area`;
  }
}

// Enhanced location check with distance calculation
export const checkLocationWithDistance = async (): Promise<LocationResult> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        // Calculate distance to center
        const distanceFromCenter = getDistanceInMeters(
          userLocation.latitude,
          userLocation.longitude,
          CENTER_COORDINATES.latitude,
          CENTER_COORDINATES.longitude
        );

        // Calculate distance from geofence edge
        const distanceFromEdge = Math.max(0, distanceFromCenter - MAX_DISTANCE_METERS);
        
        // Check if within allowed area
        const isWithinArea = distanceFromCenter <= MAX_DISTANCE_METERS;

        const result: LocationResult = {
          isWithinArea,
          distanceFromCenter: Math.round(distanceFromCenter),
          distanceFromEdge: Math.round(distanceFromEdge),
          userLocation,
          formattedDistance: formatDistance(distanceFromEdge),
        };

        resolve(result);
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }

        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
};

// Legacy function for backward compatibility
export const checkLocation = async (): Promise<boolean> => {
  try {
    const result = await checkLocationWithDistance();
    return result.isWithinArea;
  } catch (error) {
    throw error;
  }
};

// Helper function to get just the formatted distance
export const getLocationDistance = async (): Promise<string> => {
  try {
    const result = await checkLocationWithDistance();
    return result.formattedDistance;
  } catch (error) {
    return 'Location unavailable';
  }
};

// For debugging - get detailed location info
export const getLocationDebugInfo = async () => {
  try {
    const result = await checkLocationWithDistance();
    return {
      ...result,
      centerCoordinates: CENTER_COORDINATES,
      maxDistanceMeters: MAX_DISTANCE_METERS,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};