# AGENTS.md - Smart TV Remote Workspace Guide

## 1. Project Overview & Objective
This project is a lightweight, responsive, native-capable Android mobile application built with **React Native (Expo)** and **TypeScript** that turns an Android phone into a high-performance universal remote control for **Android TV / Google TV** and **LG webOS Smart TV** connected to the same local Wi-Fi network.

### Key Goals
- **Universal Multi-Platform Remote**: Communicates directly over local Wi-Fi with Android TV, Google TV, and LG webOS Smart TVs using peer-to-peer protocols (mDNS / HTTP endpoint probes + native TLS TCP sockets / WebSockets).
- **100% Standalone Autonomous Operation**: The application MUST run completely autonomously on the phone without requiring ANY PC bridge, relay daemon, or external computer. The PC bridge (`bridge.js`) is strictly a local developer testing aid for Expo Go TLS CA bypass during development. All production / standalone APK builds communicate directly with the TV using `plugins/withSelfSignedTls.js`.
- **Dynamic Universal Authentication (No Hardcoded Keys)**: Dynamic client key derivation and authentication for every TV on first connection. Never pre-seed or hardcode static `client-key` tokens. Supports both on-screen **PROMPT** ("Allow" on TV remote) and **PIN** code exchange.
- **Deduplicated, Clean & Calm UI**: Minimalist dark theme, responsive D-Pad, haptic feedback, instantaneous key response, dedicated streaming shortcuts (Netflix, JioHotstar, YouTube), mathematically centered connection pill with Settings gear icon, and calm, deduplicated device list.
- **Expo Prebuild / Development Build**: Compatible with Expo Config Plugins and native modules (`react-native-tcp-socket`, `@react-native-community/netinfo`, cryptographic primitives, and self-signed TLS bypass).

---

## 2. Multi-Platform TV Protocol Specifications

### A. Discovery & Identification (`discoveryService.ts`)
The discovery service automatically identifies the TV model and protocol type:
1. **LG webOS Smart TV**:
   - Probes AirPlay / DIAL port `7000`.
   - Fetches exact TV model name from UPnP descriptor port `1045` (`<friendlyName>`).
   - Pairing & Remote Port: `3001` (WebSocket over TLS: `wss://<TV_IP>:3001`).
2. **Android TV / Google TV**:
   - Probes Google Cast / DIAL port `8008` (`/setup/eureka_info`).
   - mDNS service discovery: `_androidtvremote2._tcp.local.` (fallback: `_androidtvremote._tcp.local.`).
   - Pairing Port: `6467` (TCP over TLS).
   - Remote / Control Port: `6466` (TCP over TLS).
3. **Subnet Sweep & Deduplication**:
   - Real-time parallel subnet sweep across local network subnets (`192.168.29.x`, `192.168.1.x`, `192.168.0.x`).
   - Strict host/IP deduplication: Each physical TV is indexed by its IP address to prevent duplicate cards in the UI.

---

### B. Security, Pairing & Authentication Flow

#### 1. Universal Smart TV Pairing (`pairingType: 'PROMPT'`)
- Default for LG webOS and modern Smart TVs.
- App sends registration request with `pairingType: 'PROMPT'` and `forcePairing: false`.
- TV displays an on-screen dialog: *"Antigravity TV Remote is requesting access. Allow?"*
- App transitions to `'awaitingPrompt'` state (showing glowing TV icon and instruction to press "Allow" or "Yes" on TV remote).
- Once the user allows access, the TV returns a `type: 'registered'` message containing a unique `client-key`.
- The app securely persists the `client-key` in `SecureStorageService` and `StorageService` for instant automatic reconnection.

#### 2. PIN Pairing Fallback (`pairingType: 'PIN'`)
- Triggered only if the TV explicitly requests a PIN (or for Android TV v2 Protobuf handshake).
- TV displays a 6-character code (hex or alphanumeric).
- App transitions to `'awaitingCode'` and displays the 6-box PIN input field.
- For Android TV: Client calculates SHA-256 digest of client certificate bytes + server certificate bytes + alpha/numeric PIN, and sends `PairingSecret`.
- For LG webOS: Client submits the entered PIN in a follow-up registration packet.

---

### C. Remote Control & Command Dispatch (`remoteService.ts`)

#### 1. LG webOS Remote Protocol (WSS 3001)
- Communicates over WebSocket TLS connection to `wss://<TV_IP>:3001/` (or via transparent dev bridge on port 3002 during Expo Go development).
- Once registered with `client-key`, opens the specialized Pointer Input Socket via `request: 'getPointerInputSocket'`.
- Button Injection: Sends pointer button packets (`type: 'button', name: 'ENTER' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'BACK' | 'HOME' | 'MENU' | 'VOLUMEUP' | 'VOLUMEDOWN' | 'MUTE' | 'POWER'`).
- System Services: Calls SSAP endpoints for specialized functions (e.g. `ssap://tv/powerOff`, `ssap://system.launcher/open`).

#### 2. Android TV Remote Protocol v2 (TLS TCP 6466)
- Communicates over TLS socket to port `6466` using paired client certificate.
- Frames length-delimited Protobuf messages (`remotemessage.proto`).
- Sends `RemoteKeyInject` with Android `KeyCode` and `Direction` (`SHORT`, `START_LONG`, `END_LONG`).
- Heartbeat: Maintains `RemotePing` / `RemotePong` keepalive every 5 seconds.

---

