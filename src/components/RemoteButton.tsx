/**
 * Remote Button Component
 * Responsive, rounded touch button with haptic feedback, subtle border, and pressed state.
 */

import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { useHaptics } from '../hooks/useHaptics';
import { THEME } from '../utils/constants';

interface RemoteButtonProps {
  icon?: React.ReactNode;
  label?: string;
  onPress: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'primary' | 'danger' | 'surfaceElevated';
  size?: 'sm' | 'md' | 'lg' | 'pill';
  disabled?: boolean;
  accessibilityLabel?: string;
}

export const RemoteButton: React.FC<RemoteButtonProps> = ({
  icon,
  label,
  onPress,
  onLongPress,
  style,
  variant = 'default',
  size = 'md',
  disabled = false,
  accessibilityLabel,
}) => {
  const { triggerLight } = useHaptics();

  const handlePress = () => {
    if (disabled) return;
    triggerLight();
    onPress();
  };

  const handleLongPress = () => {
    if (disabled || !onLongPress) return;
    triggerLight();
    onLongPress();
  };

  const getBackgroundColor = (pressed: boolean) => {
    if (disabled) return THEME.colors.surface;
    if (pressed) {
      if (variant === 'primary') return THEME.colors.primaryDark;
      if (variant === 'danger') return '#991B1B';
      return THEME.colors.surfaceElevated;
    }
    if (variant === 'primary') return THEME.colors.primary;
    if (variant === 'danger') return THEME.colors.accentRed;
    if (variant === 'surfaceElevated') return THEME.colors.surfaceElevated;
    return THEME.colors.surface;
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'lg':
        return styles.sizeLg;
      case 'pill':
        return styles.sizePill;
      case 'md':
      default:
        return styles.sizeMd;
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      disabled={disabled}
      android_disableSound={true}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        getSizeStyle(),
        {
          backgroundColor: getBackgroundColor(pressed),
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
        style,
      ]}
    >
      {icon}
      {label ? (
        <Text
          style={[
            styles.label,
            variant === 'primary' ? styles.primaryLabel : null,
          ]}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  sizeSm: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  sizeMd: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  sizeLg: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  sizePill: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: THEME.borderRadius.full,
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  primaryLabel: {
    color: '#FFFFFF',
  },
});
