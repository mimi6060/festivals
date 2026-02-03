import React, {
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import {
  POI,
  UserLocation,
  getCategoryIcon,
  getCategoryColor,
  getStandCategoryIcon,
  POICategory,
} from '@/stores/mapStore';

interface DirectionsSheetProps {
  userLocation: UserLocation | null;
}

export interface DirectionsSheetRef {
  showDirections: (poi: POI) => void;
  close: () => void;
}

interface DirectionStep {
  instruction: string;
  distance: string;
  icon: string;
}

function calculateDistance(
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

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

function calculateWalkingTime(meters: number): string {
  // Average walking speed: 5 km/h = 83.33 m/min
  const minutes = Math.ceil(meters / 83.33);
  if (minutes < 1) {
    return '< 1 min';
  }
  if (minutes === 1) {
    return '1 min';
  }
  return `${minutes} min`;
}

function getCardinalDirection(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): string {
  const dLat = toLat - fromLat;
  const dLon = toLon - fromLon;
  const angle = (Math.atan2(dLon, dLat) * 180) / Math.PI;

  if (angle >= -22.5 && angle < 22.5) return 'nord';
  if (angle >= 22.5 && angle < 67.5) return 'nord-est';
  if (angle >= 67.5 && angle < 112.5) return 'est';
  if (angle >= 112.5 && angle < 157.5) return 'sud-est';
  if (angle >= 157.5 || angle < -157.5) return 'sud';
  if (angle >= -157.5 && angle < -112.5) return 'sud-ouest';
  if (angle >= -112.5 && angle < -67.5) return 'ouest';
  return 'nord-ouest';
}

export const DirectionsSheet = forwardRef<DirectionsSheetRef, DirectionsSheetProps>(
  ({ userLocation }, ref) => {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const [destination, setDestination] = useState<POI | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    const snapPoints = useMemo(() => ['40%', '70%'], []);

    useImperativeHandle(ref, () => ({
      showDirections: (poi: POI) => {
        setDestination(poi);
        setIsCalculating(true);
        bottomSheetRef.current?.expand();
        // Simulate calculation time
        setTimeout(() => setIsCalculating(false), 500);
      },
      close: () => {
        bottomSheetRef.current?.close();
      },
    }));

    const handleSheetChanges = useCallback((index: number) => {
      if (index === -1) {
        setDestination(null);
      }
    }, []);

    const handleOpenInMaps = useCallback(() => {
      if (!destination) return;

      const { latitude, longitude } = destination.location;
      const label = encodeURIComponent(destination.name);

      const url = Platform.select({
        ios: `maps:?daddr=${latitude},${longitude}&q=${label}`,
        android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
      });

      if (url) {
        Linking.openURL(url).catch(() => {
          // Fallback to Google Maps web
          Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
          );
        });
      }
    }, [destination]);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      []
    );

    // Calculate direction info
    const directionInfo = useMemo(() => {
      if (!destination || !userLocation) return null;

      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        destination.location.latitude,
        destination.location.longitude
      );

      const direction = getCardinalDirection(
        userLocation.latitude,
        userLocation.longitude,
        destination.location.latitude,
        destination.location.longitude
      );

      const steps: DirectionStep[] = [
        {
          instruction: `Dirigez-vous vers le ${direction}`,
          distance: formatDistance(distance),
          icon: 'compass-outline',
        },
        {
          instruction: `Continuez tout droit pendant environ ${formatDistance(distance * 0.7)}`,
          distance: formatDistance(distance * 0.7),
          icon: 'arrow-up-outline',
        },
        {
          instruction: `Vous etes arrive a "${destination.name}"`,
          distance: '',
          icon: 'flag-outline',
        },
      ];

      return {
        distance: formatDistance(distance),
        walkingTime: calculateWalkingTime(distance),
        steps,
      };
    }, [destination, userLocation]);

    // Get icon for destination
    const getIcon = (): string => {
      if (!destination) return 'location-outline';
      if (destination.poiType === 'stand') {
        return getStandCategoryIcon(destination.category);
      }
      if (destination.poiType === 'stage') {
        return 'musical-notes-outline';
      }
      return getCategoryIcon(destination.type as POICategory);
    };

    const getColor = (): string => {
      if (!destination) return '#6366F1';
      if (destination.poiType === 'stand') {
        const colorMap: Record<string, string> = {
          food: '#F97316',
          drink: '#EAB308',
          merch: '#EC4899',
          sponsor: '#6366F1',
          craft: '#8B5CF6',
        };
        return colorMap[destination.category] || '#6366F1';
      }
      if (destination.poiType === 'stage') {
        return destination.color;
      }
      return getCategoryColor(destination.type as POICategory);
    };

    if (!destination) return null;

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetView style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: getColor() }]}>
              <Ionicons name={getIcon() as any} size={24} color="white" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.destinationLabel}>Itineraire vers</Text>
              <Text style={styles.destinationName}>{destination.name}</Text>
            </View>
            <TouchableOpacity
              onPress={() => bottomSheetRef.current?.close()}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* No location message */}
          {!userLocation && (
            <View style={styles.noLocationContainer}>
              <Ionicons name="location-outline" size={40} color="#9CA3AF" />
              <Text style={styles.noLocationText}>
                Activez la localisation pour obtenir un itineraire
              </Text>
            </View>
          )}

          {/* Loading */}
          {isCalculating && userLocation && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Calcul de l&apos;itineraire...</Text>
            </View>
          )}

          {/* Direction info */}
          {!isCalculating && userLocation && directionInfo && (
            <>
              {/* Summary */}
              <View style={styles.summary}>
                <View style={styles.summaryItem}>
                  <Ionicons name="walk-outline" size={24} color="#6366F1" />
                  <Text style={styles.summaryValue}>{directionInfo.walkingTime}</Text>
                  <Text style={styles.summaryLabel}>a pied</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Ionicons name="navigate-outline" size={24} color="#6366F1" />
                  <Text style={styles.summaryValue}>{directionInfo.distance}</Text>
                  <Text style={styles.summaryLabel}>distance</Text>
                </View>
              </View>

              {/* Steps */}
              <View style={styles.stepsContainer}>
                <Text style={styles.stepsTitle}>Instructions</Text>
                {directionInfo.steps.map((step, index) => (
                  <View key={index} style={styles.stepRow}>
                    <View style={styles.stepIconContainer}>
                      <Ionicons name={step.icon as any} size={20} color="#6366F1" />
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepInstruction}>{step.instruction}</Text>
                      {step.distance && (
                        <Text style={styles.stepDistance}>{step.distance}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              {/* Open in Maps button */}
              <TouchableOpacity
                style={[styles.mapsButton, { backgroundColor: getColor() }]}
                onPress={handleOpenInMaps}
                activeOpacity={0.8}
              >
                <Ionicons name="map-outline" size={20} color="white" />
                <Text style={styles.mapsButtonText}>Ouvrir dans Plans</Text>
              </TouchableOpacity>
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

DirectionsSheet.displayName = 'DirectionsSheet';

const styles = StyleSheet.create({
  handleIndicator: {
    backgroundColor: '#D1D5DB',
    width: 40,
  },
  sheetBackground: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  destinationLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  destinationName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  noLocationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noLocationText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 16,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  stepsContainer: {
    flex: 1,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  stepIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContent: {
    flex: 1,
    marginLeft: 12,
    paddingTop: 2,
  },
  stepInstruction: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  stepDistance: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  mapsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default DirectionsSheet;
