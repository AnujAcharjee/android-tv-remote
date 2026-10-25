/**
 * ConnectionScreen - TV Discovery & First-Time Connection
 * Clean, minimalist, clutter-free screen for discovering and pairing Smart TVs.
 */

import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Plus,
  RefreshCw,
  Tv,
  Wifi,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHaptics } from '../hooks/useHaptics';
import { useTVConnection } from '../hooks/useTVConnection';
import { DiscoveredTV } from '../types/device';
import { THEME } from '../utils/constants';

interface ConnectionScreenProps {
  onBack?: () => void;
  onDeviceSelected?: (tv: DiscoveredTV) => void;
}

export const ConnectionScreen: React.FC<ConnectionScreenProps> = ({
  onBack,
  onDeviceSelected,
}) => {
  const {
    connectionState,
    currentTv,
    devices,
    isScanning,
    startDiscovery,
    selectDevice,
    addManualDevice,
    forgetDevice,
  } = useTVConnection();

  const { triggerLight, triggerMedium } = useHaptics();

  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualHost, setManualHost] = useState('');
  const [manualName, setManualName] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);

  // Automatically discover TVs on the local network as soon as the screen opens
  React.useEffect(() => {
    startDiscovery();
  }, []);

  // Deduplicate discovered devices strictly by host/IP address
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

  const handleSelect = async (item: DiscoveredTV) => {
    triggerMedium();
    if (onDeviceSelected) {
      onDeviceSelected(item);
    } else {
      await selectDevice(item);
    }
  };

  const handleLongPress = (item: DiscoveredTV) => {
    triggerLight();
    Alert.alert(
      item.name,
      `IP: ${item.host}\nProtocol: ${getProtocolLabel(item)}`,
      [
        ...(item.isPaired
          ? [
              {
                text: 'Forget Device',
                style: 'destructive' as const,
                onPress: () => forgetDevice(item),
              },
            ]
          : []),
        {
          text: 'Connect',
          onPress: () => handleSelect(item),
        },
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const handleAddManual = async () => {
    if (!manualHost.trim() || isDetecting) return;
    setIsDetecting(true);
    try {
      await addManualDevice(manualHost.trim(), manualName.trim() || undefined);
      setManualModalVisible(false);
      setManualHost('');
      setManualName('');
    } finally {
      setIsDetecting(false);
    }
  };

  const getProtocolLabel = (item: DiscoveredTV): string => {
    if (item.protocolType === 'webos' || item.pairingPort === 3001 || item.remotePort === 3001) {
      return 'LG webOS';
    }
    if (item.protocolType === 'androidtv' || item.pairingPort === 6467) {
      return 'Android TV';
    }
    return 'Smart TV';
  };

  const renderItem = ({ item }: { item: DiscoveredTV }) => {
    const isThisConnected = connectionState === 'connected' && currentTv?.host === item.host;
    const isThisSelected = currentTv?.host === item.host;
    const protocolLabel = getProtocolLabel(item);

    return (
      <TouchableOpacity
        style={[
          styles.deviceCard,
          isThisConnected && styles.deviceCardConnected,
        ]}
        onPress={() => handleSelect(item)}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.7}
        accessibilityLabel={`Connect to ${item.name}`}
        accessibilityRole="button"
      >
        <View
          style={[
            styles.deviceIconBadge,
            isThisConnected && styles.deviceIconBadgeConnected,
            item.isPaired && !isThisConnected && styles.deviceIconBadgePaired,
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

        <View style={styles.deviceDetails}>
          <Text style={styles.deviceName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.deviceMeta} numberOfLines={1}>
            {protocolLabel} • {item.host}
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
            <Text style={styles.pairedBadgeText}>Paired</Text>
          </View>
        ) : (
          <ChevronRight size={18} color={THEME.colors.textMuted} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={onBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={20} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerIconButton}>
            <Tv size={20} color={THEME.colors.primary} />
          </View>
        )}

        <View style={styles.headerTitleGroup}>
          <Text style={styles.title}>Available TVs</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => {
              triggerLight();
              startDiscovery();
            }}
            disabled={isScanning}
            accessibilityLabel="Rescan Wi-Fi"
            accessibilityRole="button"
          >
            {isScanning ? (
              <ActivityIndicator size="small" color={THEME.colors.primary} />
            ) : (
              <RefreshCw size={18} color={THEME.colors.textSecondary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => {
              triggerLight();
              setManualModalVisible(true);
            }}
            accessibilityLabel="Add TV by IP"
            accessibilityRole="button"
          >
            <Plus size={20} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SCANNING & STATUS BANNER */}
      {isScanning ? (
        <View style={styles.scanningBanner}>
          <ActivityIndicator size="small" color={THEME.colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.scanningText}>Searching local Wi-Fi for TVs...</Text>
        </View>
      ) : (
        <View style={styles.statusRow}>
          <Text style={styles.statusSubtitle}>
            {uniqueDevices.length === 0
              ? 'No TVs discovered on current Wi-Fi network'
              : `${uniqueDevices.length} TV${uniqueDevices.length === 1 ? '' : 's'} found • Tap to connect`}
          </Text>
        </View>
      )}

      {/* DISCOVERED TV LIST */}
      <FlatList
        data={uniqueDevices}
        keyExtractor={(item) => item.host}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isScanning ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Wifi size={32} color={THEME.colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No TVs Found</Text>
              <Text style={styles.emptySubtitle}>
                Make sure your TV is turned on and connected to the same Wi-Fi network as this phone.
              </Text>

              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={styles.emptyRescanButton}
                  onPress={() => {
                    triggerLight();
                    startDiscovery();
                  }}
                  activeOpacity={0.8}
                >
                  <RefreshCw size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.emptyRescanText}>Rescan Wi-Fi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.emptyManualButton}
                  onPress={() => {
                    triggerLight();
                    setManualModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyManualText}>Connect by IP Address</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : undefined
        }
      />

      {/* FOOTER HELPER */}
      {uniqueDevices.length > 0 ? (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerLink}
            onPress={() => setManualModalVisible(true)}
            activeOpacity={0.7}
          >
            <Plus size={14} color={THEME.colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.footerLinkText}>Can't find your TV? Connect by IP</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* MANUAL IP ENTRY MODAL */}
      <Modal
        visible={manualModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setManualModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Connect by IP Address</Text>
            <Text style={styles.modalSubtitle}>
              Enter your TV's local IP address (found in TV Settings &gt; Network).
            </Text>

            <TextInput
              style={styles.modalInput}
              value={manualHost}
              onChangeText={setManualHost}
              placeholder="e.g. 192.168.1.50"
              placeholderTextColor={THEME.colors.textMuted}
              keyboardType="numeric"
              autoFocus
            />

            <TextInput
              style={styles.modalInput}
              value={manualName}
              onChangeText={setManualName}
              placeholder="TV Name (optional)"
              placeholderTextColor={THEME.colors.textMuted}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setManualModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConnectButton,
                  (!manualHost.trim() || isDetecting) && styles.modalConnectDisabled,
                ]}
                onPress={handleAddManual}
                disabled={!manualHost.trim() || isDetecting}
              >
                {isDetecting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConnectText}>Pair TV</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  scanningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 128, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 128, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  scanningText: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  statusRow: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  statusSubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  deviceCardConnected: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  deviceIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  deviceIconBadgeConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  deviceIconBadgePaired: {
    backgroundColor: 'rgba(79, 128, 255, 0.12)',
  },
  deviceDetails: {
    flex: 1,
    marginRight: 10,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 3,
  },
  deviceMeta: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  connectedBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  pairedBadge: {
    backgroundColor: 'rgba(79, 128, 255, 0.1)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(79, 128, 255, 0.2)',
  },
  pairedBadgeText: {
    color: THEME.colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 290,
    marginBottom: 24,
  },
  emptyActions: {
    width: '100%',
    maxWidth: 260,
    gap: 10,
  },
  emptyRescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    height: 46,
    borderRadius: 12,
  },
  emptyRescanText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyManualButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  emptyManualText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  footerLinkText: {
    color: THEME.colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: THEME.colors.surface,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    lineHeight: 18,
    marginBottom: 18,
  },
  modalInput: {
    backgroundColor: THEME.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    color: THEME.colors.textPrimary,
    fontSize: 15,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    color: THEME.colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  modalConnectButton: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalConnectDisabled: {
    opacity: 0.4,
  },
  modalConnectText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
