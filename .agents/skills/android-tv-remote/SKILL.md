---
name: android-tv-remote
description: >-
  Provides runbooks, protocol specifications, testing workflows, and build procedures
  for the Universal TV Remote Control React Native application (Android TV, Google TV,
  and LG webOS Smart TVs). Use this skill when implementing, testing, debugging, or building
  the TV remote app, pairing protocol, or streaming shortcuts.
---

# Universal TV Remote Skill Runbook

This skill provides step-by-step procedures for developing, debugging, verifying, and building the Universal TV Remote app (Android TV / Google TV and LG webOS).

---

## 1. Protocol Architecture & Workflow

### A. Discovery (`discoveryService.ts`)
The discovery service automatically probes and identifies the TV model on the local Wi-Fi:
1. **LG webOS Smart TV**:
   - Probe AirPlay / DIAL port `7000` (responds with 200 or 403).
   - Fetch exact TV model name from UPnP descriptor port `1045` (`<friendlyName>`).
   - Assigns `protocolType: 'webos'`, pairing & remote port: `3001`.
2. **Android TV & Google TV**:
   - Probe Google Cast / DIAL port `8008` (`/setup/eureka_info`).
   - Listen for mDNS service `_androidtvremote2._tcp.local.` (fallback `_androidtvremote._tcp.local.`).
   - Assigns `protocolType: 'androidtv'`, pairing port: `6467`, remote port: `6466`.
3. **Subnet Sweep & Deduplication**:
   - Parallel subnet scan across local IP ranges (`192.168.29.x`, `192.168.1.x`, `192.168.0.x`).
   - Deduplicates devices strictly by host IP (`host`) so the UI remains clean and calm.

---

### B. Pairing Protocol (`pairingService.ts`)
The pairing service supports dynamic universal authentication without hardcoded keys:

#### 1. Universal Smart TV Pairing (`pairingType: 'PROMPT'`)
- Initiated with `pairingType: 'PROMPT'` and `forcePairing: false`.
- TV displays an on-screen dialog: *"Antigravity TV Remote is requesting access. Allow?"*
- App transitions to `'awaitingPrompt'`, displaying a glowing TV indicator asking the user to press "Allow" or "Yes" on their TV remote.
- When confirmed, the TV returns `type: 'registered'` containing a unique `client-key`.
- The `client-key` is securely persisted in hardware-backed `SecureStorageService` and `StorageService`.

#### 2. PIN Pairing Fallback (`pairingType: 'PIN'`)
- Triggered if the TV explicitly responds with `pairingType === 'PIN'` (or for Android TV v2 Protobuf handshake).
- TV displays a 6-character code on screen.
- App displays a 6-box PIN entry input (`awaitingCode`).
- For Android TV: Computes SHA-256 digest of client certificate bytes + server certificate bytes + alpha/numeric PIN, and submits `PairingSecret`.
- For LG webOS: Submits the entered PIN in a follow-up registration packet.

---

### C. Remote Command Protocol (`remoteService.ts`)

#### 1. LG webOS Remote Protocol (WSS 3001)
- Connects via WebSocket TLS to `wss://<TV_IP>:3001/` (or via dev bridge port 3002 during Expo Go development).
- Uses registered `client-key` to request Pointer Input Socket: `request: 'getPointerInputSocket'`.
- Button Injection: Sends pointer button packets (`name: 'ENTER' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'BACK' | 'HOME' | 'MENU' | 'VOLUMEUP' | 'VOLUMEDOWN' | 'MUTE' | 'POWER'`).

#### 2. Android TV Remote Protocol v2 (TLS TCP 6466)
- Connects via TLS to TV on port `6466` using paired client certificate.
- Maintains keepalive heartbeat (`RemotePing` / `RemotePong`) every 5 seconds.
- Frames length-delimited Protobuf messages (`remotemessage.proto`) with `RemoteKeyInject`.

#### 3. Streaming Shortcuts
- **YouTube**:
  - Android TV: `vnd.youtube://` or `https://www.youtube.com` (`com.google.android.youtube.tv`)
  - webOS: `youtube.leanback.v4`
- **Netflix**:
  - Android TV: `netflix://` (`com.netflix.ninja`)
  - webOS: `netflix`
- **JioHotstar**:
  - Android TV: `https://www.hotstar.com` (`in.startv.hotstar`)
  - webOS: `hotstar`

---

## 2. Testing & Verification

### A. Verifying TV Ports on Local Wi-Fi
Using PowerShell:
```powershell
# For LG webOS TV (WebSockets & Probes)
Test-NetConnection -ComputerName <TV_IP> -Port 3001   # Secure WebSocket
Test-NetConnection -ComputerName <TV_IP> -Port 7000   # AirPlay / DIAL probe
Test-NetConnection -ComputerName <TV_IP> -Port 1045   # UPnP Model Name

# For Android TV / Google TV
Test-NetConnection -ComputerName <TV_IP> -Port 6467   # Pairing Port
Test-NetConnection -ComputerName <TV_IP> -Port 6466   # Remote Control Port
Test-NetConnection -ComputerName <TV_IP> -Port 8008   # Cast / DIAL probe
```

### B. Testing Dev Bridge (Expo Go Testing Aid)
```bash
# Check if bridge daemon is running on port 3002
curl http://localhost:3002/
```

---

## 3. Building Standalone APK (100% Autonomous Operation)

Standalone builds operate completely autonomously on the mobile phone using `plugins/withSelfSignedTls.js` without any computer or bridge.

### A. EAS Cloud Build (Recommended)
```bash
npx eas-cli build -p android --profile preview
```

### B. Local Gradle Build
```bash
npx expo prebuild --platform android
cd android
./gradlew assembleDebug
```
Output APK location:
`android/app/build/outputs/apk/debug/app-debug.apk`
