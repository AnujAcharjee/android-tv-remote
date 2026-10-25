/**
 * ConnectionStatus Component
 * Displays the centered connection status pill and active TV name in the header.
 */

import { Settings, Wifi, WifiOff } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useHaptics } from '../hooks/useHaptics';
import { DiscoveredTV, TVConnectionState } from '../types/device';
import { THEME } from '../utils/constants';

interface ConnectionStatusProps {
  state: TVConnectionState;
  currentTv: DiscoveredTV | null;
  onOpenSettings?: () => void;
  onOpenConnections: () => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  state,
  currentTv,
  onOpenSettings,
  onOpenConnections,
}) => {
  const { triggerLight } = useHaptics();

  const getStatusInfo = () => {
    switch (state) {
      case 'connected':
        return {
          label: currentTv?.name || 'Connected',
          color: '#10B981',
          icon: <Wifi size={14} color="#10B981" />,
        };
      case 'deviceSelected':
        return {
          label: 'Connecting...',
          color: THEME.colors.accentOrange,
          icon: <Wifi size={14} color={THEME.colors.accentOrange} />,
        };
      case 'awaitingPrompt':
        return {
          label: 'Confirm on TV',
          color: THEME.colors.accentOrange,
          icon: <Wifi size={14} color={THEME.colors.accentOrange} />,
        };
      case 'awaitingCode':
      case 'pairing':
        return {
          label: 'Enter Code',
          color: THEME.colors.accentOrange,
          icon: <Wifi size={14} color={THEME.colors.accentOrange} />,
        };
      case 'discovering':
        return {
          label: 'Searching TVs...',
          color: THEME.colors.primary,
          icon: <Wifi size={14} color={THEME.colors.primary} />,
        };
      case 'failed':
        return {
          label: 'Pairing Failed',
          color: THEME.colors.accentRed,
          icon: <WifiOff size={14} color={THEME.colors.accentRed} />,
        };
      case 'idle':
      default:
        return {
          label: 'Not Connected',
          color: THEME.colors.textMuted,
          icon: <WifiOff size={14} color={THEME.colors.textMuted} />,
        };
    }
  };

  const status = getStatusInfo();

  return (
    <View style={styles.header}>
      {/* Left spacer to keep center pill mathematically centered */}
      <View style={styles.sideSpacer} />

      {/* Connection status pill centered in both X and Y */}
      <Pressable
        onPress={() => {
          triggerLight();
          onOpenConnections();
        }}
        accessibilityLabel="Connection Status"
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.statusPill,
          { borderColor: status.color + '40', opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <View style={[styles.statusDot, { backgroundColor: status.color }]} />
        {status.icon}
        <Text style={[styles.statusText, { color: status.color }]} numberOfLines={1}>
          {status.label}
        </Text>
      </Pressable>

      {/* Settings icon button on the right */}
      {onOpenSettings ? (
        <Pressable
          onPress={() => {
            triggerLight();
            onOpenSettings();
          }}
          accessibilityLabel="Settings"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.settingsButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Settings size={20} color={THEME.colors.textSecondary} />
        </Pressable>
      ) : (
        <View style={styles.sideSpacer} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceBorder,
    width: '100%',
  },
  sideSpacer: {
    width: 40,
    height: 40,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    gap: 8,
    maxWidth: 240,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
