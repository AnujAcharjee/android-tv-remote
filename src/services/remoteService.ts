/**
 * Remote Control Service
 * Manages active session with the TV over WebSocket (wss:// or ws://).
 * Handles persistent client-key authentication and commands.
 */

import { DiscoveredTV } from '../types/device';
import { Direction, KeyCode } from '../types/remote';
import { getDevBridgeWebSocketUrl } from '../utils/devBridge';
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
  private pointerWs: WebSocket | null = null;
  private isPointerOpen: boolean = false;
  private isConnected: boolean = false;
  private reqCounter: number = 1;
  private onDisconnectCallback: (() => void) | null = null;
  private commandQueue: any[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isMuted: boolean = false;
  private isImeSubscribed: boolean = false;

  private connectionPromise: Promise<boolean> | null = null;

  private ensureImeSubscribed(): void {
    if (!this.isImeSubscribed && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.isImeSubscribed = true;
      this.sendRequest('ssap://com.webos.service.ime/registerRemoteKeyboard', { subscribe: true });
    }
  }

  private requestPointerSocket(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendRequest('ssap://com.webos.service.networkinput/getPointerInputSocket');
    }
  }

  private initPointerSocket(socketPath: string): void {
    if (this.pointerWs && this.pointerWs.readyState === WebSocket.OPEN) return;

    console.log('[RemoteService] Connecting to direct pointer input socket:', socketPath);
    try {
      const pWs = new WebSocket(socketPath);
      this.pointerWs = pWs;

      pWs.onopen = () => {
        console.log('[RemoteService] Direct pointer/D-Pad socket connected!');
        this.isPointerOpen = true;
      };

      pWs.onclose = () => {
        console.log('[RemoteService] Direct pointer socket closed');
        this.isPointerOpen = false;
        this.pointerWs = null;
      };

      pWs.onerror = (e) => {
        console.warn('[RemoteService] Direct pointer socket error:', e);
        this.isPointerOpen = false;
      };
    } catch (e) {
      console.warn('[RemoteService] Failed to initialize pointer socket:', e);
    }
  }

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

    const targetPort = tv.remotePort || tv.pairingPort || 3001;
    const protocol = targetPort === 3001 ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${tv.host}:${targetPort}/`;

    // Retrieve saved client-key if this TV was paired previously
    const savedKey = await StorageService.getClientKey(tv.host);

    let triedDevFallback = false;

    this.connectionPromise = new Promise((resolve) => {
      let resolved = false;
      const markResolved = (val: boolean) => {
        if (!resolved) {
          resolved = true;
          this.connectionPromise = null;
          resolve(val);
        }
      };

      const connectSocket = (url: string) => {
        try {
          const currentWs = new WebSocket(url);
          this.ws = currentWs;

          currentWs.onopen = () => {
            if (this.ws !== currentWs || currentWs.readyState !== WebSocket.OPEN) {
              return;
            }

            console.log(`[RemoteService] Connected to TV control service at ${url}`);
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

              // Handle pointer socket path if returned by TV
              if (data.payload?.socketPath) {
                this.initPointerSocket(data.payload.socketPath);
              }

              // If TV accepted registration and emitted client-key:
              if (data.type === 'registered' && data.payload && data.payload['client-key']) {
                const newKey = data.payload['client-key'];
                console.log('[RemoteService] TV registered successfully! Client-key:', newKey);
                await StorageService.setClientKey(tv.host, newKey);
                this.isConnected = true;
                this.ensureImeSubscribed();
                this.requestPointerSocket();
                this.startHeartbeat();
                markResolved(true);
              } else if (!resolved && data.type === 'response' && data.payload?.returnValue && savedKey) {
                this.isConnected = true;
                this.ensureImeSubscribed();
                this.requestPointerSocket();
                this.startHeartbeat();
                markResolved(true);
              }
            } catch {
              // Ignore
            }
          };

          currentWs.onerror = (e) => {
            if (this.ws !== currentWs) return;
            console.warn('[RemoteService] WebSocket error on', url);

            // In Expo Go (__DEV__), if direct wss:// is rejected by Android's SSL policy,
            // seamlessly fallback to dev bridge on port 3002
            if (__DEV__ && !triedDevFallback && url.startsWith('wss://')) {
              triedDevFallback = true;
              const devBridgeUrl = getDevBridgeWebSocketUrl(tv);
              if (devBridgeUrl) {
                console.log('[RemoteService] Falling back to dev bridge:', devBridgeUrl);
                connectSocket(devBridgeUrl);
                return;
              }
            }

            this.stopHeartbeat();
            markResolved(false);
          };

          currentWs.onclose = () => {
            if (this.ws !== currentWs) return;
            console.log('[RemoteService] Remote control WebSocket closed');

            if (__DEV__ && !triedDevFallback && url.startsWith('wss://')) {
              triedDevFallback = true;
              const devBridgeUrl = getDevBridgeWebSocketUrl(tv);
              if (devBridgeUrl) {
                console.log('[RemoteService] Retrying on dev bridge after close:', devBridgeUrl);
                connectSocket(devBridgeUrl);
                return;
              }
            }

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

          // Fallback safety timeout: if bridge is open or savedKey was sent, mark connected
          setTimeout(() => {
            if (!resolved && this.isConnected) {
              markResolved(true);
            }
          }, 2500);
        } catch (e) {
          console.warn('[RemoteService] Failed to initialize WebSocket:', e);
          this.disconnect();
          markResolved(false);
        }
      };

      connectSocket(wsUrl);
    });

    return this.connectionPromise;
  }

  /**
   * Sends button press event to TV pointer / D-pad socket
   */
  public sendButton(name: string): boolean {
    if (this.pointerWs && this.isPointerOpen && this.pointerWs.readyState === WebSocket.OPEN) {
      console.log(`[RemoteService] Sending button to direct pointer socket: ${name}`);
      this.pointerWs.send(`type:button\nname:${name}\n\n`);
      return true;
    }

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
   * Sends raw text directly to pointer / keyboard socket
   */
  public sendPointerText(text: string): boolean {
    if (this.pointerWs && this.isPointerOpen && this.pointerWs.readyState === WebSocket.OPEN) {
      console.log(`[RemoteService] Sending text to direct pointer socket: ${text}`);
      this.pointerWs.send(`type:text\ntext:${text}\n\n`);
      return true;
    }

    const packet = { type: 'text', text };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(`[RemoteService] Sending text over control session: ${text}`);
      this.ws.send(JSON.stringify(packet));
      return true;
    }
    return false;
  }

  /**
   * Sends individual character key event over the remote protocol
   */
  public sendCharKey(char: string): boolean {
    if (char === ' ') {
      return this.sendButton('SPACE');
    }
    const upper = char.toUpperCase();
    if ((upper >= 'A' && upper <= 'Z') || (upper >= '0' && upper <= '9')) {
      return this.sendButton(upper);
    }
    if (char === '\n' || char === '\r') {
      return this.sendButton('ENTER');
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
   * Universal text search & entry:
   * Types text into the active input box across ANY app on TV, then submits with Enter.
   * Works reliably for both native apps (YouTube, Netflix) and custom on-screen keyboard apps (Disney+ Hotstar).
   */
  public async sendTextAndSubmit(text: string): Promise<boolean> {
    const cleanText = text.trim();
    if (!cleanText) return false;

    console.log(`[RemoteService] Sending text/search "${cleanText}" to active TV app...`);
    this.ensureImeSubscribed();

    // 1. Send via hybrid input (IME + Pointer Text + Character Keys) into active app
    await this.sendText(cleanText);

    // 2. Submit with Enter on both IME and hardware ENTER button
    setTimeout(() => {
      this.sendEnterKey();
    }, 200);

    return true;
  }

  /**
   * Universal TV Search:
   * Triggers the TV's global universal search across ALL apps, channels, and media
   */
  public async searchUniversal(query: string): Promise<boolean> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return false;

    console.log(`[RemoteService] Triggering Universal TV search for "${cleanQuery}"...`);
    this.sendRequest('ssap://system.launcher/open', {
      id: 'com.webos.app.discovery',
      params: { query: cleanQuery, keyword: cleanQuery },
    });
    this.ensureImeSubscribed();
    setTimeout(() => {
      this.sendText(cleanQuery);
      setTimeout(() => {
        this.sendEnterKey();
      }, 300);
    }, 350);

    return true;
  }

  /**
   * Dynamic Search in specific apps (YouTube, Netflix, Hotstar, Prime, etc.)
   */
  public async searchInApp(appId: string, query: string): Promise<boolean> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return false;

    console.log(`[RemoteService] Dynamic search in app "${appId}" for "${cleanQuery}"...`);

    const lowerId = appId.toLowerCase();
    if (lowerId.includes('youtube')) {
      return this.sendRequest('ssap://system.launcher/open', {
        id: 'youtube.leanback.v4',
        contentId: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`,
      });
    }

    if (lowerId.includes('netflix')) {
      return this.sendRequest('ssap://system.launcher/open', {
        id: 'netflix',
        contentId: `https://www.netflix.com/search?q=${encodeURIComponent(cleanQuery)}`,
      });
    }

    // Default: Open the app and type the text into its search
    await this.sendRequest('ssap://system.launcher/open', { id: appId });
    setTimeout(() => {
      this.sendTextAndSubmit(cleanQuery);
    }, 1200);

    return true;
  }

  /**
   * Sends text input to the active input/search field on the TV (Hotstar, YouTube, Netflix, system search).
   * Uses hybrid dispatch:
   * 1. webOS system IME insertText (for native input fields)
   * 2. Pointer socket raw text command (for webOS input widgets)
   * 3. Character key events stream (for apps with custom on-screen keyboards like Disney+ Hotstar)
   */
  public async sendText(text: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Not connected to TV');
    }

    const cleanText = text.trim();
    if (!cleanText) return false;

    console.log(`[RemoteService] Sending text "${cleanText}" to TV (IME + Pointer + Keys)...`);
    this.ensureImeSubscribed();

    // 1. Send via OS IME for native input fields
    this.sendRequest('ssap://com.webos.service.ime/insertText', { text: cleanText, replace: 0 });

    // 2. Send via pointer socket text protocol
    this.sendPointerText(cleanText);

    // 3. Stream character key events for apps with custom on-screen keyboard listeners
    for (const char of cleanText) {
      this.sendCharKey(char);
      await new Promise((resolve) => setTimeout(resolve, 35));
    }

    return true;
  }

  /**
   * Submits active text input (both IME Enter and hardware ENTER button)
   */
  public async sendEnterKey(): Promise<boolean> {
    console.log('[RemoteService] Submitting text with IME Enter and Hardware ENTER');
    this.sendButton('ENTER');
    return this.sendRequest('ssap://com.webos.service.ime/sendEnterKey');
  }

  /**
   * Deletes characters from the active input field
   */
  public async deleteCharacters(count: number = 1): Promise<boolean> {
    for (let i = 0; i < count; i++) {
      this.sendButton('BACKSPACE');
    }
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
   * Disconnects and cleans up WebSockets
   */
  public disconnect(): void {
    this.stopHeartbeat();
    if (this.pointerWs) {
      try {
        this.pointerWs.close();
      } catch {
        // Ignore
      }
      this.pointerWs = null;
      this.isPointerOpen = false;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
    this.isConnected = false;
    this.isImeSubscribed = false;
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
