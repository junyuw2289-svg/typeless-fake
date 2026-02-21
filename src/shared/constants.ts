export const IPC_CHANNELS = {
  // Recording control
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_AUDIO_DATA: 'recording:audio-data',
  RECORDING_CANCEL: 'recording:cancel',         // main → renderer: cancel recording
  RECORDING_CANCELLED: 'recording:cancelled',   // renderer → main: recording was cancelled

  // Transcription
  TRANSCRIPTION_START: 'transcription:start',
  TRANSCRIPTION_RESULT: 'transcription:result',
  TRANSCRIPTION_ERROR: 'transcription:error',

  // Status
  STATUS_UPDATE: 'status:update',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_UPDATED: 'settings:updated',

  // Auth (renderer → main, invoke)
  AUTH_SIGN_UP: 'auth:sign-up',
  AUTH_SIGN_IN: 'auth:sign-in',
  AUTH_SIGN_IN_GOOGLE: 'auth:sign-in-google',
  AUTH_SIGN_OUT: 'auth:sign-out',
  AUTH_GET_SESSION: 'auth:get-session',

  // Auth (main → renderer, push)
  AUTH_STATE_CHANGED: 'auth:state-changed',

  // History (renderer → main, invoke)
  HISTORY_LIST: 'history:list',
  HISTORY_DELETE: 'history:delete',
  HISTORY_GET_DIR: 'history:get-dir',
  HISTORY_SET_DIR: 'history:set-dir',

  // Stats (renderer → main, invoke)
  STATS_GET: 'stats:get',

  // History updated (main → renderer, push)
  HISTORY_UPDATED: 'history:updated',

  // Profile (renderer → main, invoke)
  PROFILE_GET: 'profile:get',
  PROFILE_UPDATE: 'profile:update',

  // Dictionary (renderer → main, invoke)
  DICTIONARY_LIST: 'dictionary:list',
  DICTIONARY_ADD: 'dictionary:add',
  DICTIONARY_DELETE: 'dictionary:delete',
} as const;

export const DEFAULT_HOTKEY = '`';

export const OVERLAY_WIDTH = 220;
export const OVERLAY_HEIGHT = 64;
