/**
 * Dev Bridge Utilities
 * When running inside Expo Go (__DEV__), Android enforces strict CA validation on
 * WebSockets, blocking direct wss:// connections to local Smart TVs with self-signed certs.
 * This helper dynamically detects the dev bridge running on the development workstation.
 */

import { DiscoveredTV } from '../types/device';

let cachedDevBridgeHost: string | null = null;

export function setDiscoveredDevBridgeHost(host: string): void {
  if (host && host.trim()) {
    cachedDevBridgeHost = host.trim();
  }
}

export function getDevBridgeHost(): string | null {
  // 1. Check if manually or dynamically cached
  if (cachedDevBridgeHost) {
    return cachedDevBridgeHost;
  }

  // 2. Check bundled environment variable
  const envHost = process.env.EXPO_PUBLIC_DEV_BRIDGE_HOST;
  if (envHost && envHost.trim()) {
    cachedDevBridgeHost = envHost.trim();
    return cachedDevBridgeHost;
  }

  // 3. Extract packager IP from React Native runtime bundle URL
  try {
    const { NativeModules } = require('react-native');
    const scriptURL = NativeModules?.SourceCode?.scriptURL;

    if (scriptURL) {
      const match = String(scriptURL).match(/[a-zA-Z0-9]+:\/\/([^:\/]+)/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        cachedDevBridgeHost = match[1];
        return cachedDevBridgeHost;
      }
    }
  } catch {}

  return null;
}

export function getDevBridgeWebSocketUrl(tv?: DiscoveredTV | null): string | null {
  if (!__DEV__) {
    return null;
  }

  const host = getDevBridgeHost();
  if (!host) {
    return null;
  }

  const targetParam = tv?.host
    ? `?target=${tv.host}:${tv.remotePort || tv.pairingPort || 3001}`
    : '';

  return `ws://${host}:3002/${targetParam}`;
}
