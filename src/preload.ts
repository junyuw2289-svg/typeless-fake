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

  // Auth
  authSignUp: (email: string, password: string, displayName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_SIGN_UP, { email, password, displayName }),
  authSignIn: (email: string, password: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_SIGN_IN, { email, password }),
  authSignInWithGoogle: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_SIGN_IN_GOOGLE),
  authSignOut: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_SIGN_OUT),
  authGetSession: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_SESSION),
  onAuthStateChanged: (callback: (user: any) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { user: any }) => callback(data.user);
    ipcRenderer.on(IPC_CHANNELS.AUTH_STATE_CHANGED, handler);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.AUTH_STATE_CHANGED, handler); };
  },

  // Dictionary
  dictionaryList: () =>
    ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_LIST),
  dictionaryAdd: (word: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_ADD, { word }),
  dictionaryDelete: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_DELETE, { id }),

  // History
  historyList: (page: number, pageSize: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_LIST, { page, pageSize }),
  historyDelete: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_DELETE, { id }),
  historyGetDir: () =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET_DIR),
  historySetDir: (dir: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.HISTORY_SET_DIR, { dir }),

  // Stats
  statsGet: () =>
    ipcRenderer.invoke(IPC_CHANNELS.STATS_GET),
  onHistoryUpdated: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.HISTORY_UPDATED, handler);
    return () => { ipcRenderer.removeListener(IPC_CHANNELS.HISTORY_UPDATED, handler); };
  },

  // Profile
  profileGet: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PROFILE_GET),
  profileUpdate: (data: { displayName: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROFILE_UPDATE, data),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
