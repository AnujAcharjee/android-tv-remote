/**
 * Robust TV WebSocket Relay Bridge
 * Bypasses Android's self-signed TLS restrictions by relaying
 * WebSocket messages from phone (ws://) to LG TV (wss://) with proper framing.
 * Supports both SSAP protocol and the High-Performance Pointer/D-Pad Input Socket.
 */

const http = require('http');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

let TV_URL = 'wss://192.168.29.33:3001/';
const PORT = 3002;
let currentClientKey = 'a80668eb53a8433dbd4cf96bcd37ceeb';
const DEFAULT_CLIENT_KEY = 'a80668eb53a8433dbd4cf96bcd37ceeb';
let activeTvTarget = '192.168.29.33:3001';
const RECOGNIZE_SCRIPT = path.join(__dirname, 'scripts', 'recognize.ps1');

const fullPermissions = [
  'LAUNCH', 'LAUNCH_WEBAPP', 'APP_TO_APP', 'CLOSE', 'TEST_OPEN', 'TEST_PROTECTED',
  'CONTROL_AUDIO', 'CONTROL_DISPLAY', 'CONTROL_INPUT_JOYSTICK', 'CONTROL_INPUT_MEDIA_RECORDING',
  'CONTROL_INPUT_MEDIA_PLAYBACK', 'CONTROL_INPUT_TV', 'CONTROL_POWER', 'READ_APP_STATUS',
  'READ_CURRENT_CHANNEL', 'READ_INPUT_DEVICE_LIST', 'READ_NETWORK_STATUS', 'READ_RUNNING_APPS',
  'READ_TV_CHANNEL_LIST', 'WRITE_NOTIFICATION_TOAST', 'READ_POWER_STATE', 'READ_COUNTRY_INFO',
  'CONTROL_INPUT_TEXT', 'CONTROL_MOUSE_AND_KEYBOARD'
];

let tvWs = null;
let pointerWs = null;
let isTvOpen = false;
let isPointerOpen = false;
let lastMuteStatus = false;
const pendingMessages = [];

// HTTP Server handling Voice Search Transcription & Health
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/transcribe' && req.method === 'POST') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const rawBuffer = Buffer.concat(chunks);
        let audioBuffer = rawBuffer;

        // Support JSON payload with audioBase64
        try {
          const parsed = JSON.parse(rawBuffer.toString('utf8'));
          if (parsed.audioBase64) {
            audioBuffer = Buffer.from(parsed.audioBase64, 'base64');
          }
        } catch {}

        let ext = '.wav';
        if (audioBuffer.length >= 8 && audioBuffer.slice(4, 8).toString('utf8') === 'ftyp') {
          ext = '.m4a';
        } else if (audioBuffer.length >= 4 && audioBuffer.slice(0, 4).toString('utf8') === 'OggS') {
          ext = '.ogg';
        }
        const tempFile = path.join(__dirname, `temp_voice_${Date.now()}${ext}`);
        fs.writeFileSync(tempFile, audioBuffer);
        console.log(`[Bridge Voice] Audio received (${audioBuffer.length} bytes, format: ${ext}), transcribing speech...`);

        const psArgs = [
          '-NoProfile',
          '-ExecutionPolicy', 'Bypass',
          '-File', RECOGNIZE_SCRIPT,
          '-AudioPath', tempFile,
        ];

        execFile('powershell', psArgs, { encoding: 'utf8', timeout: 20000 }, (error, stdout, stderr) => {
          try {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
          } catch {}

          if (error) {
            console.warn('[Bridge Voice] Recognition error:', error.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
            return;
          }

          const rawOutput = (stdout || '').trim();
          console.log('[Bridge Voice] Output:', rawOutput);
          try {
            const result = JSON.parse(rawOutput);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: Boolean(rawOutput), text: rawOutput }));
          }
        });
      } catch (err) {
        console.warn('[Bridge Voice] Handler error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', bridge: 'tv-remote', tvOpen: isTvOpen, pointerOpen: isPointerOpen }));
});

