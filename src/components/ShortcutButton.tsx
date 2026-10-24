import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useHaptics } from '../hooks/useHaptics';
import { StreamingAppId } from '../types/remote';
import { STREAMING_APPS, THEME } from '../utils/constants';

interface ShortcutButtonProps {
  appId: StreamingAppId;
  onPress: (appId: StreamingAppId) => void;
  disabled?: boolean;
}

// Authentic Netflix 'N' Ribbon Vector
const NetflixLogo: React.FC = () => (
  <Svg width={18} height={22} viewBox="0 0 18 24">
    <Path d="M0 0h5.5v24H0z" fill="#B81D24" />
    <Path d="M12.5 0H18v24h-5.5z" fill="#B81D24" />
    <Path d="M0 0h5.5l12.5 24h-5.5L0 0z" fill="#E50914" />
  </Svg>
);

// Authentic YouTube Screen & Play Triangle Vector
const YouTubeLogo: React.FC = () => (
  <Svg width={25} height={18} viewBox="0 0 28 20">
    <Rect x="0" y="0" width="28" height="20" rx="5" ry="5" fill="#FF0000" />
    <Path d="M11 5.5l8 4.5-8 4.5z" fill="#FFFFFF" />
  </Svg>
);

// Authentic Hotstar Sparkling Star & Comet Tail Vector
const HotstarLogo: React.FC = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    <Path
      d="M3 15c4-1 7.5-4.5 9-9 1 4 4.5 7.5 9 9-4.5 1-7.5 4.5-9 9-1-4-4.5-7.5-9-9z"
      fill="#00D2FF"
      opacity={0.8}
    />
    <Path
      d="M12 2l2.6 5.8 6.4.6-4.8 4.2 1.4 6.2L12 15.6l-5.6 3.2 1.4-6.2-4.8-4.2 6.4-.6L12 2z"
      fill="#FFCC00"
    />
  </Svg>
);

export const ShortcutButton: React.FC<ShortcutButtonProps> = ({
  appId,
  onPress,
  disabled = false,
}) => {
  const { triggerMedium } = useHaptics();
  const info = STREAMING_APPS[appId];

  const renderIcon = () => {
    switch (appId) {
      case 'netflix':
        return <NetflixLogo />;
      case 'hotstar':
        return <HotstarLogo />;
      case 'youtube':
        return <YouTubeLogo />;
    }
  };

  const handlePress = () => {
    if (disabled) return;
    triggerMedium();
    onPress(appId);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      android_disableSound={true}
      accessibilityLabel={`Launch ${info.name}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: THEME.colors.surfaceBorder,
          transform: [{ scale: pressed ? 0.95 : 1 }],
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <View style={[styles.iconBadge, { backgroundColor: info.accentColor + '20', borderColor: info.accentColor + '50' }]}>
        {renderIcon()}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {info.name}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flex: 1,
    height: 72,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginHorizontal: 4,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
  },
  label: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
