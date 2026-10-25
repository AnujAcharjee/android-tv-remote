# TV Remote - Android TV & Google TV Mobile Controller

A lightweight, responsive, and production-ready Android mobile application built with **React Native (Expo SDK 58)** and **TypeScript** that turns an Android smartphone into a high-performance network remote for any **Android TV** or **Google TV** connected to the same Wi-Fi network.

---

## 🌟 Key Features

- **No Remote Backend Required**: Communicates directly peer-to-peer over your local home Wi-Fi network without third-party cloud servers or external tracking.
- **Android TV Remote v2 Protocol**:
  - Secure TLS-encrypted mutual authentication.
  - Automatic X.509 certificate and 2048-bit RSA key derivation.
  - Fast 6-character PIN pairing directly on screen.
  - Length-delimited Protobuf command streaming.
- **Minimalist, Ergonomic Dark UI**:
  - Inspired by Google TV's remote aesthetic.
  - Responsive circular Directional Pad (Up, Down, Left, Right, OK).
  - Rapid tap response + repeated command scrolling on hold.
  - Tactile haptic feedback on button interactions (`expo-haptics`).
- **Dedicated Streaming App Shortcuts**:
  - **Netflix** (`netflix://` / `com.netflix.ninja`)
  - **JioHotstar** (`https://www.hotstar.com` / `in.startv.hotstar`)
  - **YouTube** (`vnd.youtube://` / `com.google.android.youtube.tv`)
- **Integrated Phone-to-TV Search & Text Input (IME)**:
  - Clean inline search and text bar with a Send button right inside the remote control panel.
  - Supports typing directly or using your phone's native keyboard voice typing (Google Voice Typing / Siri Dictation) to send queries across any TV application.
- **Network Resilience & Diagnostics**:
  - Automatic discovery via mDNS (`_androidtvremote2._tcp`).
  - Manual IP connect fallback for Wi-Fi routers with client isolation.
  - Persistent paired TV storage via AsyncStorage for instant reconnection.

---

## 📺 Supported Devices

Compatible with TVs running Android TV 9.0+ or Google TV:
- **Chromecast with Google TV** (HD & 4K)
- **Sony BRAVIA** Android & Google TVs
- **Xiaomi / Mi TV / Redmi TV**
- **TCL** Google TVs
- **OnePlus TV**
- **NVIDIA Shield TV**
- **Philips Android TV**
- **Hisense** Android TV models

---

## 🏗️ Project Architecture

```
src/
├── components/           # Reusable UI widgets
│   ├── DirectionPad.tsx      # Circular responsive D-pad (Up/Down/Left/Right/OK)
│   ├── RemoteButton.tsx      # Haptic-enabled, pressed-state rounded button
│   ├── ShortcutButton.tsx    # Dedicated app launchers (Netflix, Hotstar, YouTube)
│   ├── ConnectionStatus.tsx  # Top header status badge and TV info
│   ├── PairingModal.tsx      # 6-character PIN entry dialog
│   └── DevicePickerSheet.tsx # Google TV styled bottom sheet for TV switching
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

## 🔐 Required Android Permissions

Declared in `app.json`:
- `android.permission.INTERNET`: Direct TCP/TLS socket communication with the TV.
- `android.permission.ACCESS_NETWORK_STATE`: Detecting local Wi-Fi state.
- `android.permission.ACCESS_WIFI_STATE`: Determining local IP subnet.
- `android.permission.CHANGE_WIFI_MULTICAST_STATE`: Listening for mDNS discovery packets.
- `android.permission.VIBRATE`: Subtle tactile haptic button feedback.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js >= 18
- Android SDK (for native dev builds / APK)
- Expo CLI (`npx expo`)

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Metro Dev Server
```bash
npx expo start
```
Scan the QR code with **Expo Go** or an Expo Development Client on your phone.

---

## 📦 Building Standalone APK

### Method 1: Local Gradle Build (Fastest on machine)
```bash
# 1. Generate native Android project files
npx expo prebuild --platform android

# 2. Build debug APK using Gradle
cd android
./gradlew assembleDebug
```
The generated APK will be at:
`android/app/build/outputs/apk/debug/app-debug.apk`

Install directly onto your Android device:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Method 2: EAS Cloud Build (EAS project connected)
Project ID is configured in `app.json` (`311bac63-dea1-4e82-ad30-25bc3e05e860`).
```bash
# Build standalone APK via EAS
npx eas-cli@latest build --platform android --profile preview
```

---

## 🛠️ Troubleshooting & FAQs

### Q: Why doesn't my TV appear in the discovery list?
1. Ensure both your phone and TV are connected to the **same Wi-Fi network** (not guest Wi-Fi).
2. Many modern dual-band or mesh Wi-Fi routers have **AP Isolation** or **Multicast Filtering** enabled by default, which blocks mDNS.
3. **Fix**: In the app, tap the connection pill → choose **"Connect by IP Address"** → enter your TV's local IP address (found on your TV under *Settings → Network & Internet → Click connected Wi-Fi*).

### Q: The remote stops responding when the TV turns off.
When an Android TV enters deep sleep or is powered down, its Wi-Fi card shuts down. Power on the TV using the physical button or standby button once to bring the Wi-Fi card back online; the remote will auto-reconnect within seconds.

---

## 📄 License
MIT License. Free and open source for personal and commercial use.
