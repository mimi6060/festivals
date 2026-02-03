import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useMapStore, POICategory, POI } from '@/stores/mapStore';
import MapView, { MapViewRef } from '@/components/map/MapView';
import FilterBar from '@/components/map/FilterBar';
import POIBottomSheet, { POIBottomSheetRef } from '@/components/map/POIBottomSheet';
import DirectionsSheet, { DirectionsSheetRef } from '@/components/map/DirectionsSheet';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

export default function MapScreen() {
  const mapRef = useRef<MapViewRef>(null);
  const bottomSheetRef = useRef<POIBottomSheetRef>(null);
  const directionsSheetRef = useRef<DirectionsSheetRef>(null);

  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const {
    userLocation,
    selectedPOI,
    filterCategory,
    isLoading,
    error,
    showUserLocation,
    setUserLocation,
    selectPOI,
    setFilterCategory,
    toggleUserLocation,
    fetchMapData,
    getAllPOIs,
  } = useMapStore();

  // Request location permission and start watching
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const setupLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === 'granted';
        setLocationPermission(granted);

        if (granted) {
          // Get initial location
          setIsLoadingLocation(true);
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading || undefined,
            accuracy: location.coords.accuracy || undefined,
          });
          setIsLoadingLocation(false);

          // Watch for location updates
          locationSubscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 10,
            },
            (location) => {
              setUserLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                heading: location.coords.heading || undefined,
                accuracy: location.coords.accuracy || undefined,
              });
            }
          );
        }
      } catch (err) {
        console.error('Location error:', err);
        setLocationPermission(false);
        setIsLoadingLocation(false);
      }
    };

    setupLocation();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [setUserLocation]);

  // Fetch map data on mount
  useEffect(() => {
    fetchMapData('current-festival');
  }, [fetchMapData]);

  // Handle POI selection
  const handlePOISelect = useCallback((poi: POI) => {
    selectPOI(poi);
    bottomSheetRef.current?.expand();
  }, [selectPOI]);

  // Handle bottom sheet close
  const handleBottomSheetClose = useCallback(() => {
    selectPOI(null);
  }, [selectPOI]);

  // Handle directions request
  const handleGetDirections = useCallback((poi: POI) => {
    directionsSheetRef.current?.showDirections(poi);
  }, []);

  // Center on user location
  const handleCenterOnUser = useCallback(() => {
    if (userLocation) {
      mapRef.current?.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 17,
        duration: 1000,
      });
    }
  }, [userLocation]);

  // Handle filter change
  const handleFilterChange = useCallback((category: POICategory | null) => {
    setFilterCategory(category);
  }, [setFilterCategory]);

  // Get filtered POIs
  const pois = getAllPOIs();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Chargement de la carte...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Erreur</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchMapData('current-festival')}
          >
            <Text style={styles.retryButtonText}>Reessayer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          pois={pois}
          userLocation={showUserLocation ? userLocation : null}
          onPOISelect={handlePOISelect}
          selectedPOI={selectedPOI}
        />

        {/* Filter bar */}
        <View style={styles.filterBarContainer}>
          <FilterBar
            selectedCategory={filterCategory}
            onCategoryChange={handleFilterChange}
          />
        </View>

        {/* Map controls */}
        <View style={styles.mapControls}>
          {/* Center on user location button */}
          <TouchableOpacity
            style={[
              styles.controlButton,
              !userLocation && styles.controlButtonDisabled,
            ]}
            onPress={handleCenterOnUser}
            disabled={!userLocation}
          >
            <Ionicons
              name={showUserLocation ? 'locate' : 'locate-outline'}
              size={24}
              color={userLocation ? '#6366F1' : '#9CA3AF'}
            />
          </TouchableOpacity>

          {/* Toggle user location visibility */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleUserLocation}
          >
            <Ionicons
              name={showUserLocation ? 'eye' : 'eye-off'}
              size={24}
              color={showUserLocation ? '#6366F1' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>

        {/* Location loading indicator */}
        {isLoadingLocation && (
          <View style={styles.locationLoadingContainer}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.locationLoadingText}>Localisation...</Text>
          </View>
        )}

        {/* Location permission denied message */}
        {locationPermission === false && (
          <View style={styles.permissionBanner}>
            <Ionicons name="location-outline" size={18} color="#F59E0B" />
            <Text style={styles.permissionText}>
              Activez la localisation pour voir votre position
            </Text>
          </View>
        )}
      </View>

      {/* POI Bottom Sheet */}
      <POIBottomSheet
        ref={bottomSheetRef}
        poi={selectedPOI}
        onClose={handleBottomSheetClose}
        userLocation={userLocation}
        onGetDirections={handleGetDirections}
      />

      {/* Directions Sheet */}
      <DirectionsSheet
        ref={directionsSheetRef}
        userLocation={userLocation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  filterBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  mapControls: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    gap: 8,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  controlButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366F1',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  locationLoadingContainer: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  locationLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  permissionBanner: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  permissionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#92400E',
    flex: 1,
  },
});
