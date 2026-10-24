/**
 * TV Remote Application Root Component
 * Coordinates clean first-time pairing flow, discovery, and remote control.
 */

import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTVConnection } from './src/hooks/useTVConnection';
import { ConnectionScreen } from './src/screens/ConnectionScreen';
import { PairingScreen } from './src/screens/PairingScreen';
import { RemoteScreen } from './src/screens/RemoteScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { THEME } from './src/utils/constants';

type ActiveScreen = 'remote' | 'connections' | 'settings';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('remote');

  const {
    connectionState,
    currentTv,
    errorMessage,
    pinLength,
    submitPin,
    cancelPairing,
    selectDevice,
  } = useTVConnection();

  const renderContent = () => {
    // 1. If currently in the PIN entry / verification phase:
    if (connectionState === 'awaitingCode' || connectionState === 'pairing' || (connectionState === 'failed' && currentTv)) {
      return (
        <PairingScreen
          tv={currentTv}
          connectionState={connectionState}
          errorMessage={errorMessage}
          pinLength={pinLength}
          onSubmitPin={submitPin}
          onCancel={cancelPairing}
          onRetry={() => {
            if (currentTv) {
              selectDevice(currentTv);
            }
          }}
        />
      );
    }

    // 2. First-time user experience or explicit discovery screen:
    // If no TV is paired/connected yet and user is on remote tab, present "Connect to your TV"
    const isFirstTime = !currentTv && connectionState === 'idle';
    if (activeScreen === 'connections' || (isFirstTime && activeScreen === 'remote')) {
      return (
        <ConnectionScreen
          onBack={currentTv ? () => setActiveScreen('remote') : undefined}
          onDeviceSelected={(tv) => selectDevice(tv)}
        />
      );
    }

    // 3. Settings Screen:
    if (activeScreen === 'settings') {
      return <SettingsScreen onBack={() => setActiveScreen('remote')} />;
    }

    // 4. Primary Remote Control Panel:
    return (
      <RemoteScreen
        onOpenConnections={() => setActiveScreen('connections')}
        onOpenSettings={() => setActiveScreen('settings')}
      />
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
});
