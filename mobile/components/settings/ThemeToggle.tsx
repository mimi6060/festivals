import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Theme = 'light' | 'dark' | 'system';

interface ThemeToggleProps {
  value: Theme;
  onChange: (theme: Theme) => void;
}

interface ThemeOption {
  key: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { key: 'light', icon: 'sunny-outline', label: 'Clair' },
  { key: 'dark', icon: 'moon-outline', label: 'Sombre' },
  { key: 'system', icon: 'phone-portrait-outline', label: 'Systeme' },
];

export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <View className="flex-row bg-gray-100 rounded-lg p-1">
      {THEME_OPTIONS.map((option) => {
        const isSelected = value === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => onChange(option.key)}
            className={`flex-1 flex-row items-center justify-center py-2 px-3 rounded-md ${
              isSelected ? 'bg-white shadow-sm' : ''
            }`}
            activeOpacity={0.7}
          >
            <Ionicons
              name={option.icon}
              size={16}
              color={isSelected ? '#6366F1' : '#6B7280'}
            />
            <Text
              className={`ml-1.5 text-sm font-medium ${
                isSelected ? 'text-primary' : 'text-gray-500'
              }`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default ThemeToggle;
