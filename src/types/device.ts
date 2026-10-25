/**
 * TV Discovery, Connection Status, and Device storage types
 */

export type TVConnectionState =
  | 'idle'
  | 'discovering'
  | 'deviceSelected'
  | 'awaitingPrompt'
  | 'awaitingCode'
  | 'pairing'
  | 'connected'
  | 'failed';

export type TVProtocolType = 'webos' | 'androidtv' | 'auto';

export interface DiscoveredTV {
  id: string;             // Unique identifier (e.g. mDNS name, MAC, or IP:Port)
  name: string;           // Display name (e.g. "Smart TV (Living Room)")
  host: string;           // IP address or hostname (e.g. "192.168.1.50")
  pairingPort: number;    // Port for pairing handshake
  remotePort: number;     // Port for remote commands
  protocolType?: TVProtocolType; // Protocol used (webos, androidtv, auto)
  model?: string;         // Device model string
  isPaired?: boolean;     // Whether stored credentials exist for this device
  lastSeen?: number;      // Epoch timestamp of last discovery packet
}

export interface StoredTVDevice {
  id: string;
  name: string;
  host: string;
  pairingPort: number;
  remotePort: number;
  protocolType?: TVProtocolType;
  pairedAt: number;
}

export interface StoredCertificate {
  clientCertPem: string;
  clientKeyPem: string;
  serverCertPem?: string;
  createdAt: number;
}

export interface PairingFailureReason {
  code: 'INCORRECT_PIN' | 'EXPIRED_PIN' | 'TIMEOUT' | 'UNAVAILABLE' | 'WIFI_DISCONNECTED' | 'REJECTED' | 'CANCELLED';
  message: string;
}
