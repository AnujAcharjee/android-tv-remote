/**
 * Persistent Storage Manager for TV Remote
 * Uses AsyncStorage to persist client certificates, saved TV pairings, and settings.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StoredCertificate, StoredTVDevice } from '../types/device';
import { STORAGE_KEYS } from './constants';
import { generateClientCertificate } from './crypto';
import { SecureStorageService } from './secureStorage';

export class StorageService {
  /**
   * Retrieves the stored client certificate, or generates and saves a new one.
   */
  static async getOrCreateCertificate(): Promise<StoredCertificate> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CERTIFICATE);
      if (stored) {
        return JSON.parse(stored) as StoredCertificate;
      }
    } catch (e) {
      console.warn('Failed to read certificate from storage:', e);
    }

    // Generate new client certificate and persist
    const newCert = await generateClientCertificate();
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CERTIFICATE, JSON.stringify(newCert));
    } catch (e) {
      console.warn('Failed to save certificate to storage:', e);
    }
    return newCert;
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
   * Removes a paired device
   */
  static async removePairedDevice(deviceId: string): Promise<void> {
    try {
      const existing = await this.getPairedDevices();
      const updated = existing.filter((d) => d.id !== deviceId);
      await AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICES, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to remove paired device:', e);
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

  /**
   * Gets the stored TV client-key token for any TV device
   */
  static async getClientKey(tvHost: string): Promise<string | null> {
    const secureKey = await SecureStorageService.getPairingCredentials(tvHost);
    if (secureKey) return secureKey;

    try {
      return await AsyncStorage.getItem(`@tv_client_key_${tvHost}`);
    } catch {
      return null;
    }
  }

  /**
   * Saves the TV client-key token into secure storage
   */
  static async setClientKey(tvHost: string, key: string): Promise<void> {
    await SecureStorageService.savePairingCredentials(tvHost, key);
    try {
      await AsyncStorage.setItem(`@tv_client_key_${tvHost}`, key);
    } catch {
      // Ignore
    }
  }
}
