export const IPC_CHANNELS = {
  // Recording control
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_AUDIO_DATA: 'recording:audio-data',

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
} as const;

export const DEFAULT_HOTKEY = 'F2';

export const OVERLAY_WIDTH = 220;
export const OVERLAY_HEIGHT = 64;
