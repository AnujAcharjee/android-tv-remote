/**
 * SettingsScreen - Preferences, Network Diagnostics, and Troubleshooting Guide
 */

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  HelpCircle,
  Info,
  Network,
  RotateCcw,
  Trash2,
  Tv,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHaptics } from '../hooks/useHaptics';
import { useTVConnection } from '../hooks/useTVConnection';
import { StoredTVDevice } from '../types/device';
import { PROTOCOL_CONSTANTS, THEME } from '../utils/constants';
import { SecureStorageService } from '../utils/secureStorage';
import { StorageService } from '../utils/storage';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const { currentTv, connectionState, disconnect } = useTVConnection();
  const [pairedDevices, setPairedDevices] = useState<StoredTVDevice[]>([]);
  const { triggerLight, triggerSuccess } = useHaptics();

  const loadPaired = async () => {
    const list = await StorageService.getPairedDevices();
    setPairedDevices(list);
  };

  useEffect(() => {
    loadPaired();
  }, []);

  const handleForgetDevice = (deviceId: string, name: string) => {
    Alert.alert(
      'Forget TV Pairing',
      `Are you sure you want to forget "${name}"? You will need to re-enter a PIN code to connect again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            const dev = pairedDevices.find((d) => d.id === deviceId);
            if (dev) {
              await SecureStorageService.forgetDevice(deviceId, dev.host);
            } else {
              await StorageService.removePairedDevice(deviceId);
            }
            if (currentTv?.id === deviceId) {
              disconnect();
            }
            triggerSuccess();
            loadPaired();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            triggerLight();
            onBack();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings & Diagnostics</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ACTIVE CONNECTION STATUS CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Tv size={18} color={THEME.colors.primary} />
            <Text style={styles.cardTitle}>CURRENT CONNECTION</Text>
          </View>

          {currentTv ? (
            <View style={styles.infoRow}>
              <View style={styles.currentDevInfo}>
                <Text style={styles.boldText} numberOfLines={1}>{currentTv.name}</Text>
                <Text style={styles.subText} numberOfLines={1}>
                  IP: {currentTv.host} • Status: {connectionState}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.disconnectButton}
                onPress={() => disconnect()}
                accessibilityLabel="Disconnect TV"
                accessibilityRole="button"
              >
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.subText}>No TV currently connected.</Text>
          )}
        </View>

        {/* PROTOCOL PORTS & SPECIFICATIONS */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Network size={18} color={THEME.colors.primary} />
            <Text style={styles.cardTitle}>NETWORK SPECIFICATIONS</Text>
          </View>

          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Discovery Service (mDNS)</Text>
            <Text style={styles.specValue}>{PROTOCOL_CONSTANTS.MDNS_SERVICE_TYPE_V2}</Text>
          </View>

          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Pairing Port (TLS)</Text>
            <Text style={styles.specValue}>{PROTOCOL_CONSTANTS.DEFAULT_PAIRING_PORT}</Text>
          </View>

          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Remote Commands Port (TLS)</Text>
            <Text style={styles.specValue}>{PROTOCOL_CONSTANTS.DEFAULT_REMOTE_PORT}</Text>
          </View>

          <View style={styles.specItem}>
            <Text style={styles.specLabel}>Authentication Type</Text>
            <Text style={styles.specValue}>Mutual TLS + SHA-256 PIN</Text>
          </View>
        </View>

        {/* SAVED / PAIRED TV DEVICES */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <CheckCircle size={18} color={THEME.colors.accentGreen} />
            <Text style={styles.cardTitle}>SAVED PAIRED DEVICES</Text>
          </View>

          {pairedDevices.length > 0 ? (
            pairedDevices.map((dev) => (
              <View key={dev.id} style={styles.savedDevRow}>
                <View style={styles.savedDevInfo}>
                  <Text style={styles.boldText} numberOfLines={1}>{dev.name}</Text>
                  <Text style={styles.subText} numberOfLines={1}>{dev.host}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleForgetDevice(dev.id, dev.name)}
                  style={styles.trashBtn}
                  accessibilityLabel={`Forget ${dev.name}`}
                  accessibilityRole="button"
                >
                  <Trash2 size={18} color={THEME.colors.accentRed} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.subText}>No saved TV pairings stored.</Text>
          )}
        </View>

        {/* TROUBLESHOOTING GUIDE */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <HelpCircle size={18} color={THEME.colors.accentOrange} />
            <Text style={styles.cardTitle}>TROUBLESHOOTING GUIDE</Text>
          </View>

          <View style={styles.troubleItem}>
            <AlertTriangle size={16} color={THEME.colors.accentOrange} style={styles.troubleIcon} />
            <View style={styles.troubleContent}>
              <Text style={styles.troubleTitle}>TV Not Showing Up in Discovery</Text>
              <Text style={styles.troubleDesc}>
                1. Make sure both phone and TV are on the exact same Wi-Fi network (not guest Wi-Fi).
                {'\n'}2. Some mesh routers block multicast (mDNS). Use the "Connect by IP" option to connect directly.
              </Text>
            </View>
          </View>

          <View style={styles.troubleItem}>
            <Info size={16} color={THEME.colors.primary} style={styles.troubleIcon} />
            <View style={styles.troubleContent}>
              <Text style={styles.troubleTitle}>Finding TV's IP Address</Text>
              <Text style={styles.troubleDesc}>
                On your Android TV or Google TV, open:
                Settings → Network & Internet → Click your connected Wi-Fi → View IP Address.
              </Text>
            </View>
          </View>

          <View style={styles.troubleItem}>
            <RotateCcw size={16} color={THEME.colors.accentGreen} style={styles.troubleIcon} />
            <View style={styles.troubleContent}>
              <Text style={styles.troubleTitle}>TV Went to Sleep</Text>
              <Text style={styles.troubleDesc}>
                If your TV is in deep standby or turned off at the wall, it disconnects from Wi-Fi. Turn on the TV with physical button once to wake Wi-Fi.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceBorder,
  },
  backButton: {
    padding: 6,
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    color: THEME.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  currentDevInfo: {
    flex: 1,
    marginRight: 8,
  },
  boldText: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  subText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
  },
  disconnectButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    flexShrink: 0,
  },
  disconnectText: {
    color: THEME.colors.accentRed,
    fontSize: 13,
    fontWeight: '600',
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceBorder,
    gap: 12,
  },
  specLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  specValue: {
    color: THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  savedDevRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceBorder,
    gap: 10,
  },
  savedDevInfo: {
    flex: 1,
    marginRight: 8,
  },
  trashBtn: {
    padding: 8,
    flexShrink: 0,
  },
  troubleItem: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  troubleIcon: {
    marginTop: 2,
  },
  troubleContent: {
    flex: 1,
  },
  troubleTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  troubleDesc: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
