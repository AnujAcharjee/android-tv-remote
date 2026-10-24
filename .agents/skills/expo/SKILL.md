---
name: expo
description: >-
  Provides comprehensive knowledge, procedures, and best practices for developing,
  configuring, prebuilding, and building React Native applications using Expo SDK 52+
  and EAS (Expo Application Services). Use when working with Expo commands, config plugins,
  native modules, EAS builds, or Metro bundler.
---

# Expo & EAS Development Skill

This skill provides essential guidelines and workflows for modern Expo and React Native projects.

## 1. Core Principles & Modern Commands

### Always Use Local Expo CLI (`npx expo`)
- **Start Dev Server**: `npx expo start` (or `npx expo start --clear` if Metro cache is corrupted)
- **Install Compatible Modules**: `npx expo install <package-name>` (ensures version matches the current Expo SDK)
- **Run Android Native Dev Build**: `npx expo run:android`
- **Prebuild Native Directories (`android/` & `ios/`)**: `npx expo prebuild` or `npx expo prebuild --clean`
- **Check Project Doctor / Diagnostics**: `npx expo-doctor@latest`

### Deprecated Patterns to AVOID
- Never run global `expo-cli` commands (e.g. `expo init`, `expo start` without `npx`).
- Never run legacy `expo eject`. Use `npx expo prebuild` instead.
- Never manually edit `android/` or `ios/` folders if they can be configured cleanly via `app.json` config plugins.

---

## 2. EAS (Expo Application Services) Workflows

### Project Initialization & Linking
```bash
npx eas-cli@latest init --id <EAS_PROJECT_ID>
```
This updates `app.json` with:
```json
"extra": {
  "eas": {
    "projectId": "<EAS_PROJECT_ID>"
  }
}
```

### EAS Build Commands
- **Build APK for local testing (Android)**:
  `eas.json` configuration:
  ```json
  {
    "build": {
      "preview": {
        "android": {
          "buildType": "apk"
        }
      },
      "production": {}
    }
  }
  ```
- **Trigger Cloud Build**:
  ```bash
  npx eas-cli@latest build --platform android --profile preview
  ```

---

## 3. Native Modules & Expo Go vs Dev Client

### Expo Go vs Development Build (`expo-dev-client`)
- **Expo Go**: Ideal for rapid prototyping and pure JavaScript/TypeScript logic. Does not support custom native C++/Java modules or raw native network socket drivers that are not precompiled into the Expo Go binary.
- **Expo Development Build**: Required when using native modules (like `react-native-tcp-socket`, custom background services, or raw sockets).
  - Setup: `npx expo install expo-dev-client`
  - Build & run: `npx expo run:android`

---

## 4. Android Configuration & Permissions (`app.json`)
Declare required permissions in `expo.android.permissions`:
```json
{
  "expo": {
    "name": "TV Remote",
    "slug": "tv-remote",
    "android": {
      "package": "com.tvremote.app",
      "permissions": [
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.ACCESS_WIFI_STATE",
        "android.permission.CHANGE_WIFI_MULTICAST_STATE",
        "android.permission.VIBRATE"
      ]
    }
  }
}
```
