/**
 * RemoteScreen - Primary TV Remote Control Panel
 * Google TV inspired clean, modern dark theme layout.
 * Features an integrated TV Search & Text Entry box with Send action.
 */

import {
  FastForward,
  Home,
  Menu,
  Pause,
  Play,
  Power,
  RotateCcw,
  Search,
  Send,
  Undo2,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Keyboard as RNKeyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { DevicePickerSheet } from '../components/DevicePickerSheet';
import { DirectionPad } from '../components/DirectionPad';
import { RemoteButton } from '../components/RemoteButton';
import { ShortcutButton } from '../components/ShortcutButton';
import { useTVConnection } from '../hooks/useTVConnection';
import { AppLauncherService } from '../services/appLauncher';
import { remoteService } from '../services/remoteService';
import { DiscoveredTV } from '../types/device';
import { Direction, KeyCode, StreamingAppId } from '../types/remote';
import { THEME } from '../utils/constants';

interface RemoteScreenProps {
  onOpenSettings: () => void;
  onOpenConnections: () => void;
}

export const RemoteScreen: React.FC<RemoteScreenProps> = ({
  onOpenSettings,
  onOpenConnections,
}) => {
  const {
    connectionState,
    currentTv,
    devices,
    isScanning,
    startDiscovery,
    selectDevice,
    disconnect,
  } = useTVConnection();

  const [searchText, setSearchText] = useState('');
  const [sentFeedback, setSentFeedback] = useState<string | null>(null);
  const searchInputRef = useRef<any>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);

  const isConnected = connectionState === 'connected';

  const handleSelectDevice = async (device: DiscoveredTV) => {
    setShowDevicePicker(false);
    await selectDevice(device);
  };

  const handleKey = async (keyCode: KeyCode, direction: Direction = Direction.SHORT) => {
    if (!isConnected) {
      Alert.alert(
        'TV Not Connected',
        'Please tap the connection badge at the top to select and connect your TV.',
        [{ text: 'Find TVs', onPress: onOpenConnections }, { text: 'OK' }]
      );
      return;
    }

    if (keyCode === KeyCode.VOLUME_MUTE) {
      setIsMuted((prev) => !prev);
    } else if (keyCode === KeyCode.VOLUME_UP || keyCode === KeyCode.VOLUME_DOWN) {
      setIsMuted(false);
    }

    try {
      await remoteService.sendKey(keyCode, direction);
    } catch (e: any) {
      console.warn('Key command error:', e);
    }
  };

  const handleShortcut = async (appId: StreamingAppId) => {
    if (!isConnected) {
      Alert.alert(
        'TV Not Connected',
        'Connect to your TV before launching streaming apps.',
        [{ text: 'Connect', onPress: onOpenConnections }, { text: 'Cancel' }]
      );
      return;
    }

    const res = await AppLauncherService.launch(appId);
    if (!res.success) {
      Alert.alert('Launch Notice', res.message);
    }
  };

  const handleSendSearch = async (queryOverride?: string) => {
    const query = (queryOverride || searchText).trim();
    if (!query) return;

    if (!isConnected) {
      Alert.alert(
        'TV Not Connected',
        'Connect to your TV before searching or typing.',
        [{ text: 'Connect', onPress: onOpenConnections }, { text: 'OK' }]
      );
      return;
    }

    RNKeyboard.dismiss();
    try {
      setSentFeedback(`Sent to TV: "${query}"`);
      setTimeout(() => setSentFeedback(null), 3000);
      setSearchText('');
      await remoteService.sendTextAndSubmit(query);
    } catch (err: any) {
      console.warn('Send search error:', err);
      Alert.alert('Search Error', err?.message || 'Could not send text to TV');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ConnectionStatus
        state={connectionState}
        currentTv={currentTv}
        onOpenSettings={onOpenSettings}
        onOpenConnections={() => setShowDevicePicker(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* TOP UTILITY ROW: POWER & SETTINGS / RECONNECT */}
        <View style={styles.topUtilityRow}>
          <RemoteButton
            icon={<Power size={20} color={THEME.colors.accentRed} />}
            onPress={() => handleKey(KeyCode.POWER)}
            accessibilityLabel="Power"
            size="sm"
          />

          <View style={styles.rightUtilityGroup}>
            {isConnected ? (
              <RemoteButton
                icon={<RotateCcw size={16} color={THEME.colors.textSecondary} />}
                onPress={() => disconnect()}
                accessibilityLabel="Disconnect"
                size="sm"
              />
            ) : null}
          </View>
        </View>

        {/* DIRECTIONAL NAVIGATION PAD */}
        <DirectionPad onKey={handleKey} />

        {/* PRIMARY NAVIGATION ROW: BACK, HOME, MENU */}
        <View style={styles.navRow}>
          <RemoteButton
            icon={<Undo2 size={24} color={THEME.colors.textPrimary} />}
            label="Back"
            onPress={() => handleKey(KeyCode.BACK)}
            style={styles.flexButton}
          />
          <RemoteButton
            icon={<Home size={24} color={THEME.colors.primary} />}
            label="Home"
            variant="surfaceElevated"
            onPress={() => handleKey(KeyCode.HOME)}
            style={styles.flexButton}
          />
          <RemoteButton
            icon={<Menu size={24} color={THEME.colors.textPrimary} />}
            label="Menu"
            onPress={() => handleKey(KeyCode.MENU)}
            style={styles.flexButton}
          />
        </View>

        {/* AUDIO / VOLUME CONTROLS */}
        <View style={styles.sectionCard}>
          <View style={styles.volumeRow}>
            <RemoteButton
              icon={<Volume1 size={20} color={THEME.colors.textPrimary} />}
              label="Vol -"
              onPress={() => handleKey(KeyCode.VOLUME_DOWN)}
              style={styles.flexButton}
            />
            <RemoteButton
              icon={
                isMuted ? (
                  <Volume2 size={20} color={THEME.colors.textPrimary} />
                ) : (
                  <VolumeX size={20} color={THEME.colors.accentOrange} />
                )
              }
              label={isMuted ? 'Unmute' : 'Mute'}
              onPress={() => handleKey(KeyCode.VOLUME_MUTE)}
              style={styles.flexButton}
            />
            <RemoteButton
              icon={<Volume2 size={20} color={THEME.colors.textPrimary} />}
              label="Vol +"
              onPress={() => handleKey(KeyCode.VOLUME_UP)}
              style={styles.flexButton}
            />
          </View>
        </View>

        {/* MEDIA PLAYBACK CONTROLS */}
        <View style={styles.sectionCard}>
          <View style={styles.mediaRow}>
            <RemoteButton
              icon={<RotateCcw size={20} color={THEME.colors.textSecondary} />}
              label="Rewind"
              onPress={() => handleKey(KeyCode.MEDIA_REWIND)}
              style={styles.flexButton}
            />
            <RemoteButton
              icon={
                isPlaying ? (
                  <Pause size={22} color="#FFFFFF" />
                ) : (
                  <Play size={22} color="#FFFFFF" />
                )
              }
              label={isPlaying ? 'Pause' : 'Play'}
              variant="primary"
              onPress={() => {
                setIsPlaying(!isPlaying);
                handleKey(KeyCode.MEDIA_PLAY_PAUSE);
              }}
              style={styles.flexButton}
            />
            <RemoteButton
              icon={<FastForward size={20} color={THEME.colors.textSecondary} />}
              label="Forward"
              onPress={() => handleKey(KeyCode.MEDIA_FAST_FORWARD)}
              style={styles.flexButton}
            />
          </View>
        </View>

        {/* INLINE TV SEARCH & TEXT ENTRY (Preserved for future use)
        <View style={styles.searchSection}>
          <Text style={styles.sectionHeader}>TV SEARCH & TEXT INPUT</Text>
          <View style={styles.searchBarContainer}>
            <Search size={18} color={THEME.colors.primary} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search or type on TV..."
              placeholderTextColor={THEME.colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={() => handleSendSearch()}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchText.length > 0 ? (
              <TouchableOpacity
                onPress={() => setSearchText('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.clearBtn}
              >
                <X size={16} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.sendBtn,
                Boolean(searchText.trim()) && styles.sendBtnActive,
              ]}
              onPress={() => handleSendSearch()}
              disabled={!searchText.trim()}
              accessibilityLabel="Send to TV"
            >
              <Send
                size={16}
                color={searchText.trim() ? '#FFFFFF' : THEME.colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {sentFeedback ? (
            <View style={styles.feedbackBadge}>
              <Text style={styles.feedbackText}>{sentFeedback}</Text>
            </View>
          ) : null}
        </View>
        */}

        {/* DEDICATED STREAMING APP SHORTCUTS */}
        <View style={styles.shortcutsSection}>
          <Text style={styles.sectionHeader}>STREAMING SHORTCUTS</Text>
          <View style={styles.shortcutsRow}>
            <ShortcutButton appId="netflix" onPress={handleShortcut} />
            <ShortcutButton appId="hotstar" onPress={handleShortcut} />
            <ShortcutButton appId="youtube" onPress={handleShortcut} />
          </View>
        </View>
      </ScrollView>

      {/* DEVICE PICKER SHEET (GOOGLE TV STYLE) */}
      <DevicePickerSheet
        visible={showDevicePicker}
        devices={devices}
        isScanning={isScanning}
        currentTvId={currentTv?.id}
        currentTvHost={currentTv?.host}
        connectionState={connectionState}
        onSelectDevice={handleSelectDevice}
        onScanAgain={startDiscovery}
        onConnectByIp={() => {
          setShowDevicePicker(false);
          onOpenConnections();
        }}
        onDismiss={() => setShowDevicePicker(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  topUtilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8,
    alignItems: 'center',
  },
  rightUtilityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchSection: {
    width: '100%',
    marginVertical: 8,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 52,
    backgroundColor: THEME.colors.surfaceElevated,
    borderRadius: 26,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: THEME.colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 4,
    height: '100%',
  },
  clearBtn: {
    padding: 6,
    marginRight: 4,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sendBtnActive: {
    backgroundColor: THEME.colors.primary,
  },
  feedbackBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginTop: 6,
    alignSelf: 'center',
  },
  feedbackText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: 8,
  },
  flexButton: {
    flex: 1,
    height: 56,
  },
  sectionCard: {
    width: '100%',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceBorder,
    marginVertical: 5,
  },
  volumeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shortcutsSection: {
    width: '100%',
    marginTop: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  shortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
