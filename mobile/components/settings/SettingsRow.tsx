import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';

interface SettingsRowBaseProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBgColor?: string;
  label: string;
  description?: string;
  isLast?: boolean;
}

interface SettingsRowLinkProps extends SettingsRowBaseProps {
  type: 'link';
  value?: string;
  onPress: () => void;
}

interface SettingsRowToggleProps extends SettingsRowBaseProps {
  type: 'toggle';
  value: boolean;
  onValueChange: (value: boolean) => void;
}

interface SettingsRowValueProps extends SettingsRowBaseProps {
  type: 'value';
  value: string;
  onPress?: () => void;
}

interface SettingsRowCustomProps extends SettingsRowBaseProps {
  type: 'custom';
  children: ReactNode;
}

type SettingsRowProps =
  | SettingsRowLinkProps
  | SettingsRowToggleProps
  | SettingsRowValueProps
  | SettingsRowCustomProps;

export function SettingsRow(props: SettingsRowProps) {
  const {
    icon,
    iconColor = '#6366F1',
    iconBgColor = 'bg-gray-100',
    label,
    description,
    isLast = false,
  } = props;

  const renderIcon = () => {
    if (!icon) return null;
    return (
      <View className={`w-10 h-10 ${iconBgColor} rounded-full items-center justify-center mr-3`}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
    );
  };

  const renderContent = () => {
    switch (props.type) {
      case 'link':
        return (
          <TouchableOpacity
            onPress={props.onPress}
            className={`flex-row items-center p-4 ${!isLast ? 'border-b border-gray-100' : ''}`}
            activeOpacity={0.7}
          >
            {renderIcon()}
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">{label}</Text>
              {description && <Text className="text-xs text-gray-500 mt-0.5">{description}</Text>}
            </View>
            {props.value && <Text className="text-gray-400 text-sm mr-2">{props.value}</Text>}
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        );

      case 'toggle':
        return (
          <View
            className={`flex-row items-center p-4 ${!isLast ? 'border-b border-gray-100' : ''}`}
          >
            {renderIcon()}
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">{label}</Text>
              {description && <Text className="text-xs text-gray-500 mt-0.5">{description}</Text>}
            </View>
            <Switch
              value={props.value}
              onValueChange={props.onValueChange}
              trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
              thumbColor="#FFFFFF"
            />
          </View>
        );

      case 'value':
        const ValueWrapper = props.onPress ? TouchableOpacity : View;
        return (
          <ValueWrapper
            onPress={props.onPress}
            className={`flex-row items-center p-4 ${!isLast ? 'border-b border-gray-100' : ''}`}
            {...(props.onPress && { activeOpacity: 0.7 })}
          >
            {renderIcon()}
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">{label}</Text>
              {description && <Text className="text-xs text-gray-500 mt-0.5">{description}</Text>}
            </View>
            <Text className="text-gray-400 text-sm">{props.value}</Text>
            {props.onPress && <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
          </ValueWrapper>
        );

      case 'custom':
        return (
          <View
            className={`flex-row items-center p-4 ${!isLast ? 'border-b border-gray-100' : ''}`}
          >
            {renderIcon()}
            <View className="flex-1">
              <Text className="text-gray-900 font-medium">{label}</Text>
              {description && <Text className="text-xs text-gray-500 mt-0.5">{description}</Text>}
            </View>
            {props.children}
          </View>
        );

      default:
        return null;
    }
  };

  return renderContent();
}

export default SettingsRow;
