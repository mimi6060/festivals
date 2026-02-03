import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { POICategory, getCategoryIcon, getCategoryLabel, getCategoryColor } from '@/stores/mapStore';

interface FilterItem {
  category: POICategory | null;
  icon: string;
  label: string;
  color: string;
}

const FILTER_ITEMS: FilterItem[] = [
  { category: null, icon: 'apps-outline', label: 'Tout', color: '#6B7280' },
  { category: 'stage', icon: 'musical-notes-outline', label: 'Scenes', color: '#8B5CF6' },
  { category: 'drink', icon: 'beer-outline', label: 'Bars', color: '#EAB308' },
  { category: 'food', icon: 'fast-food-outline', label: 'Food', color: '#F97316' },
  { category: 'toilet', icon: 'water-outline', label: 'WC', color: '#3B82F6' },
  { category: 'first_aid', icon: 'medkit-outline', label: 'Secours', color: '#EF4444' },
  { category: 'charging', icon: 'battery-charging-outline', label: 'Recharge', color: '#84CC16' },
  { category: 'info', icon: 'information-circle-outline', label: 'Info', color: '#06B6D4' },
  { category: 'entrance', icon: 'enter-outline', label: 'Entrees', color: '#22C55E' },
  { category: 'merch', icon: 'shirt-outline', label: 'Boutique', color: '#EC4899' },
  { category: 'atm', icon: 'card-outline', label: 'ATM', color: '#0EA5E9' },
  { category: 'parking', icon: 'car-outline', label: 'Parking', color: '#6B7280' },
];

interface FilterBarProps {
  selectedCategory: POICategory | null;
  onCategoryChange: (category: POICategory | null) => void;
}

const FilterChip = memo<{
  item: FilterItem;
  isSelected: boolean;
  onPress: () => void;
}>(({ item, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        isSelected && { backgroundColor: item.color },
      ]}
    >
      <Ionicons
        name={item.icon as any}
        size={18}
        color={isSelected ? 'white' : item.color}
      />
      <Text
        style={[
          styles.chipLabel,
          isSelected && styles.chipLabelSelected,
        ]}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );
});

FilterChip.displayName = 'FilterChip';

const FilterBar = memo<FilterBarProps>(({ selectedCategory, onCategoryChange }) => {
  const handleFilterPress = useCallback(
    (category: POICategory | null) => {
      onCategoryChange(category);
    },
    [onCategoryChange]
  );

  const Content = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {FILTER_ITEMS.map((item) => (
        <FilterChip
          key={item.category || 'all'}
          item={item}
          isSelected={selectedCategory === item.category}
          onPress={() => handleFilterPress(item.category)}
        />
      ))}
    </ScrollView>
  );

  // Use blur effect on iOS, solid background on Android
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={80} tint="light" style={styles.container}>
        {Content}
      </BlurView>
    );
  }

  return <View style={[styles.container, styles.androidContainer]}>{Content}</View>;
});

FilterBar.displayName = 'FilterBar';

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  androidContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    gap: 6,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  chipLabelSelected: {
    color: 'white',
  },
});

export default FilterBar;
