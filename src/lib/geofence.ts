// lib/geofence.ts
interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Boundary {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  bufferInDegrees: number;
}

// Example boundaries (replace with your actual coordinates)
const ALLOWED_BOUNDARIES: Boundary = {
  minLat: -1.3970, // Southern boundary of Ongata Rongai
  maxLat: -1.3770, // Northern boundary of Ongata Rongai
  minLng: 36.7450, // Western boundary of Ongata Rongai
  maxLng: 36.7650, // Eastern boundary of Ongata Rongai
  bufferInDegrees: 1.01 // Approximately 1km buffer
};

export const checkLocation = async (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        const isWithinBounds = 
          latitude >= (ALLOWED_BOUNDARIES.minLat - ALLOWED_BOUNDARIES.bufferInDegrees) &&
          latitude <= (ALLOWED_BOUNDARIES.maxLat + ALLOWED_BOUNDARIES.bufferInDegrees) &&
          longitude >= (ALLOWED_BOUNDARIES.minLng - ALLOWED_BOUNDARIES.bufferInDegrees) &&
          longitude <= (ALLOWED_BOUNDARIES.maxLng + ALLOWED_BOUNDARIES.bufferInDegrees);

        resolve(isWithinBounds);
      },
      (error) => {
        reject(new Error('Failed to get location'));
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  });
};