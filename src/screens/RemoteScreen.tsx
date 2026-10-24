/**
 * RemoteScreen - Primary TV Remote Control Panel
 * Google TV inspired clean, modern dark theme layout.
 */

import {
  FastForward,
  Home,
  Keyboard,
  Menu,
  Mic,
  Pause,
  Play,
  Power,
  RotateCcw,
  Undo2,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { DevicePickerSheet } from '../components/DevicePickerSheet';
import { DirectionPad } from '../components/DirectionPad';
import { RemoteButton } from '../components/RemoteButton';
import { ShortcutButton } from '../components/ShortcutButton';
import { TextInputModal } from '../components/TextInputModal';
import { VoiceSearchModal } from '../components/VoiceSearchModal';
import { useTVConnection } from '../hooks/useTVConnection';
import { AppLauncherService } from '../services/appLauncher';
import { remoteService } from '../services/remoteService';
import { TextInputService } from '../services/textInputService';
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

  const [textInputVisible, setTextInputVisible] = useState(false);
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);
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

  const handleSendText = async (text: string) => {
    return TextInputService.sendText(text);
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
      >
        {/* TOP BAR: POWER, RECONNECT, KEYBOARD */}
        <View style={styles.topUtilityRow}>
          <RemoteButton
            icon={<Power size={22} color={THEME.colors.accentRed} />}
            onPress={() => handleKey(KeyCode.POWER)}
            accessibilityLabel="Power"
            size="sm"
          />

          <View style={styles.centerUtilityGroup}>
            <RemoteButton
              icon={<Mic size={20} color={THEME.colors.primary} />}
              onPress={() => setVoiceModalVisible(true)}
              accessibilityLabel="Voice Search"
              size="sm"
            />
            <RemoteButton
              icon={<Keyboard size={20} color={THEME.colors.textPrimary} />}
              onPress={() => setTextInputVisible(true)}
              accessibilityLabel="Open Keyboard"
              size="sm"
            />
            {isConnected ? (
              <RemoteButton
                icon={<RotateCcw size={18} color={THEME.colors.textSecondary} />}
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

      {/* TEXT INPUT MODAL */}
      <TextInputModal
        visible={textInputVisible}
        onSendText={handleSendText}
        onClose={() => setTextInputVisible(false)}
        onOpenVoice={() => setVoiceModalVisible(true)}
      />

      {/* VOICE SEARCH MODAL */}
      <VoiceSearchModal
        visible={voiceModalVisible}
        onClose={() => setVoiceModalVisible(false)}
      />

      {/* DEVICE PICKER SHEET (GOOGLE TV STYLE) */}
      <DevicePickerSheet
        visible={showDevicePicker}
        devices={devices}
        isScanning={isScanning}
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
    paddingBottom: 24,
    alignItems: 'center',
  },
  topUtilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  centerUtilityGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  navRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: 10,
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
    marginVertical: 6,
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
    marginTop: 10,
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
