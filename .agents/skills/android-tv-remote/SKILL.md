---
name: android-tv-remote
description: >-
  Provides runbooks, protocol specifications, testing workflows, and build procedures
  for the Android TV / Google TV Remote Control React Native application. Use this skill
  when implementing, testing, debugging, or building the TV remote app, pairing protocol,
  or streaming shortcuts.
---

# Android TV Remote Skill Runbook

This skill provides step-by-step procedures for developing, debugging, verifying, and building the Android TV Remote app.

## 1. Protocol Architecture & Workflow

### A. Discovery (`discoveryService`)
1. Modern Android TV and Google TV devices broadcast their presence on the local network via mDNS (DNS-SD) service:
   - Service name: `_androidtvremote2._tcp.local.`
   - Fallback (v1): `_androidtvremote._tcp.local.`
2. The discovery service listens for Multicast DNS packets and extracts:
   - Device Name (from TXT record or mDNS instance name)
   - Host / IPv4 address
   - Port (usually 6467 for pairing, 6466 for remote commands)
3. Direct IP connection option must be supported for networks where mDNS multicast traffic is filtered by router client isolation.

### B. Pairing Protocol (`pairingService`)
1. **Certificate Generation**:
   - Generate self-signed RSA 2048-bit certificate with SHA-256 signature.
   - PEM encoded certificate and private key are generated once and saved in local storage.
2. **TLS Connection**:
   - Establish TLS connection to TV on port `6467`.
   - Reject unauthorized must be `false` (since the TV presents a self-signed server certificate).
3. **Protobuf Handshake**:
   - Step 1: Send `PairingRequest` containing client name and role (`ROLE_CONTROLLER = 1`).
   - Step 2: Receive `PairingResponse`.
   - Step 3: Send `PairingConfiguration` specifying encoding: `ENCODING_TYPE_HEXADECIMAL` or `ENCODING_TYPE_ALPHANUMERIC`.
   - Step 4: The TV displays a 6-character PIN code on screen.
   - Step 5: User enters PIN in the app.
   - Step 6: Compute secret SHA-256 hash using the client certificate, server certificate, and entered PIN.
   - Step 7: Send `PairingSecret`.
   - Step 8: Receive `PairingSuccess`. The device is now permanently paired!

### C. Remote Command Protocol (`remoteService`)
1. Connect via TLS to TV on port `6466` using the paired client certificate.
2. Maintain ping/pong heartbeat (every 5 seconds) to prevent TV from closing the socket.
3. Send key events formatted as length-delimited `RemoteMessage` containing `RemoteKeyInject`.
   - Keycodes:
     - D-Pad: `19` (Up), `20` (Down), `21` (Left), `22` (Right), `23` (Center/OK)
     - Navigation: `4` (Back), `3` (Home), `82` (Menu)
     - Volume: `24` (Vol Up), `25` (Vol Down), `164` (Mute)
     - Media: `85` (Play/Pause), `89` (Rewind), `90` (Fast Forward)
     - Power: `26` (Power)
4. Application Shortcuts:
   - Send `RemoteAppLaunch` with deep link URL:
     - YouTube: `https://www.youtube.com`
     - Netflix: `netflix://`
     - JioHotstar: `https://www.hotstar.com`
5. Text Input (IME):
   - Send `RemoteImeBatch` to inject characters or full strings into the active search / text input field.

---

## 2. Testing & Verification

### Local TV Verification via ADB (for development verification)
When an Android TV / Google TV is on the network and ADB debugging is enabled:
```bash
# Connect to TV via ADB to verify connectivity
adb connect <TV_IP_ADDRESS>:5555

# Send test key event (e.g. DPAD_CENTER = 23)
adb shell input keyevent 23

# Launch YouTube directly to verify package name
adb shell am start -a android.intent.action.VIEW -d "https://www.youtube.com"

# Launch Netflix directly
adb shell am start -a android.intent.action.VIEW -d "netflix://"
```

### Local Network Verification
To verify the TV's remote ports are open:
```powershell
# Test Pairing Port (6467)
Test-NetConnection -ComputerName <TV_IP_ADDRESS> -Port 6467

# Test Remote Control Port (6466)
Test-NetConnection -ComputerName <TV_IP_ADDRESS> -Port 6466
```

---

## 3. Building Android APK

### A. Prebuild
```bash
npx expo prebuild --platform android
```

### B. Generate Debug APK
```bash
cd android
./gradlew assembleDebug
```
The output APK will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

### C. Install on Phone
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```
