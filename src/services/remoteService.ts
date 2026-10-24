/**
 * Remote Control Service
 * Manages active session with the TV over WebSocket (wss:// or ws://).
 * Handles persistent client-key authentication and commands.
 */

import { DiscoveredTV } from '../types/device';
import { Direction, KeyCode } from '../types/remote';
import { StorageService } from '../utils/storage';

const FULL_PERMISSIONS = [
  'LAUNCH', 'LAUNCH_WEBAPP', 'APP_TO_APP', 'CLOSE', 'TEST_OPEN', 'TEST_PROTECTED',
  'CONTROL_AUDIO', 'CONTROL_DISPLAY', 'CONTROL_INPUT_JOYSTICK', 'CONTROL_INPUT_MEDIA_RECORDING',
  'CONTROL_INPUT_MEDIA_PLAYBACK', 'CONTROL_INPUT_TV', 'CONTROL_POWER', 'READ_APP_STATUS',
  'READ_CURRENT_CHANNEL', 'READ_INPUT_DEVICE_LIST', 'READ_NETWORK_STATUS', 'READ_RUNNING_APPS',
  'READ_TV_CHANNEL_LIST', 'WRITE_NOTIFICATION_TOAST', 'READ_POWER_STATE', 'READ_COUNTRY_INFO',
  'CONTROL_INPUT_TEXT', 'CONTROL_MOUSE_AND_KEYBOARD'
];

