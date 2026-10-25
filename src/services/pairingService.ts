/**
 * Pairing Service
 * Implements TV pairing handshake with on-screen PIN verification.
 * Verifies pairing response with the TV and never accepts arbitrary codes or simulates success.
 */

import { DiscoveredTV, PairingFailureReason, StoredTVDevice } from '../types/device';
import { getDevBridgeWebSocketUrl } from '../utils/devBridge';
import { SecureStorageService } from '../utils/secureStorage';
import { StorageService } from '../utils/storage';

export interface PairingCallbacks {
  onAwaitingCode: (pinLength: number) => void;
  onSuccess: (tv: DiscoveredTV) => void;
  onFailure: (failure: PairingFailureReason) => void;
}

const FULL_PERMISSIONS = [
  'LAUNCH', 'LAUNCH_WEBAPP', 'APP_TO_APP', 'CLOSE', 'TEST_OPEN', 'TEST_PROTECTED',
  'CONTROL_AUDIO', 'CONTROL_DISPLAY', 'CONTROL_INPUT_JOYSTICK', 'CONTROL_INPUT_MEDIA_RECORDING',
  'CONTROL_INPUT_MEDIA_PLAYBACK', 'CONTROL_INPUT_TV', 'CONTROL_POWER', 'READ_APP_STATUS',
  'READ_CURRENT_CHANNEL', 'READ_INPUT_DEVICE_LIST', 'READ_NETWORK_STATUS', 'READ_RUNNING_APPS',
  'READ_TV_CHANNEL_LIST', 'WRITE_NOTIFICATION_TOAST', 'READ_POWER_STATE', 'READ_COUNTRY_INFO',
  'CONTROL_INPUT_TEXT', 'CONTROL_MOUSE_AND_KEYBOARD'
];

export class PairingService {
  private activeTv: DiscoveredTV | null = null;
  private ws: WebSocket | null = null;
  private callbacks: PairingCallbacks | null = null;
  private isPairingInProgress: boolean = false;
  private savedClientKey: string | null = null;
  private pairingTimeoutTimer: NodeJS.Timeout | null = null;
  private codeSubmitResolver: { resolve: (val: boolean) => void; reject: (err: Error) => void } | null = null;

