/**
 * DevicePickerSheet Component
 * Google TV style bottom sheet modal prompted automatically on app launch
 * when no TV is connected, displaying all discoverable TVs on the Wi-Fi network.
 */

import {
  Cast,
  CheckCircle2,
  ChevronRight,
  Plus,
  RefreshCw,
  Tv,
  Wifi,
  X,
} from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useHaptics } from '../hooks/useHaptics';
import { DiscoveredTV } from '../types/device';
import { THEME } from '../utils/constants';

interface DevicePickerSheetProps {
  visible: boolean;
  devices: DiscoveredTV[];
  isScanning: boolean;
  onSelectDevice: (device: DiscoveredTV) => void;
  onScanAgain: () => void;
  onConnectByIp: () => void;
  onDismiss: () => void;
}

export const DevicePickerSheet: React.FC<DevicePickerSheetProps> = ({
  visible,
  devices,
  isScanning,
  onSelectDevice,
  onScanAgain,
  onConnectByIp,
  onDismiss,
}) => {
  const { triggerLight, triggerMedium } = useHaptics();

  const getDeviceBadge = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('google') || lower.includes('chromecast')) {
      return {
        label: 'Google TV',
        color: '#4285F4',
        icon: <Cast size={20} color="#FFFFFF" />,
      };
    }
    if (lower.includes('sony') || lower.includes('bravia')) {
      return {
        label: 'Sony BRAVIA',
        color: '#E50914',
        icon: <Tv size={20} color="#FFFFFF" />,
      };
    }
    if (lower.includes('smart') || lower.includes('living')) {
      return {
        label: 'Smart TV',
        color: '#10B981',
        icon: <Tv size={20} color="#FFFFFF" />,
      };
    }
    return {
      label: 'Android TV',
      color: THEME.colors.primary,
      icon: <Tv size={20} color="#FFFFFF" />,
    };
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* DRAG HANDLE */}
          <View style={styles.handleBar} />

          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.castIconBadge}>
                <Cast size={20} color={THEME.colors.primary} />
              </View>
              <View>
                <Text style={styles.title}>Connect to a TV</Text>
                <Text style={styles.subtitle}>
                  Select a Google TV or Android TV on your Wi-Fi
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                triggerLight();
                onDismiss();
              }}
              style={styles.closeButton}
            >
              <X size={20} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* SCANNING RADAR BANNER */}
          <View style={styles.scanningBanner}>
            <View style={styles.scanningBannerLeft}>
              <Wifi size={16} color={THEME.colors.accentGreen} />
              <Text style={styles.scanningText}>
                {isScanning ? 'Searching Wi-Fi for TVs...' : 'Ready to connect'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                triggerLight();
                onScanAgain();
              }}
              disabled={isScanning}
              style={styles.refreshButton}
            >
              {isScanning ? (
                <ActivityIndicator size="small" color={THEME.colors.primary} />
              ) : (
                <RefreshCw size={16} color={THEME.colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          {/* DEVICE LIST */}
          <ScrollView
            style={styles.deviceList}
            showsVerticalScrollIndicator={false}
          >
            {devices.length > 0 ? (
              devices.map((item) => {
                const badge = getDeviceBadge(item.name);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.deviceCard}
                    onPress={() => {
                      triggerMedium();
                      onSelectDevice(item);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.deviceIconWrapper,
                        { backgroundColor: badge.color },
                      ]}
                    >
                      {badge.icon}
                    </View>

                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.deviceIp} numberOfLines={1}>
                        {item.host} • Port {item.remotePort}
                      </Text>
                    </View>

                    {item.isPaired ? (
                      <View style={styles.pairedIndicator}>
                        <CheckCircle2
                          size={14}
                          color={THEME.colors.accentGreen}
                        />
                        <Text style={styles.pairedText}>Paired</Text>
                      </View>
                    ) : (
                      <ChevronRight
                        size={20}
                        color={THEME.colors.textSecondary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Tv size={42} color={THEME.colors.textMuted} />
                <Text style={styles.emptyTitle}>Scanning your Wi-Fi...</Text>
                <Text style={styles.emptySubtitle}>
                  Make sure your TV is turned on and connected to the same Wi-Fi.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* FOOTER ACTIONS */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => {
                triggerLight();
                onConnectByIp();
              }}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.manualButtonText}>Connect by IP Address</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => {
                triggerLight();
                onDismiss();
              }}
            >
              <Text style={styles.skipButtonText}>
                Use Remote without Connecting
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
    maxHeight: '82%',
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.colors.surfaceBorder,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  castIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
  },
  scanningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  scanningBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanningText: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  refreshButton: {
    padding: 4,
  },
  deviceList: {
    maxHeight: 280,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  deviceIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  deviceName: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  deviceIp: {
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
  pairedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  pairedText: {
    color: THEME.colors.accentGreen,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  footer: {
    marginTop: 14,
    gap: 8,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 13,
    gap: 8,
  },
  manualButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  skipButtonText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
});
