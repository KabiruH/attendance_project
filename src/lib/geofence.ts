// lib/geofence.ts
import { 
  CENTER_COORDINATES, 
  MAX_DISTANCE_METERS, 
  getDistanceInMeters 
} from './geofence-utils';

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