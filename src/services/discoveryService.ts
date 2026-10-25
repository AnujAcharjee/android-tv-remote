/**
 * TV Discovery Service
 * Discovers Smart TVs (LG webOS, Android TV, Google TV) dynamically via:
 * 1. Stored paired devices from local storage
 * 2. Real-time port probing on local network without hardcoded IPs
 * 3. Intelligent protocol auto-detection (LG webOS on 3001, Android TV on 6467/6466)
 * 4. Manual IP addition with automatic device detection
 */

import * as Network from 'expo-network';
import { DiscoveredTV, StoredTVDevice, TVProtocolType } from '../types/device';
import { PROTOCOL_CONSTANTS } from '../utils/constants';
import { StorageService } from '../utils/storage';

export type DiscoveryCallback = (devices: DiscoveredTV[]) => void;

/**
 * Probes whether a Smart TV or Android TV WebSocket endpoint is actively open and responsive.
 * Returns true ONLY when the connection actually opens (onopen).
 * Returns false on all errors, timeouts, or closed ports.
 */
export function probeTVPort(host: string, port: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    let ws: WebSocket | null = null;
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { ws?.close(); } catch {}
        resolve(false);
      }
    }, timeoutMs);

    try {
      const protocol = port === 3001 ? 'wss' : 'ws';
      ws = new WebSocket(`${protocol}://${host}:${port}/`);

      ws.onopen = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          try { ws?.close(); } catch {}
          resolve(true);
        }
      };

      ws.onerror = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(false);
        }
      };

      ws.onclose = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(false);
        }
      };
    } catch {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve(false);
      }
    }
  });
}

export class DiscoveryService {
  private static discoveredMap: Map<string, DiscoveredTV> = new Map();
  private static listeners: Set<DiscoveryCallback> = new Set();
  private static isScanning: boolean = false;

  public static addListener(callback: DiscoveryCallback): () => void {
    this.listeners.add(callback);
    callback(Array.from(this.discoveredMap.values()));
    return () => {
      this.listeners.delete(callback);
    };
  }

  private static notifyListeners(): void {
    const list = Array.from(this.discoveredMap.values());
    this.listeners.forEach((listener) => listener(list));
  }

  /**
   * Loads previously paired devices from local storage
   */
  public static async loadSavedDevices(): Promise<DiscoveredTV[]> {
    const paired: StoredTVDevice[] = await StorageService.getPairedDevices();
    for (const item of paired) {
      if (!this.discoveredMap.has(item.id)) {
        this.discoveredMap.set(item.id, {
          id: item.id,
          name: item.name,
          host: item.host,
          pairingPort: item.pairingPort || (item.protocolType === 'webos' ? 3001 : PROTOCOL_CONSTANTS.DEFAULT_PAIRING_PORT),
          remotePort: item.remotePort || (item.protocolType === 'webos' ? 3001 : PROTOCOL_CONSTANTS.DEFAULT_REMOTE_PORT),
          protocolType: item.protocolType || (item.pairingPort === 3001 || item.remotePort === 3001 ? 'webos' : 'androidtv'),
          isPaired: true,
          lastSeen: item.pairedAt,
        });
      } else {
        const dev = this.discoveredMap.get(item.id)!;
        dev.isPaired = true;
      }
    }
    this.notifyListeners();
    return Array.from(this.discoveredMap.values());
  }

  /**
   * Intelligently detects whether a target TV IP is an LG webOS TV or Android/Google TV
   */
  public static async detectTVType(host: string): Promise<{
    protocolType: TVProtocolType;
    pairingPort: number;
    remotePort: number;
    suggestedName: string;
  }> {
    const cleanHost = host.trim();

    // Check LG webOS TV (port 3001) and Android TV (port 6467) in parallel
    const [isWebOS, isAndroidTV] = await Promise.all([
      probeTVPort(cleanHost, 3001, 1500),
      probeTVPort(cleanHost, PROTOCOL_CONSTANTS.DEFAULT_PAIRING_PORT, 1500),
    ]);

    if (isWebOS) {
      return {
        protocolType: 'webos',
        pairingPort: 3001,
        remotePort: 3001,
        suggestedName: `LG Smart TV (${cleanHost})`,
      };
    }

    if (isAndroidTV) {
      return {
        protocolType: 'androidtv',
        pairingPort: PROTOCOL_CONSTANTS.DEFAULT_PAIRING_PORT,
        remotePort: PROTOCOL_CONSTANTS.DEFAULT_REMOTE_PORT,
        suggestedName: `Android TV (${cleanHost})`,
      };
    }

    // Default to webOS port 3001 if unknown
    return {
      protocolType: 'auto',
      pairingPort: 3001,
      remotePort: 3001,
      suggestedName: `Smart TV (${cleanHost})`,
    };
  }

  /**
   * Initiates dynamic local network discovery without hardcoded IPs
   */
  public static async startDiscovery(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    await this.loadSavedDevices();

    try {
      await this.scanActiveDevices();
    } catch (e) {
      console.warn('[DiscoveryService] Scan error:', e);
    } finally {
      this.isScanning = false;
      this.notifyListeners();
    }
  }

