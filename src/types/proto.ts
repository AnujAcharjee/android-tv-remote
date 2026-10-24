/**
 * Protobuf Wire Types & Message Interfaces for Android TV Remote v2
 */

import { Direction, KeyCode } from './remote';

export enum RoleType {
  ROLE_TYPE_UNKNOWN = 0,
  ROLE_TYPE_INPUT = 1,
}

export enum EncodingType {
  ENCODING_TYPE_UNKNOWN = 0,
  ENCODING_TYPE_ALPHANUMERIC = 1,
  ENCODING_TYPE_NUMERIC = 2,
  ENCODING_TYPE_HEXADECIMAL = 3,
  ENCODING_TYPE_QR_CODE = 4,
}

export enum PairingResult {
  UNKNOWN = 0,
  SUCCESS = 200,
  ERROR = 400,
  BAD_CONFIGURATION = 401,
  BAD_SECRET = 402,
}

// Remote Control Message Structures
export interface ProtoRemoteKeyInject {
  keyCode: KeyCode;
  direction: Direction;
}

export interface ProtoRemoteAppLaunch {
  appUrl: string; // e.g. "netflix://", "https://www.youtube.com", "https://www.hotstar.com"
}

export interface ProtoRemoteImeBatch {
  counter: number;
  label?: string;
  fieldId?: number;
  text?: string;
  selectionStart?: number;
  selectionEnd?: number;
}

export interface ProtoRemotePing {
  val1: number;
}

export interface ProtoRemoteMessage {
  remoteKeyInject?: ProtoRemoteKeyInject;
  remoteAppLaunch?: ProtoRemoteAppLaunch;
  remoteImeBatch?: ProtoRemoteImeBatch;
  remotePingRequest?: ProtoRemotePing;
  remotePingResponse?: ProtoRemotePing;
}
