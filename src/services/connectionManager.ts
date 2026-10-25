/**
 * Connection Manager
 * Manages TV connection lifecycle through a strict finite state machine:
 * 'idle' -> 'discovering' -> 'deviceSelected' -> 'awaitingCode' -> 'pairing' -> 'connected' | 'failed'
 */

import { DiscoveredTV, PairingFailureReason, TVConnectionState } from '../types/device';
import { SecureStorageService } from '../utils/secureStorage';
import { DiscoveryService } from './discoveryService';
import { PairingService } from './pairingService';
import { remoteService } from './remoteService';

export type StateChangeCallback = (
  state: TVConnectionState,
  currentTv: DiscoveredTV | null,
  error: string | null
) => void;

export class ConnectionManager {
  private static state: TVConnectionState = 'idle';
  private static currentTv: DiscoveredTV | null = null;
  private static errorMessage: string | null = null;
  private static pinLength: number = 8;
  private static listeners: Set<StateChangeCallback> = new Set();
  private static pairingService: PairingService = new PairingService();

  public static addListener(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    callback(this.state, this.currentTv, this.errorMessage);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private static setState(
    state: TVConnectionState,
    tv: DiscoveredTV | null = this.currentTv,
    error: string | null = null
  ): void {
    this.state = state;
    this.currentTv = tv;
    this.errorMessage = error;
    this.listeners.forEach((listener) => listener(state, tv, error));
  }

  public static getState(): TVConnectionState {
    return this.state;
  }

  public static getCurrentTV(): DiscoveredTV | null {
    return this.currentTv;
  }

  public static getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public static getPinLength(): number {
    return this.pinLength;
  }

  private static isAutoConnecting = false;

  /**
   * Auto-reconnect to last active TV if available, using securely stored credentials
   */
  public static async autoConnect(): Promise<void> {
    if (this.isAutoConnecting || this.state === 'connected') {
      return;
    }
    this.isAutoConnecting = true;

    try {
      const activeId = await SecureStorageService.getActiveDeviceId();
      if (!activeId) {
        this.setState('idle', null);
        return;
      }

      const saved = await DiscoveryService.loadSavedDevices();
      const target = saved.find((d) => d.id === activeId);
      if (!target) {
        this.setState('idle', null);
        return;
      }

      // Check if secure credentials exist
      const secret = await SecureStorageService.getPairingCredentials(target.host);
      if (!secret) {
        this.setState('idle', null);
        return;
      }

      console.log(`[ConnectionManager] Auto-reconnecting to paired TV: ${target.name}`);
      await this.connectWithSavedCredentials(target);
    } finally {
      this.isAutoConnecting = false;
    }
  }

  /**
   * User selects a TV from the discovery list
   */
  public static async selectDevice(tv: DiscoveredTV): Promise<void> {
    this.setState('deviceSelected', tv);

    // Check if this TV has existing credentials saved in hardware Keystore
    const savedKey = await SecureStorageService.getPairingCredentials(tv.host);

    if (savedKey) {
      // Reconnect with existing credentials without asking for PIN
      console.log(`[ConnectionManager] Device ${tv.name} is already paired. Connecting directly...`);
      await this.connectWithSavedCredentials(tv);
    } else {
      // Needs first-time PIN pairing
      console.log(`[ConnectionManager] Device ${tv.name} requires first-time pairing.`);
      await this.initiatePairingFlow(tv);
    }
  }

  /**
   * Initiates first-time pairing flow: prompts TV to display PIN
   */
  public static async initiatePairingFlow(tv: DiscoveredTV): Promise<void> {
    this.setState('deviceSelected', tv);

    await this.pairingService.startPairing(tv, {
      onAwaitingPrompt: () => {
        this.setState('awaitingPrompt', tv, null);
      },
      onAwaitingCode: (length) => {
        this.pinLength = length || 8;
        this.setState('awaitingCode', tv, null);
      },
      onSuccess: async (pairedTv) => {
        console.log(`[ConnectionManager] Pairing confirmed by TV! Establishing control session...`);
        const ok = await remoteService.connect(pairedTv, () => {
          this.setState('failed', pairedTv, 'TV disconnected or powered off');
        });

        if (ok) {
          await SecureStorageService.setActiveDeviceId(pairedTv.id);
          this.setState('connected', pairedTv, null);
        } else {
          this.setState('failed', pairedTv, 'Failed to establish control session with TV');
        }
      },
      onFailure: (failure: PairingFailureReason) => {
        console.warn(`[ConnectionManager] Pairing failed: [${failure.code}] ${failure.message}`);
        this.setState('failed', tv, failure.message);
      },
    });
  }

  /**
   * Submits user-entered PIN to the TV
   */
  public static async submitPin(pin: string): Promise<boolean> {
    if (this.state !== 'awaitingCode' && this.state !== 'deviceSelected') {
      console.warn('[ConnectionManager] Cannot submit PIN in current state:', this.state);
      return false;
    }

    this.setState('pairing', this.currentTv, null);

    try {
      return await this.pairingService.submitPin(pin);
    } catch (err: any) {
      this.setState('failed', this.currentTv, err?.message || 'Invalid pairing code');
      return false;
    }
  }

  /**
   * Reconnect to the current or last paired TV
   */
  public static async reconnect(): Promise<void> {
    if (!this.currentTv) {
      await this.autoConnect();
      return;
    }

    await this.connectWithSavedCredentials(this.currentTv);
  }

  /**
   * Connects to a previously paired TV with saved credentials
   */
  private static async connectWithSavedCredentials(tv: DiscoveredTV): Promise<boolean> {
    this.setState('deviceSelected', tv);

    try {
      const ok = await remoteService.connect(tv, () => {
        this.setState('failed', tv, 'TV disconnected or went into standby');
      });

      if (ok) {
        await SecureStorageService.setActiveDeviceId(tv.id);
        this.setState('connected', tv, null);
        return true;
      } else {
        this.setState('failed', tv, 'TV is unreachable. Ensure TV is turned on and on the same Wi-Fi network.');
        return false;
      }
    } catch (err: any) {
      this.setState('failed', tv, err?.message || 'Connection failed');
      return false;
    }
  }

  /**
   * Cancels pairing and returns to idle/discovery
   */
  public static cancelPairing(): void {
    this.pairingService.cancelPairing();
    this.setState('idle', null);
  }

  /**
   * Forgets a paired TV and removes all credentials
   */
  public static async forgetDevice(tv: DiscoveredTV): Promise<void> {
    this.disconnect();
    await SecureStorageService.forgetDevice(tv.id, tv.host);
    DiscoveryService.removeDevice(tv.id);
    this.setState('idle', null);
  }

  /**
   * Disconnects active connection
   */
  public static disconnect(): void {
    remoteService.disconnect();
    this.setState('idle', null);
  }

  public static notifyDiscovering(): void {
    this.setState('discovering', null);
  }

  public static notifyIdle(): void {
    if (this.state === 'discovering') {
      this.setState('idle', null);
    }
  }
}
