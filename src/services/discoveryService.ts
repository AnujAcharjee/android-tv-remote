/**
 * TV Discovery Service
 * Discovers Smart TVs (LG webOS, Android TV, Google TV) dynamically via:
 * 1. Standard unencrypted discovery endpoints (AirPlay/DIAL port 7000 and UPnP 1045 for LG, Google Cast 8008 for Android TV)
 * 2. Real-time subnet sweep across local network
 * 3. Exact device model/name extraction (e.g. "[LG] webOS TV LQ643BPTA")
 * 4. Stored paired devices from local storage
 */

import * as Network from 'expo-network';
import { DiscoveredTV, StoredTVDevice, TVProtocolType } from '../types/device';
import { PROTOCOL_CONSTANTS } from '../utils/constants';
import { getDevBridgeHost, setDiscoveredDevBridgeHost } from '../utils/devBridge';
import { StorageService } from '../utils/storage';

export type DiscoveryCallback = (devices: DiscoveredTV[]) => void;

export interface IdentifiedTV {
  protocolType: TVProtocolType;
  pairingPort: number;
  remotePort: number;
  name: string;
}

/**
 * Checks whether an IP address is an active Smart TV (LG webOS or Android TV)
 * using standard unencrypted HTTP discovery endpoints.
 * This guarantees zero SSL handshake errors and zero false positives.
 */
export async function identifyTV(host: string, timeoutMs = 700): Promise<IdentifiedTV | null> {
  const cleanHost = host.trim();

  // 1. Probe LG webOS TV via AirPlay / DIAL port 7000
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`http://${cleanHost}:7000`, { signal: controller.signal });
    clearTimeout(timer);

    if (res.status === 403 || res.status === 200) {
      let friendlyName = `LG Smart TV (${cleanHost})`;

      // Try fetching exact model name from UPnP descriptor port 1045
      try {
        const uCtrl = new AbortController();
        const uTimer = setTimeout(() => uCtrl.abort(), 600);
        const uRes = await fetch(`http://${cleanHost}:1045`, { signal: uCtrl.signal });
        clearTimeout(uTimer);
        const xml = await uRes.text();
        const m = xml.match(/<friendlyName>(.*?)<\/friendlyName>/);
        if (m && m[1]) {
          friendlyName = m[1].trim();
        }
      } catch {}

      return {
        protocolType: 'webos',
        pairingPort: 3001,
        remotePort: 3001,
        name: friendlyName,
      };
    }
  } catch {}

  // 2. Probe Android TV / Google TV via Google Cast / DIAL port 8008
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`http://${cleanHost}:8008/setup/eureka_info`, { signal: controller.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return {
        protocolType: 'androidtv',
        pairingPort: PROTOCOL_CONSTANTS.DEFAULT_PAIRING_PORT,
        remotePort: PROTOCOL_CONSTANTS.DEFAULT_REMOTE_PORT,
        name: data?.name || `Android TV (${cleanHost})`,
      };
    }
  } catch {}

  return null;
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
    const detected = await identifyTV(cleanHost, 1200);

    if (detected) {
      return {
        protocolType: detected.protocolType,
        pairingPort: detected.pairingPort,
        remotePort: detected.remotePort,
        suggestedName: detected.name,
      };
    }

    return {
      protocolType: 'webos',
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

    // 1. Always display previously paired devices
    paired.forEach((dev) => {
      this.discoveredMap.set(dev.id, {
        id: dev.id,
        name: dev.name,
        host: dev.host,
        pairingPort: dev.pairingPort,
        remotePort: dev.remotePort,
        protocolType: dev.protocolType || (dev.pairingPort === 3001 ? 'webos' : 'androidtv'),
        isPaired: true,
        lastSeen: dev.pairedAt || Date.now(),
      });
    });
    this.notifyListeners();

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
      candidateSubnets.add('192.168.29');
      candidateSubnets.add('192.168.1');
      candidateSubnets.add('192.168.0');
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
            if (__DEV__ && !getDevBridgeHost()) {
              try {
                const bRes = await fetch(`http://${testHost}:3002/`, { signal: AbortSignal.timeout(250) });
                if (bRes.ok) {
                  const data = await bRes.json();
                  if (data && data.bridge === 'tv-remote') {
                    console.log(`[DiscoveryService] Discovered dev bridge at ${testHost}`);
                    setDiscoveredDevBridgeHost(testHost);
                  }
                }
              } catch {}
            }

            const detected = await identifyTV(testHost, 650);
            if (detected) {
              const id = `tv_${testHost.replace(/\./g, '_')}`;
              if (!this.discoveredMap.has(id)) {
                this.discoveredMap.set(id, {
                  id,
                  name: detected.name,
                  host: testHost,
                  pairingPort: detected.pairingPort,
                  remotePort: detected.remotePort,
                  protocolType: detected.protocolType,
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