  /**
   * Initiates pairing with target TV.
   * Sends registration request to trigger on-screen PIN dialog on the TV.
   */
  public async startPairing(tv: DiscoveredTV, callbacks: PairingCallbacks): Promise<void> {
    if (this.isPairingInProgress) {
      this.cancelPairing();
    }

    this.isPairingInProgress = true;
    this.activeTv = tv;
    this.callbacks = callbacks;
    this.savedClientKey = null;

    const targetPort = tv.pairingPort || tv.remotePort || 3001;
    const protocol = targetPort === 3001 ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${tv.host}:${targetPort}/`;

    console.log(`[PairingService] Initiating direct pairing with TV at ${wsUrl}...`);

    // 60-second overall pairing timeout
    this.pairingTimeoutTimer = setTimeout(() => {
      this.handleFailure({
        code: 'TIMEOUT',
        message: 'Pairing timed out. The TV took too long to respond.',
      });
    }, 60000);

    let awaitingCodeFallbackTimer: NodeJS.Timeout | null = null;
    let triedDevFallback = false;

    const connectSocket = (url: string) => {
      try {
        const currentWs = new WebSocket(url);
        this.ws = currentWs;

        currentWs.onopen = () => {
          if (this.ws !== currentWs || currentWs.readyState !== WebSocket.OPEN) {
            return;
          }

          console.log(`[PairingService] WebSocket open on ${url}. Sending registration...`);

          const regPayload = {
            type: 'register',
            id: 'reg_handshake',
            payload: {
              forcePairing: true,
              pairingType: 'PIN',
              manifest: {
                manifestVersion: 1,
                appVersion: '1.0',
                signed: {
                  created: '20140509',
                  appId: 'com.lge.test',
                  vendorId: 'com.lge',
                  localizedAppNames: { '': 'TV Remote' },
                  permissions: FULL_PERMISSIONS,
                },
                permissions: FULL_PERMISSIONS,
                signatures: [{ signature: 'dummy', signatureVersion: 1 }],
              },
            },
          };

          try {
            currentWs.send(JSON.stringify(regPayload));
          } catch (sendErr) {
            console.warn('[PairingService] Error sending registration:', sendErr);
          }

          // Display code screen once registration is sent (fallback after brief delay)
          awaitingCodeFallbackTimer = setTimeout(() => {
            if (this.isPairingInProgress && this.ws === currentWs) {
              callbacks.onAwaitingCode(8);
            }
          }, 1200);
        };

        currentWs.onmessage = async (event) => {
          if (this.ws !== currentWs) return;
          if (awaitingCodeFallbackTimer) {
            clearTimeout(awaitingCodeFallbackTimer);
            awaitingCodeFallbackTimer = null;
          }
          try {
            const msg = JSON.parse(event.data);
            console.log('[PairingService] TV response:', msg);

            // 1. PIN display acknowledgment from TV
            if (msg.type === 'response' && msg.id === 'reg_handshake') {
              if (msg.payload && (msg.payload.pairingType === 'PIN' || msg.payload.pairingType === 'PROMPT')) {
                callbacks.onAwaitingCode(8);
              }
            }

            // 2. Successful verification from TV
            if (msg.type === 'registered' && msg.payload && msg.payload['client-key']) {
              const key = msg.payload['client-key'];
              console.log('[PairingService] TV accepted PIN! Verified client-key:', key);
              this.savedClientKey = key;

              // Persist verified credentials securely in hardware Keystore
              const storedDev: StoredTVDevice = {
                id: tv.id,
                name: tv.name,
                host: tv.host,
                pairingPort: tv.pairingPort,
                remotePort: tv.remotePort,
                pairedAt: Date.now(),
              };
              await SecureStorageService.savePairedDevice(storedDev);
              await SecureStorageService.savePairingCredentials(tv.host, key);
              await StorageService.setClientKey(tv.host, key);
              await SecureStorageService.setActiveDeviceId(tv.id);

              tv.isPaired = true;
              this.cleanupTimers();
              this.isPairingInProgress = false;

              if (this.codeSubmitResolver) {
                this.codeSubmitResolver.resolve(true);
                this.codeSubmitResolver = null;
              }

              callbacks.onSuccess(tv);
            }

            // 3. Error / Rejection from TV during PIN verification
            if (msg.type === 'error') {
              const errorStr = (msg.error || '').toLowerCase();
              let failureReason: PairingFailureReason;

              if (errorStr.includes('pin') || errorStr.includes('invalid') || errorStr.includes('401') || errorStr.includes('unauthorized')) {
                failureReason = {
                  code: 'INCORRECT_PIN',
                  message: 'Incorrect PIN code entered. Please check your TV screen.',
                };
              } else if (errorStr.includes('expire') || errorStr.includes('timeout')) {
                failureReason = {
                  code: 'EXPIRED_PIN',
                  message: 'Pairing code has expired. Please search and request a new code.',
                };
              } else {
                failureReason = {
                  code: 'REJECTED',
                  message: msg.error || 'Pairing was rejected by the TV.',
                };
              }

              if (this.codeSubmitResolver) {
                this.codeSubmitResolver.reject(new Error(failureReason.message));
                this.codeSubmitResolver = null;
              }

              this.handleFailure(failureReason);
            }
          } catch {
            // Ignore non-json
          }
        };

        currentWs.onerror = (e: any) => {
          if (this.ws !== currentWs) return;
          console.warn('[PairingService] WebSocket error on', url);

          // In Expo Go (__DEV__), if direct wss:// is rejected by Android's SSL policy,
          // seamlessly fallback to dev bridge on port 3002
          if (__DEV__ && !triedDevFallback && url.startsWith('wss://')) {
            triedDevFallback = true;
            const devBridgeUrl = getDevBridgeWebSocketUrl(tv);
            if (devBridgeUrl) {
              console.log('[PairingService] Falling back to dev bridge:', devBridgeUrl);
              connectSocket(devBridgeUrl);
              return;
            }
          }

          this.handleFailure({
            code: 'UNAVAILABLE',
            message: 'Unable to connect to TV. Ensure your TV and phone are on the same Wi-Fi network.',
          });
        };

        currentWs.onclose = () => {
          if (this.ws !== currentWs) return;
          console.log('[PairingService] WebSocket closed');

          if (this.isPairingInProgress && !this.savedClientKey) {
            if (__DEV__ && !triedDevFallback && url.startsWith('wss://')) {
              triedDevFallback = true;
              const devBridgeUrl = getDevBridgeWebSocketUrl(tv);
              if (devBridgeUrl) {
                console.log('[PairingService] Retrying on dev bridge after close:', devBridgeUrl);
                connectSocket(devBridgeUrl);
                return;
              }
            }

            this.handleFailure({
              code: 'WIFI_DISCONNECTED',
              message: 'Connection closed by TV or network disconnected.',
            });
          }
        };
      } catch (err: any) {
        this.handleFailure({
          code: 'UNAVAILABLE',
          message: err?.message || 'Failed to establish connection with TV.',
        });
      }
    };

    connectSocket(wsUrl);
  }

  /**
   * Submits user-entered PIN to the TV for authentication.
   * Throws an error if code is invalid or rejected by TV.
   */
  public async submitPin(pin: string): Promise<boolean> {
    if (!this.activeTv) {
      throw new Error('No active TV pairing session');
    }

    const trimmed = pin.trim();
    if (!trimmed || trimmed.length < 4) {
      throw new Error('Please enter a valid pairing code');
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('TV connection is not open. Please retry pairing.');
    }

    return new Promise<boolean>((resolve, reject) => {
      this.codeSubmitResolver = { resolve, reject };

      // Set timeout for PIN verification response (15 seconds)
      const verifyTimeout = setTimeout(() => {
        if (this.codeSubmitResolver) {
          this.codeSubmitResolver = null;
          reject(new Error('TV took too long to verify the PIN. Please try again.'));
        }
      }, 15000);

      const pinMessage = {
        id: 'verify_pin_req',
        type: 'request',
        uri: 'ssap://pairing/setPin',
        payload: {
          pin: trimmed,
        },
      };

      console.log('[PairingService] Sending PIN verification to TV...');
      try {
        this.ws?.send(JSON.stringify(pinMessage));
      } catch (e: any) {
        clearTimeout(verifyTimeout);
        this.codeSubmitResolver = null;
        reject(new Error(e?.message || 'Failed to send PIN to TV'));
      }
    });
  }

  /**
   * Cancels active pairing session
   */
  public cancelPairing(): void {
    this.cleanupTimers();
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // Ignore
      }
    }
    this.isPairingInProgress = false;
    this.activeTv = null;
    if (this.codeSubmitResolver) {
      this.codeSubmitResolver.reject(new Error('Pairing cancelled by user'));
      this.codeSubmitResolver = null;
    }
  }

  private handleFailure(reason: PairingFailureReason): void {
    this.cleanupTimers();
    if (this.ws) {
      const socket = this.ws;
      this.ws = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // Ignore
      }
    }
    this.isPairingInProgress = false;
    if (this.callbacks) {
      this.callbacks.onFailure(reason);
    }
  }

  private cleanupTimers(): void {
    if (this.pairingTimeoutTimer) {
      clearTimeout(this.pairingTimeoutTimer);
      this.pairingTimeoutTimer = null;
    }
  }
}