### D. Keycodes Reference (Android KeyEvent & webOS Mapping)
| Function | Android KeyCode | webOS Button Name |
| :--- | :--- | :--- |
| DPAD UP | 19 (`KEYCODE_DPAD_UP`) | `UP` |
| DPAD DOWN | 20 (`KEYCODE_DPAD_DOWN`) | `DOWN` |
| DPAD LEFT | 21 (`KEYCODE_DPAD_LEFT`) | `LEFT` |
| DPAD RIGHT | 22 (`KEYCODE_DPAD_RIGHT`) | `RIGHT` |
| DPAD CENTER / OK | 23 (`KEYCODE_DPAD_CENTER`) | `ENTER` |
| BACK | 4 (`KEYCODE_BACK`) | `BACK` |
| HOME | 3 (`KEYCODE_HOME`) | `HOME` |
| MENU | 82 (`KEYCODE_MENU`) | `MENU` |
| VOLUME UP | 24 (`KEYCODE_VOLUME_UP`) | `VOLUMEUP` |
| VOLUME DOWN | 25 (`KEYCODE_VOLUME_DOWN`) | `VOLUMEDOWN` |
| MUTE | 164 (`KEYCODE_VOLUME_MUTE`) | `MUTE` |
| PLAY / PAUSE | 85 (`KEYCODE_MEDIA_PLAY_PAUSE`) | `PLAY` / `PAUSE` |
| REWIND | 89 (`KEYCODE_MEDIA_REWIND`) | `REWIND` |
| FAST FORWARD | 90 (`KEYCODE_MEDIA_FAST_FORWARD`) | `FASTFORWARD` |
| POWER | 26 (`KEYCODE_POWER`) | `POWER` |

---

### E. Streaming App Deep Links
- **YouTube**:
  - Android TV Package: `com.google.android.youtube.tv` (Deep link: `vnd.youtube://` or `https://www.youtube.com`)
  - webOS App ID: `youtube.leanback.v4`
- **Netflix**:
  - Android TV Package: `com.netflix.ninja` (Deep link: `netflix://`)
  - webOS App ID: `netflix`
- **JioHotstar (Disney+ Hotstar)**:
  - Android TV Package: `in.startv.hotstar` (Deep link: `https://www.hotstar.com`)
  - webOS App ID: `hotstar`

---

## 3. Project Architecture

```
src/
├── components/           # Reusable UI widgets
│   ├── DirectionPad.tsx      # Circular responsive D-pad (Up/Down/Left/Right/OK)
│   ├── RemoteButton.tsx      # Haptic-enabled, pressed-state rounded button
│   ├── ShortcutButton.tsx    # App launcher button (Netflix, Hotstar, YouTube)
│   ├── ConnectionStatus.tsx  # Header connection badge + Settings gear icon
│   ├── PairingModal.tsx      # PIN entry dialog when TV requests pairing
│   └── DevicePickerSheet.tsx # Calm bottom sheet for switching active TVs
├── screens/              # Top-level screen views
│   ├── RemoteScreen.tsx      # Primary remote control panel
│   ├── ConnectionScreen.tsx  # Discovery list, manual IP connection, pairing status
│   ├── PairingScreen.tsx     # Full-screen TV approval (Prompt) & PIN entry
│   └── SettingsScreen.tsx    # Network details, saved TVs, troubleshooting guide
├── services/             # Core protocol & networking logic
│   ├── discoveryService.ts   # Network scanner, AirPlay/Cast/UPnP probes, host deduplication
│   ├── pairingService.ts     # Multi-protocol handshake, Prompt approval, PIN exchange
│   ├── remoteService.ts      # Active session, WebSockets/TLS sockets, key injection
│   ├── connectionManager.ts  # State machine, auto-reconnect, ping/pong heartbeat
│   ├── appLauncher.ts        # Intent / URL launcher for streaming services
│   └── textInputService.ts   # IME batch text sender
├── hooks/                # React custom hooks
│   ├── useTVConnection.ts    # Reactive connection state, connect, disconnect, pair
│   └── useHaptics.ts         # Subtle physical feedback on button press
├── types/                # TypeScript interfaces & types
│   ├── remote.ts             # KeyCodes, Command types, Direction
│   ├── device.ts             # DiscoveredTV, TVConnectionStatus, TVConnectionState
│   └── proto.ts              # Protobuf message typings
└── utils/                # Utilities & constants
    ├── constants.ts          # Keycodes, default ports, app deep links
    ├── crypto.ts             # RSA cert generation and SHA256 pairing proof
    ├── devBridge.ts          # Transparent dev bridge host resolver
    ├── secureStorage.ts      # Hardware-backed SecureStore for pairing tokens
    └── storage.ts            # Saved certificates and previously connected TVs
```

---

## 4. Development & Build Workflows

### Running Locally
1. Start Metro bundler:
   ```bash
   npm run start:wifi
   # Or: npx expo start --lan
   ```
2. Start Dev Bridge (for Expo Go local testing only):
   ```bash
   node bridge.js
   ```

### Building Standalone APK (Autonomous Operation)
To build a standalone APK that communicates directly with TVs without any PC:
```bash
npx eas-cli build -p android --profile preview
```
Or local Gradle prebuild:
```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
```

---

## 5. Coding Standards & Guidelines
1. **Type Safety**: Strictly TypeScript. No `any` types unless interacting with dynamic wire formats.
2. **Clean Separation**: UI components must never speak raw socket protocols directly; always invoke `remoteService` or `connectionManager`.
3. **No Static Keys**: Universal remotes must dynamically authenticate with any TV. Never hardcode client keys.
4. **Resilience & Cleanup**: Handle TV sleep/wake gracefully. Clean up sockets, intervals, and ping timers immediately on disconnect.
5. **No Visual Clutter**: Keep device lists clean and calm. Use subtle badges, deduplicate by host, and avoid crowded buttons.