const wss = new WebSocket.Server({ server });
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bridge] TV Relay Bridge & Voice Server running on ws://0.0.0.0:${PORT}`);
});

function initPointerSocket(socketPath) {
  if (pointerWs && pointerWs.readyState === WebSocket.OPEN) return;

  console.log('[Bridge] Opening pointer socket at', socketPath);
  pointerWs = new WebSocket(socketPath, { rejectUnauthorized: false });

  pointerWs.on('open', () => {
    console.log('[Bridge] Pointer/D-Pad socket ready for instant navigation!');
    isPointerOpen = true;
  });

  pointerWs.on('close', () => {
    console.log('[Bridge] Pointer socket closed. Re-requesting pointer socket...');
    isPointerOpen = false;
    pointerWs = null;
    if (tvWs && isTvOpen && tvWs.readyState === WebSocket.OPEN) {
      setTimeout(() => {
        try {
          tvWs.send(JSON.stringify({
            id: 'bridge_get_pointer',
            type: 'request',
            uri: 'ssap://com.webos.service.networkinput/getPointerInputSocket'
          }));
        } catch {}
      }, 500);
    }
  });

  pointerWs.on('error', (e) => {
    console.log('[Bridge] Pointer socket error:', e.message);
    isPointerOpen = false;
  });
}

function getOrCreateTvConnection() {
  if (tvWs && (tvWs.readyState === WebSocket.OPEN || tvWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log('[Bridge] Connecting to TV at', TV_URL);
  tvWs = new WebSocket(TV_URL, {
    rejectUnauthorized: false,
  });

  tvWs.on('open', () => {
    console.log('[Bridge] Connected to TV! Sending registration...');
    isTvOpen = true;

    // Send full permission registration
    const regPayload = {
      type: 'register',
      id: 'bridge_reg',
      payload: {
        'client-key': DEFAULT_CLIENT_KEY,
        manifest: {
          manifestVersion: 1,
          appVersion: '1.0',
          signed: {
            created: '20140509',
            appId: 'com.lge.test',
            vendorId: 'com.lge',
            localizedAppNames: { '': 'LG Remote App' },
            permissions: fullPermissions
          },
          permissions: fullPermissions,
          signatures: [{ signature: 'dummy', signatureVersion: 1 }]
        }
      }
    };
    tvWs.send(JSON.stringify(regPayload));

    while (pendingMessages.length > 0) {
      const msg = pendingMessages.shift();
      tvWs.send(msg);
    }
  });

  tvWs.on('message', (message) => {
    const text = message.toString();
    try {
      const parsed = JSON.parse(text);
      if (parsed.type === 'registered' || (parsed.type === 'response' && parsed.id === 'bridge_reg')) {
        console.log('[Bridge] TV registered! Requesting pointer socket...');
        tvWs.send(JSON.stringify({
          id: 'bridge_get_pointer',
          type: 'request',
          uri: 'ssap://com.webos.service.networkinput/getPointerInputSocket'
        }));
      }

      if (parsed.id === 'bridge_get_pointer' && parsed.payload && parsed.payload.socketPath) {
        initPointerSocket(parsed.payload.socketPath);
      }

      if (parsed.payload?.volumeStatus?.muteStatus !== undefined) {
        lastMuteStatus = Boolean(parsed.payload.volumeStatus.muteStatus);
      }
      if (parsed.payload?.muteStatus !== undefined) {
        lastMuteStatus = Boolean(parsed.payload.muteStatus);
      }
    } catch {
      // Ignore
    }

    // Forward to connected phone clients (omit internal bridge messages)
    if (!text.includes('"bridge_')) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(text);
        }
      });
    }
  });

  tvWs.on('close', () => {
    console.log('[Bridge] TV connection closed. Auto-reconnecting in 2s...');
    isTvOpen = false;
    tvWs = null;
    setTimeout(() => {
      getOrCreateTvConnection();
    }, 2000);
  });

  tvWs.on('error', (e) => {
    console.log('[Bridge] TV socket error:', e.message);
    isTvOpen = false;
  });
}

