import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/constants';
import type { ElectronAPI } from './shared/types';
import type { AppStatus } from './shared/types';

const electronAPI: ElectronAPI = {
  onRecordingStart: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.RECORDING_START, () => callback());
  },
  onRecordingStop: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.RECORDING_STOP, () => callback());
  },
  onRecordingCancel: (callback: () => void) => {
    ipcRenderer.on(IPC_CHANNELS.RECORDING_CANCEL, () => callback());
  },
  onStatusUpdate: (callback: (status: AppStatus) => void) => {
    ipcRenderer.on(IPC_CHANNELS.STATUS_UPDATE, (_event, status) => callback(status));
  },
  onTranscriptionResult: (callback: (text: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPTION_RESULT, (_event, text) => callback(text));
  },
  onTranscriptionError: (callback: (error: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPTION_ERROR, (_event, error) => callback(error));
  },
  sendAudioData: (buffer: ArrayBuffer) => {
    ipcRenderer.send(IPC_CHANNELS.RECORDING_AUDIO_DATA, buffer);
  },
  cancelRecording: () => {
    ipcRenderer.send(IPC_CHANNELS.RECORDING_CANCELLED);
  },
  getSettings: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET);
  },
  setSettings: (settings) => {
    ipcRenderer.send(IPC_CHANNELS.SETTINGS_SET, settings);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
