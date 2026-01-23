import { View, Text } from 'react-native';
import { ReactNode } from 'react';

interface SettingsSectionProps {
  title?: string;
  children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View className="mb-6">
      {title && (
        <Text className="text-sm font-medium text-gray-500 mb-2 px-1 uppercase tracking-wide">
          {title}
        </Text>
      )}
      <View className="bg-white rounded-xl overflow-hidden">{children}</View>
    </View>
  );
}

export default SettingsSection;