// Keep-alive heartbeat every 10 seconds to keep TV and pointer sockets permanently open
setInterval(() => {
  if (pointerWs && pointerWs.readyState === WebSocket.OPEN) {
    try {
      pointerWs.ping();
    } catch {}
  }
  if (tvWs && isTvOpen && tvWs.readyState === WebSocket.OPEN) {
    try {
      tvWs.send(JSON.stringify({
        id: 'bridge_heartbeat',
        type: 'request',
        uri: 'ssap://audio/getVolume'
      }));
    } catch {}
  }
}, 10000);

// Warm up connection
getOrCreateTvConnection();

wss.on('connection', (clientWs, req) => {
  console.log('[Bridge] Phone connected to bridge!');

  if (req && req.url) {
    try {
      const u = new URL(req.url, 'http://localhost');
      const target = u.searchParams.get('target');
      if (target && target !== activeTvTarget) {
        console.log(`[Bridge] Switching target TV from ${activeTvTarget} to ${target}...`);
        activeTvTarget = target;
        TV_URL = `wss://${target}/`;
        if (tvWs) {
          try {
            tvWs.close();
          } catch {}
          tvWs = null;
          isTvOpen = false;
        }
        if (pointerWs) {
          try {
            pointerWs.close();
          } catch {}
          pointerWs = null;
          isPointerOpen = false;
        }
      }
    } catch {}
  }

  getOrCreateTvConnection();

  // If already authenticated with TV, immediately let phone know so control session starts instantly
  if (isTvOpen && tvWs && tvWs.readyState === WebSocket.OPEN) {
    try {
      clientWs.send(JSON.stringify({
        type: 'registered',
        id: 'control_session',
        payload: {
          'client-key': currentClientKey || DEFAULT_CLIENT_KEY,
        },
      }));
    } catch {}
  }

  clientWs.on('message', (message) => {
    const text = message.toString();
    try {
      const data = JSON.parse(text);

      // Dedicated D-Pad button packet
      if (data.type === 'button' && data.name) {
        const btnCommand = `type:button\nname:${data.name}\n\n`;
        console.log(`[Bridge] Button -> TV Pointer: ${data.name}`);
        if (pointerWs && isPointerOpen && pointerWs.readyState === WebSocket.OPEN) {
          pointerWs.send(btnCommand);
          return;
        } else if (data.name === 'MUTE') {
          lastMuteStatus = !lastMuteStatus;
          console.log(`[Bridge] Pointer not open, fallback SSAP setMute: ${lastMuteStatus}`);
          if (tvWs && isTvOpen) {
            tvWs.send(JSON.stringify({
              id: 'bridge_mute_fallback',
              type: 'request',
              uri: 'ssap://audio/setMute',
              payload: { mute: lastMuteStatus }
            }));
          }
          return;
        } else {
          // If pointer socket is still connecting, request it and fallback
          if (tvWs && isTvOpen) {
            tvWs.send(JSON.stringify({
              id: 'req_fallback_pointer',
              type: 'request',
              uri: 'ssap://com.webos.service.networkinput/getPointerInputSocket'
            }));
          }
        }
      }
    } catch {
      // Not JSON
    }

    // Forward standard SSAP message
    if (isTvOpen && tvWs && tvWs.readyState === WebSocket.OPEN) {
      tvWs.send(text);
    } else {
      pendingMessages.push(text);
      getOrCreateTvConnection();
    }
  });

  clientWs.on('close', () => {
    console.log('[Bridge] Phone disconnected from bridge');
  });

  clientWs.on('error', (e) => console.log('[Bridge] Client error:', e.message));
});