export class RemoteService {
  private activeTv: DiscoveredTV | null = null;
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private reqCounter: number = 1;
  private onDisconnectCallback: (() => void) | null = null;
  private commandQueue: any[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isMuted: boolean = false;

  private connectionPromise: Promise<boolean> | null = null;

  /**
   * Connects to the TV's remote control service
   */
  public async connect(
    tv: DiscoveredTV,
    onDisconnect?: () => void
  ): Promise<boolean> {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN && this.activeTv?.host === tv.host) {
      console.log('[RemoteService] Already connected and ready to this TV');
      return true;
    }

    if (this.connectionPromise && this.activeTv?.host === tv.host) {
      return this.connectionPromise;
    }

    if (this.ws) {
      const oldWs = this.ws;
      this.ws = null;
      try {
        oldWs.onopen = null;
        oldWs.onmessage = null;
        oldWs.onclose = null;
        oldWs.onerror = null;
        if (oldWs.readyState === WebSocket.OPEN) {
          oldWs.close();
        }
      } catch {
        // Ignore
      }
    }

    this.activeTv = tv;
    if (onDisconnect) {
      this.onDisconnectCallback = onDisconnect;
    }

    const protocol = tv.remotePort === 3001 ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${tv.host}:${tv.remotePort}/`;

    // Retrieve saved client-key if this TV was paired previously
    const savedKey = await StorageService.getClientKey(tv.host);

    this.connectionPromise = new Promise((resolve) => {
      let resolved = false;
      const markResolved = (val: boolean) => {
        if (!resolved) {
          resolved = true;
          this.connectionPromise = null;
          resolve(val);
        }
      };

      try {
        const currentWs = new WebSocket(wsUrl);
        this.ws = currentWs;

        currentWs.onopen = () => {
          if (this.ws !== currentWs || currentWs.readyState !== WebSocket.OPEN) {
            return;
          }

          console.log(`[RemoteService] Connected to TV control service at ${wsUrl}`);
          this.isConnected = true;

          const regPayload: any = {
            type: 'register',
            id: 'control_session',
            payload: {
              forcePairing: false,
              pairingType: 'PROMPT',
              manifest: {
                manifestVersion: 1,
                appVersion: '1.0',
                signed: {
                  created: '20140509',
                  appId: 'com.lge.test',
                  vendorId: 'com.lge',
                  localizedAppNames: { '': 'LG Remote App' },
                  permissions: FULL_PERMISSIONS,
                },
                permissions: FULL_PERMISSIONS,
                signatures: [{ signature: 'dummy', signatureVersion: 1 }],
              },
            },
          };

          if (savedKey) {
            console.log('[RemoteService] Sending saved client-key with registration');
            regPayload.payload['client-key'] = savedKey;
          }

          try {
            currentWs.send(JSON.stringify(regPayload));
          } catch (sendErr) {
            console.warn('[RemoteService] Error sending registration:', sendErr);
          }

          // Flush any queued commands
          while (this.commandQueue.length > 0) {
            const queued = this.commandQueue.shift();
            console.log(`[RemoteService] Sending queued command: ${queued.uri || queued.name}`);
            try {
              currentWs.send(JSON.stringify(queued));
            } catch {}
          }
        };

        currentWs.onmessage = async (event) => {
          if (this.ws !== currentWs) return;
          try {
            const data = JSON.parse(event.data);
            console.log('[RemoteService] TV message:', data);

            // Update mute status if reported by TV
            if (data.payload?.volumeStatus?.muteStatus !== undefined) {
              this.isMuted = Boolean(data.payload.volumeStatus.muteStatus);
            }
            if (data.payload?.muteStatus !== undefined) {
              this.isMuted = Boolean(data.payload.muteStatus);
            }

            // If TV accepted registration and emitted client-key:
            if (data.type === 'registered' && data.payload && data.payload['client-key']) {
              const newKey = data.payload['client-key'];
              console.log('[RemoteService] TV registered successfully! Client-key:', newKey);
              await StorageService.setClientKey(tv.host, newKey);
              this.isConnected = true;
              this.startHeartbeat();
              markResolved(true);
            } else if (data.type === 'response' && data.payload && data.payload.returnValue && savedKey) {
              this.isConnected = true;
              this.startHeartbeat();
              markResolved(true);
            }
          } catch {
            // Ignore
          }
        };

        currentWs.onerror = (e) => {
          if (this.ws !== currentWs) return;
          console.warn('[RemoteService] WebSocket error:', e);
          this.stopHeartbeat();
          markResolved(false);
        };

        currentWs.onclose = () => {
          if (this.ws !== currentWs) return;
          console.log('[RemoteService] Remote control WebSocket closed');
          this.stopHeartbeat();
          this.isConnected = false;
          markResolved(false);

          // Auto-reconnect if TV target is still set
          if (this.activeTv) {
            const target = this.activeTv;
            setTimeout(() => {
              if (this.activeTv && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
                console.log('[RemoteService] Auto-reconnecting to TV...');
                this.connect(target, this.onDisconnectCallback || undefined);
              }
            }, 1000);
          }
        };

        // Fallback safety timeout
        setTimeout(() => {
          if (!resolved) {
            this.isConnected = Boolean(savedKey);
            markResolved(this.isConnected);
          }
        }, 2000);
      } catch (e) {
        console.warn('[RemoteService] Failed to initialize WebSocket:', e);
        this.disconnect();
        markResolved(false);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Sends button press event to TV pointer / D-pad socket
   */
  public sendButton(name: string): boolean {
    const packet = { type: 'button', name };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(`[RemoteService] Sending button: ${name}`);
      this.ws.send(JSON.stringify(packet));
      return true;
    } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      this.commandQueue.push(packet);
      return true;
    }
    return false;
  }

  /**
   * Helper to send an SSAP request to the TV
   */
  private sendRequest(uri: string, payload?: any): boolean {
    const id = `req_${this.reqCounter++}`;
    const packet: any = {
      id,
      type: 'request',
      uri,
    };
    if (payload) {
      packet.payload = payload;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(`[RemoteService] Sending command: ${uri}`, payload || '');
      this.ws.send(JSON.stringify(packet));
      return true;
    } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      console.log(`[RemoteService] Connection in progress, queuing command: ${uri}`);
      this.commandQueue.push(packet);
      return true;
    }

    console.warn('[RemoteService] WebSocket not open, cannot send command to TV');
    return false;
  }

  /**
   * Sends key events (Navigation, Volume, Media, Channels) to the TV
   */
  public async sendKey(
    keyCode: KeyCode,
    direction: Direction = Direction.SHORT
  ): Promise<boolean> {
    switch (keyCode) {
      // D-Pad Directional Navigation
      case KeyCode.DPAD_UP:
        return this.sendButton('UP');

      case KeyCode.DPAD_DOWN:
        return this.sendButton('DOWN');

      case KeyCode.DPAD_LEFT:
        return this.sendButton('LEFT');

      case KeyCode.DPAD_RIGHT:
        return this.sendButton('RIGHT');

      case KeyCode.DPAD_CENTER:
        return this.sendButton('ENTER');

      // System Navigation
      case KeyCode.BACK:
        return this.sendButton('BACK');

      case KeyCode.HOME:
        this.sendButton('HOME');
        return this.sendRequest('ssap://system.launcher/open', { id: 'com.webos.app.home' });

      case KeyCode.MENU:
        return this.sendButton('MENU');

      // Audio Controls
      case KeyCode.VOLUME_UP:
        this.isMuted = false;
        return this.sendRequest('ssap://audio/volumeUp');

      case KeyCode.VOLUME_DOWN:
        this.isMuted = false;
        return this.sendRequest('ssap://audio/volumeDown');

      case KeyCode.VOLUME_MUTE:
        this.isMuted = !this.isMuted;
        this.sendButton('MUTE');
        return true;

      // Media Controls
      case KeyCode.MEDIA_PLAY:
      case KeyCode.MEDIA_PLAY_PAUSE:
        this.sendButton('PLAY');
        return this.sendRequest('ssap://media.controls/play');

      case KeyCode.MEDIA_PAUSE:
        this.sendButton('PAUSE');
        return this.sendRequest('ssap://media.controls/pause');

      case KeyCode.MEDIA_REWIND:
        this.sendButton('REWIND');
        return this.sendRequest('ssap://media.controls/rewind');

      case KeyCode.MEDIA_FAST_FORWARD:
        this.sendButton('FASTFORWARD');
        return this.sendRequest('ssap://media.controls/fastForward');

      // Power
      case KeyCode.POWER:
        return this.sendRequest('ssap://system/turnOff');

      default:
        return true;
    }
  }

  /**
   * Launches streaming apps on the TV (Netflix, YouTube, JioHotstar)
   */
  public async launchApp(appUrl: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Not connected to TV');
    }

    let targetAppId = 'netflix';
    if (appUrl.includes('youtube')) {
      targetAppId = 'youtube.leanback.v4';
    } else if (appUrl.includes('hotstar')) {
      targetAppId = 'hotstar';
    } else if (appUrl.includes('netflix')) {
      targetAppId = 'netflix';
    }

    console.log(`[RemoteService] Opening app ${targetAppId} on TV...`);
    return this.sendRequest('ssap://system.launcher/open', { id: targetAppId });
  }

  /**
   * Sends text input to the active input/search field on the TV (Hotstar, YouTube, Netflix, system search)
   */
  public async sendText(text: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Not connected to TV');
    }

    console.log(`[RemoteService] Sending text "${text}" to TV via webOS IME...`);
    return this.sendRequest('ssap://com.webos.service.ime/insertText', { text, replace: 0 });
  }

  /**
   * Submits active text input (Enter / Search)
   */
  public async sendEnterKey(): Promise<boolean> {
    this.sendRequest('ssap://com.webos.service.ime/sendEnterKey');
    return this.sendButton('ENTER');
  }

  /**
   * Deletes characters from the active input field
   */
  public async deleteCharacters(count: number = 1): Promise<boolean> {
    return this.sendRequest('ssap://com.webos.service.ime/deleteCharacters', { count });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send lightweight keepalive ping to prevent idle connection drop
        this.sendRequest('ssap://audio/getVolume');
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getActiveTv(): DiscoveredTV | null {
    return this.activeTv;
  }

  /**
   * Disconnects and cleans up WebSocket
   */
  public disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
    this.isConnected = false;
    this.activeTv = null;
    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
      this.onDisconnectCallback = null;
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getActiveTV(): DiscoveredTV | null {
    return this.activeTv;
  }
}

export const remoteService = new RemoteService();
