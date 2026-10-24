/**
 * ConnectionScreen - TV Discovery & First-Time Connection
 * Step 1 of the pairing flow: discovers Android / Google TVs and allows TV selection.
 */

import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Tv,
  Wifi,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  } = useTVConnection();

  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualHost, setManualHost] = useState('');
  const [manualName, setManualName] = useState('');

  const handleSelect = async (item: DiscoveredTV) => {
    if (onDeviceSelected) {
      onDeviceSelected(item);
    } else {
      await selectDevice(item);
    }
  };

  const handleAddManual = async () => {
    if (!manualHost.trim()) return;
    setManualModalVisible(false);
    await addManualDevice(manualHost.trim(), manualName.trim() || undefined);
    setManualHost('');
    setManualName('');
  };

  const renderItem = ({ item }: { item: DiscoveredTV }) => {
    const isThisConnected = connectionState === 'connected' && currentTv?.id === item.id;
    const isThisSelected = currentTv?.id === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.deviceCard,
          isThisConnected && styles.deviceCardConnected,
        ]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
        accessibilityLabel={`Connect to ${item.name}`}
        accessibilityRole="button"
      >
        <View style={styles.deviceIconBadge}>
          <Tv
            size={24}
            color={isThisConnected ? '#10B981' : THEME.colors.primary}
          />
        </View>

        <View style={styles.deviceDetails}>
          <Text style={styles.deviceName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.deviceIp}>
            {item.host} • {item.isPaired ? 'Previously Paired' : 'Ready to Pair'}
          </Text>
        </View>

        {isThisConnected ? (
          <View style={styles.connectedBadge}>
            <CheckCircle2 size={16} color="#10B981" />
            <Text style={styles.connectedBadgeText}>Connected</Text>
          </View>
        ) : isThisSelected && (connectionState === 'deviceSelected' || connectionState === 'pairing') ? (
          <ActivityIndicator size="small" color={THEME.colors.primary} />
        ) : (
          <ChevronRight size={20} color={THEME.colors.textMuted} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={22} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
        <Text style={styles.title}>Connect to your TV</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setManualModalVisible(true)}
          accessibilityLabel="Add TV by IP"
          accessibilityRole="button"
        >
          <Plus size={22} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Select your Android TV or Google TV on Wi-Fi to start pairing.
      </Text>

      {/* Primary "Search for TVs" Button */}
      <View style={styles.searchSection}>
        <TouchableOpacity
          style={[styles.searchButton, isScanning && styles.searchButtonActive]}
          onPress={startDiscovery}
          disabled={isScanning}
          accessibilityLabel="Search for TVs"
          accessibilityRole="button"
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
          ) : (
            <Search size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.searchButtonText}>
            {isScanning ? 'Searching Local Network...' : 'Search for TVs'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Discovered TV List */}
      <View style={styles.listSection}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>Available TVs</Text>
          <Text style={styles.countText}>{devices.length} found</Text>
        </View>

        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Wifi size={36} color={THEME.colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No TVs found yet</Text>
              <Text style={styles.emptySubtitle}>
                Make sure your Android TV is turned on and connected to the same Wi-Fi network, then tap "Search for TVs".
              </Text>
            </View>
          }
        />
      </View>

      {/* Manual IP Entry Modal */}
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
                  !manualHost.trim() && styles.modalConnectDisabled,
                ]}
                onPress={handleAddManual}
                disabled={!manualHost.trim()}
              >
                <Text style={styles.modalConnectText}>Pair TV</Text>
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
    paddingVertical: 12,
  },
  backButton: {
    padding: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  addButton: {
    padding: 6,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  searchSection: {
    marginBottom: 20,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.primary,
  },
  searchButtonActive: {
    opacity: 0.8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  listSection: {
    flex: 1,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  countText: {
    fontSize: 12,
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
    padding: 16,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  deviceCardConnected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  deviceIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  deviceIp: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  connectedBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
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
    borderRadius: THEME.borderRadius.lg,
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
