import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Stand, getStandCategoryIcon, getCategoryColor, StandCategory } from '@/stores/mapStore';

interface StandMarkerProps {
  stand: Stand;
  onPress: () => void;
  isSelected?: boolean;
}

const getCategoryMarkerColor = (category: StandCategory): string => {
  const colorMap: Record<StandCategory, string> = {
    food: '#F97316',
    drink: '#EAB308',
    merch: '#EC4899',
    sponsor: '#6366F1',
    craft: '#8B5CF6',
  };
  return colorMap[category] || '#6366F1';
};

export function StandMarker({ stand, onPress, isSelected = false }: StandMarkerProps) {
  const iconName = getStandCategoryIcon(stand.category);
  const markerColor = getCategoryMarkerColor(stand.category);

  return (
    <Marker
      coordinate={stand.location}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={styles.container}>
        {/* Marker Pin */}
        <View
          style={[
            styles.markerContainer,
            { backgroundColor: markerColor },
            isSelected && styles.selectedMarker,
          ]}
        >
          <Ionicons
            name={iconName as any}
            size={18}
            color="white"
          />
        </View>

        {/* Marker Pointer */}
        <View
          style={[
            styles.pointer,
            { borderTopColor: markerColor },
          ]}
        />

        {/* Name Label */}
        {isSelected && (
          <View style={styles.labelContainer}>
            <Text style={styles.labelText} numberOfLines={1}>
              {stand.name}
            </Text>
          </View>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 2,
    borderColor: 'white',
  },
  selectedMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
  pointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  labelContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
    maxWidth: 120,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});

export default StandMarker;