  /**
   * Adds or updates a manually entered TV IP address with automatic protocol & port detection
   */
  public static async addManualDevice(
    host: string,
    name?: string,
    forcedPort?: number
  ): Promise<DiscoveredTV> {
    const cleanHost = host.trim();
    const id = `tv_${cleanHost.replace(/[^a-zA-Z0-9_]/g, '_')}`;

    const pairedList = await StorageService.getPairedDevices();
    const isPaired = pairedList.some((d) => d.host === cleanHost || d.id === id);

    let pairingPort = forcedPort || 3001;
    let remotePort = forcedPort || 3001;
    let protocolType: TVProtocolType = 'webos';
    let displayName = name?.trim() || `Smart TV (${cleanHost})`;

    if (!forcedPort) {
      const detected = await this.detectTVType(cleanHost);
      pairingPort = detected.pairingPort;
      remotePort = detected.remotePort;
      protocolType = detected.protocolType;
      if (!name) {
        displayName = detected.suggestedName;
      }
    }

    const device: DiscoveredTV = {
      id,
      name: displayName,
      host: cleanHost,
      pairingPort,
      remotePort,
      protocolType,
      isPaired,
      lastSeen: Date.now(),
    };

    this.discoveredMap.set(id, device);
    this.notifyListeners();
    return device;
  }

  /**
   * Probes known paired devices and scans the local Wi-Fi subnet for any active TVs
   */
  private static async scanActiveDevices(): Promise<void> {
    const paired = await StorageService.getPairedDevices();

    // 0. Remove stale unverified devices from previous scans
    const pairedIds = new Set(paired.map((p) => p.id));
    for (const id of Array.from(this.discoveredMap.keys())) {
      if (!pairedIds.has(id)) {
        this.discoveredMap.delete(id);
      }
    }
    this.notifyListeners();

    // 1. Verify and update connectivity for all saved devices first
    await Promise.all(
      paired.map(async (dev) => {
        const isOpen = await probeTVPort(dev.host, dev.remotePort || dev.pairingPort || 3001, 1000);
        if (isOpen) {
          this.discoveredMap.set(dev.id, {
            id: dev.id,
            name: dev.name,
            host: dev.host,
            pairingPort: dev.pairingPort,
            remotePort: dev.remotePort,
            protocolType: dev.protocolType || (dev.pairingPort === 3001 ? 'webos' : 'androidtv'),
            isPaired: true,
            lastSeen: Date.now(),
          });
          this.notifyListeners();
        }
      })
    );

    // 2. Discover local subnet dynamically via expo-network
    const candidateSubnets = new Set<string>();

    try {
      const myIp = await Network.getIpAddressAsync();
      if (myIp && myIp.includes('.')) {
        const parts = myIp.split('.');
        if (parts.length === 4) {
          candidateSubnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
        }
      }
    } catch {
      // Ignore if network permission or environment not available
    }

    // Add subnets from previously saved devices
    paired.forEach((p) => {
      const parts = p.host.split('.');
      if (parts.length === 4) {
        candidateSubnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
      }
    });

    // Default common home router subnets fallback
    if (candidateSubnets.size === 0) {
      candidateSubnets.add('192.168.1');
      candidateSubnets.add('192.168.0');
      candidateSubnets.add('192.168.29');
    }

    // 3. Scan candidate subnets across all 1..254 addresses in fast parallel chunks
    for (const subnet of candidateSubnets) {
      const hostsToTest: string[] = [];
      for (let i = 1; i <= 254; i++) {
        hostsToTest.push(`${subnet}.${i}`);
      }

      const chunkSize = 35;
      for (let i = 0; i < hostsToTest.length; i += chunkSize) {
        const chunk = hostsToTest.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (testHost) => {
            // Test LG webOS (port 3001) and Android TV (port 6467) concurrently
            const [hasWebOS, hasAndroidTV] = await Promise.all([
              probeTVPort(testHost, 3001, 1000),
              probeTVPort(testHost, PROTOCOL_CONSTANTS.DEFAULT_PAIRING_PORT, 1000),
            ]);

            if (hasWebOS) {
              const id = `tv_${testHost.replace(/\./g, '_')}`;
              if (!this.discoveredMap.has(id)) {
                this.discoveredMap.set(id, {
                  id,
                  name: `LG Smart TV (${testHost})`,
                  host: testHost,
                  pairingPort: 3001,
                  remotePort: 3001,
                  protocolType: 'webos',
                  isPaired: paired.some((p) => p.host === testHost),
                  lastSeen: Date.now(),
                });
                this.notifyListeners();
              }
            } else if (hasAndroidTV) {
              const id = `tv_${testHost.replace(/\./g, '_')}`;
              if (!this.discoveredMap.has(id)) {
                this.discoveredMap.set(id, {
                  id,
                  name: `Android TV (${testHost})`,
                  host: testHost,
                  pairingPort: PROTOCOL_CONSTANTS.DEFAULT_PAIRING_PORT,
                  remotePort: PROTOCOL_CONSTANTS.DEFAULT_REMOTE_PORT,
                  protocolType: 'androidtv',
                  isPaired: paired.some((p) => p.host === testHost),
                  lastSeen: Date.now(),
                });
                this.notifyListeners();
              }
            }
          })
        );
      }
    }
  }

  /**
   * Forgets a device and removes it from the discovered map
   */
  public static removeDevice(id: string): void {
    this.discoveredMap.delete(id);
    this.notifyListeners();
  }

  public static getDiscoveredDevices(): DiscoveredTV[] {
    return Array.from(this.discoveredMap.values());
  }

  public static getDeviceById(id: string): DiscoveredTV | undefined {
    return this.discoveredMap.get(id);
  }
}
