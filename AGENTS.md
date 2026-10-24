# AGENTS.md - Android TV Remote Workspace Guide

## 1. Project Overview & Objective
This project is a lightweight, responsive, native-capable Android mobile application built with **React Native (Expo)** and **TypeScript** that turns an Android phone into a high-performance remote control for an Android TV or Google TV connected to the same local Wi-Fi network.

### Key Goals
- **True Network Remote**: Communicates directly over local Wi-Fi with Android TV / Google TV using the **Android TV Remote v2 Protocol** (mDNS discovery + TLS TCP sockets + Protobuf message payloads).
- **No Remote Backend**: Fully peer-to-peer / local network; no intermediate cloud servers or external dependencies.
- **Production-Ready UX**: Minimalist dark theme, responsive D-Pad, haptic feedback, instantaneous key response, dedicated streaming shortcuts (Netflix, JioHotstar, YouTube), and phone-to-TV text input.
- **Expo Prebuild / Development Build**: Compatible with Expo Config Plugins and native modules (such as `react-native-tcp-socket`, `@react-native-community/netinfo`, `react-native-zeroconf` or native discovery, and cryptographic primitives).

---

## 2. Android TV Remote Protocol v2 Specifications

### A. Ports & Discovery
- **Discovery Protocol**: mDNS (DNS-SD)
- **Service Type**: `_androidtvremote2._tcp.local.` (or fallback `_androidtvremote._tcp.local.`)
- **Pairing Port**: `6467` (TCP over TLS)
- **Control / Remote Port**: `6466` (TCP over TLS)

### B. Security & Cryptography
- Both pairing (6467) and remote command sessions (6466) require **TLS 1.2 / 1.3** with mutual or self-signed client certificates.
- **Client Certificate**: Generate a 2048-bit RSA key pair and a self-signed X.509 certificate with:
  - Common Name (CN): e.g., `atvremote-client`
  - Validity: 10+ years
- **Pairing Secret / PIN Algorithm**:
  1. The TV displays a 6-character code (hex/alphanumeric PIN) on screen.
  2. The client calculates the SHA-256 digest of client certificate bytes + server certificate bytes + alpha/numeric PIN.
  3. Client sends `PairingSecret` containing the calculated hash proof.
  4. On verification, the TV returns `PairingSuccess`.
  5. The client certificate is securely persisted on device storage (e.g., `expo-secure-store` or `@react-native-async-storage/async-storage`) to allow instant reconnection without re-pairing.

### C. Protocol Messages (Protobuf)
Messages are framed over the TLS socket using length-delimited Protobuf packets (varint length prefix + serialized proto buffer):
- **Pairing Protobuf (`pairing.proto`)**:
  - `PairingRequest`
  - `PairingResponse`
  - `PairingConfiguration`
  - `PairingSecret`
- **Remote Protobuf (`remotemessage.proto`)**:
  - `RemoteKeyInject`: Android KeyCode + Direction (`SHORT`, `START_LONG`, `END_LONG`).
  - `RemoteAppLaunch`: Intent URL / package name (e.g. `https://www.youtube.com`, `netflix://`, `https://www.hotstar.com`).
  - `RemoteImeBatch`: Text editing and IME string synchronization for TV search fields and login inputs.
  - `RemotePing` / `RemotePong`: Keepalive heartbeat every ~5 seconds.

### D. Keycodes Reference (Android KeyEvent)
| Function | KeyCode |
| :--- | :--- |
| DPAD UP | 19 (`KEYCODE_DPAD_UP`) |
| DPAD DOWN | 20 (`KEYCODE_DPAD_DOWN`) |
| DPAD LEFT | 21 (`KEYCODE_DPAD_LEFT`) |
| DPAD RIGHT | 22 (`KEYCODE_DPAD_RIGHT`) |
| DPAD CENTER / OK | 23 (`KEYCODE_DPAD_CENTER`) |
| BACK | 4 (`KEYCODE_BACK`) |
| HOME | 3 (`KEYCODE_HOME`) |
| MENU | 82 (`KEYCODE_MENU`) |
| VOLUME UP | 24 (`KEYCODE_VOLUME_UP`) |
| VOLUME DOWN | 25 (`KEYCODE_VOLUME_DOWN`) |
| MUTE | 164 (`KEYCODE_VOLUME_MUTE`) |
| PLAY / PAUSE | 85 (`KEYCODE_MEDIA_PLAY_PAUSE`) |
| REWIND | 89 (`KEYCODE_MEDIA_REWIND`) |
| FAST FORWARD | 90 (`KEYCODE_MEDIA_FAST_FORWARD`) |
| POWER | 26 (`KEYCODE_POWER`) |

