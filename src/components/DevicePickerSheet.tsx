/**
 * DevicePickerSheet Component
 * Clean, calm bottom sheet displaying discoverable TVs on the local Wi-Fi.
 * Deduplicates devices and presents a unified, premium dark UI.
 */

import {
  CheckCircle2,
  ChevronRight,
  Plus,
  RefreshCw,
  Tv,
  Wifi,
  X,
} from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
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
  currentTvId?: string;
  currentTvHost?: string;
  connectionState?: string;
  onSelectDevice: (device: DiscoveredTV) => void;
  onScanAgain: () => void;
  onConnectByIp: () => void;
  onDismiss: () => void;
}

export const DevicePickerSheet: React.FC<DevicePickerSheetProps> = ({
  visible,
  devices,
  isScanning,
  currentTvId,
  currentTvHost,
  connectionState,
  onSelectDevice,
  onScanAgain,
  onConnectByIp,
  onDismiss,
}) => {
  const { triggerLight, triggerMedium } = useHaptics();

  // Deduplicate devices by IP address to eliminate chaotic duplicate rows
  const uniqueDevices = useMemo(() => {
    const map = new Map<string, DiscoveredTV>();
    for (const dev of devices) {
      if (!map.has(dev.host)) {
        map.set(dev.host, dev);
      } else {
        const existing = map.get(dev.host)!;
        if (!existing.isPaired && dev.isPaired) {
          map.set(dev.host, dev);
        }
      }
    }
    return Array.from(map.values());
  }, [devices]);

  const getProtocolLabel = (item: DiscoveredTV): string => {
    if (item.protocolType === 'webos' || item.pairingPort === 3001 || item.remotePort === 3001) {
      return 'LG webOS';
    }
    if (item.protocolType === 'androidtv' || item.pairingPort === 6467 || item.remotePort === 6466) {
      return 'Android TV';
    }
    return 'Smart TV';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
          {/* DRAG HANDLE */}
          <View style={styles.handleBar} />

          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>Available TVs</Text>
              <Text style={styles.subtitle}>
                {isScanning ? 'Scanning Wi-Fi...' : `${uniqueDevices.length} TV${uniqueDevices.length === 1 ? '' : 's'} found`}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => {
                  triggerLight();
                  onScanAgain();
                }}
                disabled={isScanning}
                style={styles.iconButton}
                accessibilityLabel="Scan again"
              >
                {isScanning ? (
                  <ActivityIndicator size="small" color={THEME.colors.primary} />
                ) : (
                  <RefreshCw size={18} color={THEME.colors.textSecondary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  triggerLight();
                  onDismiss();
                }}
                style={styles.iconButton}
                accessibilityLabel="Close"
              >
                <X size={20} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* DEVICE LIST */}
          <ScrollView
            style={styles.deviceList}
            contentContainerStyle={styles.deviceListContent}
            showsVerticalScrollIndicator={false}
          >
            {uniqueDevices.length > 0 ? (
              uniqueDevices.map((item) => {
                const protocol = getProtocolLabel(item);
                const isThisConnected =
                  connectionState === 'connected' &&
                  (currentTvHost ? currentTvHost === item.host : currentTvId === item.id);
                const isThisSelected =
                  currentTvHost ? currentTvHost === item.host : currentTvId === item.id;

                return (
                  <TouchableOpacity
                    key={item.host}
                    style={[
                      styles.deviceCard,
                      isThisConnected && styles.deviceCardConnected,
                    ]}
                    onPress={() => {
                      triggerMedium();
                      onSelectDevice(item);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.deviceIconWrapper,
                        isThisConnected && styles.deviceIconWrapperConnected,
                        item.isPaired && !isThisConnected && styles.deviceIconWrapperPaired,
                      ]}
                    >
                      <Tv
                        size={22}
                        color={
                          isThisConnected
                            ? '#10B981'
                            : item.isPaired
                            ? THEME.colors.primary
                            : THEME.colors.textSecondary
                        }
                      />
                    </View>

                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.deviceMeta} numberOfLines={1}>
                        {protocol} • {item.host}
                      </Text>
                    </View>

                    {isThisConnected ? (
                      <View style={styles.connectedBadge}>
                        <CheckCircle2 size={13} color="#10B981" />
                        <Text style={styles.connectedBadgeText}>Connected</Text>
                      </View>
                    ) : isThisSelected && (connectionState === 'deviceSelected' || connectionState === 'pairing') ? (
                      <ActivityIndicator size="small" color={THEME.colors.primary} />
                    ) : item.isPaired ? (
                      <View style={styles.pairedBadge}>
                        <Text style={styles.pairedText}>Paired</Text>
                      </View>
                    ) : (
                      <ChevronRight size={18} color={THEME.colors.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Wifi size={28} color={THEME.colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>Searching for TVs...</Text>
                <Text style={styles.emptySubtitle}>
                  Make sure your TV is turned on and connected to the same Wi-Fi network.
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
              activeOpacity={0.7}
            >
              <Plus size={16} color={THEME.colors.primary} />
              <Text style={styles.manualButtonText}>Connect by IP Address</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
    maxHeight: '75%',
  },
  handleBar: {
    width: 36,
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
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  headerLeft: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  deviceList: {
    maxHeight: 300,
  },
  deviceListContent: {
    paddingBottom: 8,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  deviceCardConnected: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  deviceIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    marginRight: 14,
  },
  deviceIconWrapperConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  deviceIconWrapperPaired: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
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
    marginBottom: 2,
  },
  deviceMeta: {
    color: THEME.colors.textMuted,
    fontSize: 12,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  connectedBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  pairedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  pairedText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    marginBottom: 12,
  },
  emptyTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  footer: {
    marginTop: 12,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  manualButtonText: {
    color: THEME.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
