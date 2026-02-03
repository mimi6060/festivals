import { ScrollView, TouchableOpacity, View, Text } from 'react-native';
import { FestivalDay } from '@/stores/lineupStore';

interface DaySelectorProps {
  days: FestivalDay[];
  selectedIndex: number;
  onSelectDay: (index: number) => void;
}

export function DaySelector({ days, selectedIndex, onSelectDay }: DaySelectorProps) {
  return (
    <View className="bg-white border-b border-gray-200">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8 }}
        className="py-2"
      >
        {days.map((day, index) => {
          const isSelected = index === selectedIndex;
          return (
            <TouchableOpacity
              key={day.date}
              onPress={() => onSelectDay(index)}
              className={`mx-2 px-5 py-3 rounded-xl ${
                isSelected ? 'bg-primary' : 'bg-gray-100'
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-medium text-center ${
                  isSelected ? 'text-white' : 'text-gray-500'
                }`}
              >
                {day.dayName}
              </Text>
              <Text
                className={`text-base font-bold text-center mt-0.5 ${
                  isSelected ? 'text-white' : 'text-gray-900'
                }`}
              >
                {day.shortLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default DaySelector;
