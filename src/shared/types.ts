export type AppStatus = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';

export interface AppSettings {
  hotkey: string;
  apiKey: string;
  language: string;
  enablePolish: boolean; // Enable AI polish after transcription
}

export interface ElectronAPI {
  onRecordingStart: (callback: () => void) => void;
  onRecordingStop: (callback: () => void) => void;
  onStatusUpdate: (callback: (status: AppStatus) => void) => void;
  onTranscriptionResult: (callback: (text: string) => void) => void;
  onTranscriptionError: (callback: (error: string) => void) => void;
  sendAudioData: (buffer: ArrayBuffer) => void;
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
