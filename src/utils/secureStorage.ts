/**
 * Secure Storage Manager
 * Uses Android Keystore-backed Expo SecureStore for encrypted credentials
 * and AsyncStorage for non-sensitive device metadata.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { StoredTVDevice } from '../types/device';
import { STORAGE_KEYS } from './constants';

export class SecureStorageService {
  /**
   * Securely saves the TV pairing credentials (client-key / cryptographic proof)
   * into hardware-backed Android Keystore / iOS Keychain.
   */
  static async savePairingCredentials(host: string, secretKey: string): Promise<void> {
    const keyAlias = `tv_key_${host.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    try {
      await SecureStore.setItemAsync(keyAlias, secretKey, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch {
      // Fallback for non-supported environments
      await AsyncStorage.setItem(`@sec_${keyAlias}`, secretKey);
    }
  }

  /**
   * Retrieves the secure pairing credentials for a specific TV host
   */
  static async getPairingCredentials(host: string): Promise<string | null> {
    const keyAlias = `tv_key_${host.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    try {
      const secret = await SecureStore.getItemAsync(keyAlias);
      if (secret) return secret;
    } catch {
      // Fallback
    }

    try {
      return await AsyncStorage.getItem(`@sec_${keyAlias}`);
    } catch {
      return null;
    }
  }

  /**
   * Removes pairing credentials for a TV (when user clicks "Forget TV")
   */
  static async removePairingCredentials(host: string): Promise<void> {
    const keyAlias = `tv_key_${host.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    try {
      await SecureStore.deleteItemAsync(keyAlias);
    } catch {
      // Ignore
    }
    try {
      await AsyncStorage.removeItem(`@sec_${keyAlias}`);
    } catch {
      // Ignore
    }
  }

  /**
   * Retrieves all paired TV devices
   */
  static async getPairedDevices(): Promise<StoredTVDevice[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PAIRED_DEVICES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Saves or updates a paired TV device
   */
  static async savePairedDevice(device: StoredTVDevice): Promise<void> {
    try {
      const existing = await this.getPairedDevices();
      const filtered = existing.filter((d) => d.id !== device.id && d.host !== device.host);
      filtered.unshift(device);
      await AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICES, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Failed to save paired device:', e);
    }
  }

  /**
   * Forgets a paired TV and removes all associated credentials and metadata
   */
  static async forgetDevice(deviceId: string, host: string): Promise<void> {
    try {
      const existing = await this.getPairedDevices();
      const updated = existing.filter((d) => d.id !== deviceId && d.host !== host);
      await AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICES, JSON.stringify(updated));

      // Remove secure credentials
      await this.removePairingCredentials(host);

      // If this was the active device, clear active device ID
      const activeId = await this.getActiveDeviceId();
      if (activeId === deviceId) {
        await this.setActiveDeviceId(null);
      }
    } catch (e) {
      console.warn('Failed to forget device:', e);
    }
  }

  /**
   * Gets the last active TV device ID
   */
  static async getActiveDeviceId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_DEVICE_ID);
    } catch {
      return null;
    }
  }

  /**
   * Sets the active TV device ID
   */
  static async setActiveDeviceId(deviceId: string | null): Promise<void> {
    try {
      if (deviceId) {
        await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_DEVICE_ID, deviceId);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_DEVICE_ID);
      }
    } catch (e) {
      console.warn('Failed to set active device id:', e);
    }
  }
}
