export type AppStatus = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';

export interface AppSettings {
  hotkey: string;
  apiKey: string;
  language: string;
  enablePolish: boolean; // Enable AI polish after transcription
}

type Disposer = () => void;

export interface ElectronAPI {
  onRecordingStart: (callback: () => void) => Disposer;
  onRecordingStop: (callback: () => void) => Disposer;
  onRecordingCancel: (callback: () => void) => Disposer;
  onStatusUpdate: (callback: (status: AppStatus) => void) => Disposer;
  onTranscriptionResult: (callback: (text: string) => void) => Disposer;
  onTranscriptionError: (callback: (error: string) => void) => Disposer;
  sendAudioData: (buffer: ArrayBuffer, stopInitiatedAt: number) => void;
  cancelRecording: () => void;
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
