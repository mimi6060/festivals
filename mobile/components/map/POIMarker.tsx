import React, { memo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  POI,
  getCategoryIcon,
  getCategoryColor,
  getStandCategoryIcon,
  POICategory,
} from '@/stores/mapStore';

interface POIMarkerProps {
  poi: POI;
  isSelected: boolean;
  onPress: (poi: POI) => void;
}

const POIMarker = memo<POIMarkerProps>(({ poi, isSelected, onPress }) => {
  const handlePress = useCallback(() => {
    onPress(poi);
  }, [poi, onPress]);

  // Get icon based on POI type
  const getIcon = (): string => {
    if (poi.poiType === 'stand') {
      return getStandCategoryIcon(poi.category);
    }
    if (poi.poiType === 'stage') {
      return 'musical-notes';
    }
    return getCategoryIcon(poi.type as POICategory);
  };

  // Get color based on POI type
  const getColor = (): string => {
    if (poi.poiType === 'stand') {
      const colorMap: Record<string, string> = {
        food: '#F97316',
        drink: '#EAB308',
        merch: '#EC4899',
        sponsor: '#6366F1',
        craft: '#8B5CF6',
      };
      return colorMap[poi.category] || '#6366F1';
    }
    if (poi.poiType === 'stage') {
      return poi.color;
    }
    return getCategoryColor(poi.type as POICategory);
  };

  const iconName = getIcon();
  const color = getColor();
  const markerSize = isSelected ? 44 : 36;
  const iconSize = isSelected ? 22 : 18;

  return (
    <MapLibreGL.MarkerView
      id={poi.id}
      coordinate={[poi.location.longitude, poi.location.latitude]}
      anchor={{ x: 0.5, y: 1 }}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={styles.markerContainer}
      >
        <View
          style={[
            styles.marker,
            {
              backgroundColor: color,
              width: markerSize,
              height: markerSize,
              borderRadius: markerSize / 2,
            },
            isSelected && styles.markerSelected,
          ]}
        >
          <Ionicons name={iconName as any} size={iconSize} color="white" />
        </View>
        <View style={[styles.markerTip, { borderTopColor: color }]} />

        {/* Show name label when selected */}
        {isSelected && (
          <View style={styles.labelContainer}>
            <Text style={styles.labelText} numberOfLines={1}>
              {poi.name}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </MapLibreGL.MarkerView>
  );
});

POIMarker.displayName = 'POIMarker';

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerSelected: {
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  markerTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  labelContainer: {
    position: 'absolute',
    top: -30,
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    maxWidth: 150,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
});

export default POIMarker;
