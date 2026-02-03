import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { MapStage } from '@/stores/mapStore';

interface StageMarkerProps {
  stage: MapStage;
  onPress: () => void;
  isSelected?: boolean;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StageMarker({ stage, onPress, isSelected = false }: StageMarkerProps) {
  const hasCurrentPerformance = !!stage.currentPerformance;

  return (
    <Marker
      coordinate={stage.location}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={styles.container}>
        {/* Current Performance Indicator */}
        {hasCurrentPerformance && (
          <View style={styles.nowPlayingBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.nowPlayingText}>EN DIRECT</Text>
          </View>
        )}

        {/* Marker Pin */}
        <View
          style={[
            styles.markerContainer,
            { backgroundColor: stage.color },
            isSelected && styles.selectedMarker,
            hasCurrentPerformance && styles.activeMarker,
          ]}
        >
          <Ionicons
            name="musical-notes"
            size={hasCurrentPerformance ? 22 : 18}
            color="white"
          />
        </View>

        {/* Marker Pointer */}
        <View
          style={[
            styles.pointer,
            { borderTopColor: stage.color },
          ]}
        />

        {/* Stage Name Label */}
        <View
          style={[
            styles.labelContainer,
            { borderLeftColor: stage.color },
          ]}
        >
          <Text style={styles.stageName} numberOfLines={1}>
            {stage.name}
          </Text>
          {hasCurrentPerformance && (
            <Text style={styles.artistName} numberOfLines={1}>
              {stage.currentPerformance.artistName}
            </Text>
          )}
          {!hasCurrentPerformance && stage.nextPerformance && (
            <Text style={styles.nextInfo} numberOfLines={1}>
              {formatTime(stage.nextPerformance.startTime)} - {stage.nextPerformance.artistName}
            </Text>
          )}
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  nowPlayingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    marginRight: 4,
  },
  nowPlayingText: {
    fontSize: 8,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.5,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 7,
    borderWidth: 3,
    borderColor: 'white',
  },
  selectedMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    transform: [{ scale: 1.1 }],
  },
  activeMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  pointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -3,
  },
  labelContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2.62,
    elevation: 4,
    maxWidth: 150,
    borderLeftWidth: 3,
  },
  stageName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'left',
  },
  artistName: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6366F1',
    marginTop: 2,
  },
  nextInfo: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 2,
  },
});

export default StageMarker;