### E. App Shortcuts
- **YouTube**:
  - Package: `com.google.android.youtube.tv`
  - Deep Link: `vnd.youtube://` or `https://www.youtube.com`
- **Netflix**:
  - Package: `com.netflix.ninja`
  - Deep Link: `netflix://`
- **JioHotstar (Disney+ Hotstar)**:
  - Package: `in.startv.hotstar`
  - Deep Link: `https://www.hotstar.com`

---

## 3. Project Architecture

```
src/
├── components/           # Reusable UI widgets
│   ├── DirectionPad.tsx      # Circular responsive D-pad (Up/Down/Left/Right/OK)
│   ├── RemoteButton.tsx      # Haptic-enabled, pressed-state rounded button
│   ├── ShortcutButton.tsx    # App launcher button (Netflix, Hotstar, YouTube)
│   ├── ConnectionStatus.tsx  # Header connection badge and TV details
│   ├── PairingModal.tsx      # PIN entry dialog when TV requests pairing
│   └── TextInputModal.tsx    # Keyboard input dialog sending strings to TV
├── screens/              # Top-level screen views
│   ├── RemoteScreen.tsx      # Primary remote control panel
│   ├── ConnectionScreen.tsx  # Discovery list, manual IP connection, pairing status
│   └── SettingsScreen.tsx    # Network details, saved TVs, troubleshooting guide
├── services/             # Core protocol & networking logic
│   ├── discoveryService.ts   # mDNS discovery + local network scanner
│   ├── pairingService.ts     # TLS handshake, PIN exchange, certificate derivation
│   ├── remoteService.ts      # Active TLS session, key injection, app launching, IME
│   ├── connectionManager.ts  # State machine, auto-reconnect, ping/pong heartbeat
│   ├── appLauncher.ts        # Intent / URL launcher for streaming services
│   └── textInputService.ts   # IME batch text sender
├── hooks/                # React custom hooks
│   ├── useTVConnection.ts    # Reactive connection state, connect, disconnect, pair
│   └── useHaptics.ts         # Subtle physical feedback on button press
├── types/                # TypeScript interfaces & types
│   ├── remote.ts             # KeyCodes, Command types, Direction
│   ├── device.ts             # DiscoveredTV, TVConnectionStatus, StoredDevice
│   └── proto.ts              # Protobuf message typings
└── utils/                # Utilities & constants
    ├── constants.ts          # Keycodes, default ports, app deep links
    ├── crypto.ts             # RSA cert generation and SHA256 pairing proof
    └── storage.ts            # Saved certificates and previously connected TVs
```

---

## 4. Development & Build Workflows

### Prerequisites
- Node.js >= 18 (Current environment: Node v22)
- Android SDK (`C:\Users\anuja\AppData\Local\Android\Sdk`)
- Expo CLI (`npx expo`)

### Running Locally
1. Start Metro bundler:
   ```bash
   npx expo start
   ```
2. Build Android development client:
   ```bash
   npx expo run:android
   ```
3. Generate standalone APK (Local Gradle build):
   ```bash
   cd android && ./gradlew assembleDebug
   # Or using Expo prebuild:
   npx expo run:android --variant debug
   ```

---

## 5. Coding Standards & Guidelines
1. **Type Safety**: Strictly TypeScript. No `any` types unless interacting with dynamic protobuf wire formats.
2. **Clean Separation**: UI components must never speak raw socket protocols directly; always invoke `remoteService` or `connectionManager`.
3. **Resilience**:
   - Handle TV power off / sleep gracefully.
   - Clean up sockets, intervals, and ping timers immediately on disconnect.
   - Provide clear user-facing error messages if discovery or pairing fails.
4. **Permissions**: Android permissions for `ACCESS_FINE_LOCATION`, `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, `INTERNET` must be declared in `app.json`.
