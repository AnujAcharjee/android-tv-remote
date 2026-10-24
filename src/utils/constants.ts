/**
 * Constants and Configuration Values
 */

import { StreamingAppInfo } from '../types/remote';

export const PROTOCOL_CONSTANTS = {
  DEFAULT_PAIRING_PORT: 6467,
  DEFAULT_REMOTE_PORT: 6466,
  MDNS_SERVICE_TYPE_V2: '_androidtvremote2._tcp',
  MDNS_SERVICE_TYPE_V1: '_androidtvremote._tcp',
  PING_INTERVAL_MS: 5000,
  CONNECTION_TIMEOUT_MS: 8000,
  CLIENT_NAME: 'TV Remote Android',
};

export const STORAGE_KEYS = {
  CERTIFICATE: '@tv_remote_client_cert_v1',
  PAIRED_DEVICES: '@tv_remote_paired_devices_v1',
  ACTIVE_DEVICE_ID: '@tv_remote_active_device_id_v1',
  SETTINGS: '@tv_remote_user_settings_v1',
};

export const STREAMING_APPS: Record<string, StreamingAppInfo> = {
  netflix: {
    id: 'netflix',
    name: 'Netflix',
    packageName: 'com.netflix.ninja',
    deepLink: 'netflix://',
    iconName: 'Tv',
    accentColor: '#E50914',
    textColor: '#FFFFFF',
  },
  hotstar: {
    id: 'hotstar',
    name: 'JioHotstar',
    packageName: 'in.startv.hotstar',
    deepLink: 'https://www.hotstar.com',
    iconName: 'Film',
    accentColor: '#123D8A',
    textColor: '#FFFFFF',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    packageName: 'com.google.android.youtube.tv',
    deepLink: 'vnd.youtube://',
    iconName: 'PlaySquare',
    accentColor: '#FF0000',
    textColor: '#FFFFFF',
  },
};

export const THEME = {
  colors: {
    background: '#0D0E12',
    surface: '#181A20',
    surfaceElevated: '#22252E',
    surfaceBorder: '#2C303B',
    primary: '#4F80FF',
    primaryDark: '#2B5FE0',
    textPrimary: '#FFFFFF',
    textSecondary: '#8E94A5',
    textMuted: '#585D6C',
    accentGreen: '#10B981',
    accentRed: '#EF4444',
    accentOrange: '#F59E0B',
    accentBlue: '#3B82F6',
  },
  borderRadius: {
    sm: 8,
    md: 14,
    lg: 20,
    full: 9999,
  },
};
