import React, {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useState,
} from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { POI, UserLocation, FESTIVAL_REGION } from '@/stores/mapStore';
import POIMarker from './POIMarker';

// Initialize MapLibre
MapLibreGL.setAccessToken(null);

export interface MapViewRef {
  flyTo: (options: { center: [number, number]; zoom?: number; duration?: number }) => void;
  fitBounds: (bounds: [[number, number], [number, number]], padding?: number) => void;
  getCenter: () => Promise<{ longitude: number; latitude: number }>;
  getZoom: () => Promise<number>;
}

interface MapViewProps {
  pois: POI[];
  userLocation: UserLocation | null;
  selectedPOI: POI | null;
  onPOISelect: (poi: POI) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  styleURL?: string;
}

const DEFAULT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const MapView = forwardRef<MapViewRef, MapViewProps>(
  (
    {
      pois,
      userLocation,
      selectedPOI,
      onPOISelect,
      initialCenter = [FESTIVAL_REGION.longitude, FESTIVAL_REGION.latitude],
      initialZoom = 16,
      styleURL = DEFAULT_STYLE_URL,
    },
    ref
  ) => {
    const mapRef = useRef<MapLibreGL.MapView>(null);
    const cameraRef = useRef<MapLibreGL.Camera>(null);
    const [mapReady, setMapReady] = useState(false);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      flyTo: ({ center, zoom = 16, duration = 1000 }) => {
        cameraRef.current?.flyTo(center, duration);
        if (zoom !== undefined) {
          cameraRef.current?.zoomTo(zoom, duration);
        }
      },
      fitBounds: (bounds, padding = 50) => {
        cameraRef.current?.fitBounds(bounds[0], bounds[1], padding, duration);
      },
      getCenter: async () => {
        const center = await mapRef.current?.getCenter();
        return {
          longitude: center?.[0] || initialCenter[0],
          latitude: center?.[1] || initialCenter[1],
        };
      },
      getZoom: async () => {
        const zoom = await mapRef.current?.getZoom();
        return zoom || initialZoom;
      },
    }));

    // Center on selected POI
    useEffect(() => {
      if (selectedPOI && mapReady) {
        cameraRef.current?.flyTo(
          [selectedPOI.location.longitude, selectedPOI.location.latitude],
          1000
        );
      }
    }, [selectedPOI, mapReady]);

    const handleMapReady = useCallback(() => {
      setMapReady(true);
    }, []);

    const handlePOIPress = useCallback(
      (poi: POI) => {
        onPOISelect(poi);
      },
      [onPOISelect]
    );

    return (
      <View style={styles.container}>
        <MapLibreGL.MapView
          ref={mapRef}
          style={styles.map}
          styleURL={styleURL}
          logoEnabled={false}
          attributionEnabled={true}
          attributionPosition={{ bottom: 8, left: 8 }}
          compassEnabled={true}
          compassViewPosition={3}
          compassViewMargins={{ x: 16, y: 100 }}
          onDidFinishLoadingMap={handleMapReady}
        >
          <MapLibreGL.Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: initialCenter,
              zoomLevel: initialZoom,
            }}
            minZoomLevel={13}
            maxZoomLevel={20}
          />

          {/* User location */}
          {userLocation && (
            <MapLibreGL.UserLocation
              visible={true}
              showsUserHeadingIndicator={true}
              animated={true}
            />
          )}

          {/* POI Markers */}
          {mapReady &&
            pois.map((poi) => (
              <POIMarker
                key={poi.id}
                poi={poi}
                isSelected={selectedPOI?.id === poi.id}
                onPress={handlePOIPress}
              />
            ))}
        </MapLibreGL.MapView>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

export default MapView;
