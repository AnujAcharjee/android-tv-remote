/**
 * Android KeyCodes and Remote Control Command Types
 * Reference: Android KeyEvent constants & Android TV Remote v2 protocol
 */

export enum KeyCode {
  // Navigation & Directional Pad
  DPAD_UP = 19,
  DPAD_DOWN = 20,
  DPAD_LEFT = 21,
  DPAD_RIGHT = 22,
  DPAD_CENTER = 23, // OK / Select

  // System Navigation
  BACK = 4,
  HOME = 3,
  MENU = 82,

  // Audio / Volume
  VOLUME_UP = 24,
  VOLUME_DOWN = 25,
  VOLUME_MUTE = 164,

  // Media Controls
  MEDIA_PLAY_PAUSE = 85,
  MEDIA_REWIND = 89,
  MEDIA_FAST_FORWARD = 90,
  MEDIA_PLAY = 126,
  MEDIA_PAUSE = 127,
  MEDIA_STOP = 86,
  MEDIA_NEXT = 87,
  MEDIA_PREVIOUS = 88,

  // Power
  POWER = 26,
  SLEEP = 223,
  WAKEUP = 224,

  // Channel
  CHANNEL_UP = 166,
  CHANNEL_DOWN = 167,

  // Input
  TV_INPUT = 178,
}

export enum Direction {
  UNKNOWN_DIRECTION = 0,
  SHORT = 1,      // Standard click / tap
  START_LONG = 2, // Key down / press and hold
  END_LONG = 3,   // Key up after long press
}

export type StreamingAppId = 'netflix' | 'hotstar' | 'youtube';

export interface StreamingAppInfo {
  id: StreamingAppId;
  name: string;
  packageName: string;
  deepLink: string;
  iconName: string;
  accentColor: string;
  textColor: string;
}
