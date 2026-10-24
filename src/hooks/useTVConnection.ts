/**
 * TV Connection Hook
 * Reactive state and actions for TV connection lifecycle, discovery, PIN pairing, and reconnection.
 */

import { useEffect, useState } from 'react';
import { ConnectionManager } from '../services/connectionManager';
import { DiscoveryService } from '../services/discoveryService';
import { DiscoveredTV, TVConnectionState } from '../types/device';

export function useTVConnection() {
  const [connectionState, setConnectionState] = useState<TVConnectionState>(ConnectionManager.getState());
  const [currentTv, setCurrentTv] = useState<DiscoveredTV | null>(ConnectionManager.getCurrentTV());
  const [errorMessage, setErrorMessage] = useState<string | null>(ConnectionManager.getErrorMessage());
  const [pinLength, setPinLength] = useState<number>(ConnectionManager.getPinLength());
  const [devices, setDevices] = useState<DiscoveredTV[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  useEffect(() => {
    // Subscribe to state machine transitions
    const unsubConnection = ConnectionManager.addListener((state, tv, error) => {
      setConnectionState(state);
      setCurrentTv(tv);
      setErrorMessage(error);
      setPinLength(ConnectionManager.getPinLength());
    });

    // Subscribe to device discovery updates
    const unsubDiscovery = DiscoveryService.addListener((discoveredList) => {
      setDevices(discoveredList);
    });

    // Initial load and auto-reconnect
    DiscoveryService.loadSavedDevices();
    ConnectionManager.autoConnect();

    return () => {
      unsubConnection();
      unsubDiscovery();
    };
  }, []);

  const startDiscovery = async () => {
    setIsScanning(true);
    ConnectionManager.notifyDiscovering();
    try {
      await DiscoveryService.startDiscovery();
    } finally {
      setIsScanning(false);
      ConnectionManager.notifyIdle();
    }
  };

  const selectDevice = async (tv: DiscoveredTV) => {
    return ConnectionManager.selectDevice(tv);
  };

  const submitPin = async (pin: string) => {
    return ConnectionManager.submitPin(pin);
  };

  const cancelPairing = () => {
    ConnectionManager.cancelPairing();
  };

  const reconnect = async () => {
    return ConnectionManager.reconnect();
  };

  const forgetDevice = async (tv: DiscoveredTV) => {
    return ConnectionManager.forgetDevice(tv);
  };

  const disconnect = () => {
    ConnectionManager.disconnect();
  };

  const addManualDevice = async (host: string, name?: string) => {
    const dev = await DiscoveryService.addManualDevice(host, name);
    return selectDevice(dev);
  };

  return {
    connectionState,
    currentTv,
    errorMessage,
    pinLength,
    devices,
    isScanning,
    startDiscovery,
    selectDevice,
    submitPin,
    cancelPairing,
    reconnect,
    forgetDevice,
    disconnect,
    addManualDevice,
  };
}
