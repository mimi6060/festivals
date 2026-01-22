import * as Location from 'expo-location';
import { Platform, Alert } from 'react-native';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface LocationError {
  code: string;
  message: string;
}

/**
 * Request location permissions from the user
 * Returns true if permissions were granted
 */
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    // First check current permission status
    const { status: currentStatus } = await Location.getForegroundPermissionsAsync();

    if (currentStatus === 'granted') {
      return true;
    }

    // Request permissions
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission refusee',
        'L\'acces a la localisation est necessaire pour utiliser la fonction SOS. Veuillez autoriser l\'acces dans les parametres.',
        [{ text: 'OK' }]
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting location permissions:', error);
    return false;
  }
}

/**
 * Check if location services are enabled on the device
 */
export async function isLocationServicesEnabled(): Promise<boolean> {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    return enabled;
  } catch (error) {
    console.error('Error checking location services:', error);
    return false;
  }
}

/**
 * Get the current location of the device
 * Returns null if location cannot be obtained
 */
export async function getCurrentLocation(): Promise<LocationCoordinates | null> {
  try {
    // Check if location services are enabled
    const servicesEnabled = await isLocationServicesEnabled();
    if (!servicesEnabled) {
      Alert.alert(
        'Localisation desactivee',
        'Veuillez activer les services de localisation pour utiliser la fonction SOS.',
        [{ text: 'OK' }]
      );
      return null;
    }

    // Request permissions if not already granted
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
      return null;
    }

    // Get current position with high accuracy
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 0,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    };
  } catch (error) {
    console.error('Error getting current location:', error);

    // Try with lower accuracy as fallback
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      };
    } catch (fallbackError) {
      console.error('Fallback location fetch also failed:', fallbackError);
      return null;
    }
  }
}

/**
 * Get the last known location (faster but potentially stale)
 */
export async function getLastKnownLocation(): Promise<LocationCoordinates | null> {
  try {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
      return null;
    }

    const location = await Location.getLastKnownPositionAsync();

    if (!location) {
      return null;
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      altitude: location.coords.altitude,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    };
  } catch (error) {
    console.error('Error getting last known location:', error);
    return null;
  }
}

/**
 * Watch position changes with a callback
 * Returns a function to stop watching
 */
export async function watchLocation(
  callback: (location: LocationCoordinates) => void,
  errorCallback?: (error: LocationError) => void
): Promise<(() => void) | null> {
  try {
    const hasPermission = await requestLocationPermissions();
    if (!hasPermission) {
      errorCallback?.({ code: 'PERMISSION_DENIED', message: 'Location permission denied' });
      return null;
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: location.timestamp,
        });
      }
    );

    return () => {
      subscription.remove();
    };
  } catch (error) {
    console.error('Error watching location:', error);
    errorCallback?.({ code: 'WATCH_ERROR', message: 'Failed to watch location' });
    return null;
  }
}

/**
 * Calculate distance between two coordinates in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  const latDirection = latitude >= 0 ? 'N' : 'S';
  const lonDirection = longitude >= 0 ? 'E' : 'W';

  return `${Math.abs(latitude).toFixed(6)}${latDirection}, ${Math.abs(longitude).toFixed(6)}${lonDirection}`;
}

/**
 * Open the device's maps app with coordinates
 */
export function openMapsApp(latitude: number, longitude: number, label?: string): void {
  const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
  const latLng = `${latitude},${longitude}`;
  const labelEncoded = label ? encodeURIComponent(label) : 'Location';
  const url = Platform.select({
    ios: `${scheme}${labelEncoded}@${latLng}`,
    android: `${scheme}${latLng}(${labelEncoded})`,
  });

  if (url) {
    import('react-native').then(({ Linking }) => {
      Linking.openURL(url);
    });
  }
}
