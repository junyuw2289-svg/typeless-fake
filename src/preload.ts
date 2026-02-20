import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/constants';
import type { ElectronAPI } from './shared/types';
import type { AppStatus } from './shared/types';

const electronAPI: ElectronAPI = {
  onRecordingStart: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.RECORDING_START, handler);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.RECORDING_START, handler); };
  },
  onRecordingStop: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.RECORDING_STOP, handler);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.RECORDING_STOP, handler); };
  },
  onRecordingCancel: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.RECORDING_CANCEL, handler);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.RECORDING_CANCEL, handler); };
  },
  onStatusUpdate: (callback: (status: AppStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: AppStatus) => callback(status);
    ipcRenderer.on(IPC_CHANNELS.STATUS_UPDATE, handler);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.STATUS_UPDATE, handler); };
  },
  onTranscriptionResult: (callback: (text: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, text: string) => callback(text);
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPTION_RESULT, handler);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPTION_RESULT, handler); };
  },
  onTranscriptionError: (callback: (error: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => callback(error);
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPTION_ERROR, handler);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.TRANSCRIPTION_ERROR, handler); };
  },
  sendAudioData: (buffer: ArrayBuffer, stopInitiatedAt: number) => {
    ipcRenderer.send(IPC_CHANNELS.RECORDING_AUDIO_DATA, buffer, stopInitiatedAt);
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
