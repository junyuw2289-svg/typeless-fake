import { create } from 'zustand';
import type { AppStatus, AppSettings } from '../../shared/types';

interface AppState {
  status: AppStatus;
  lastTranscription: string;
  error: string | null;
  settings: AppSettings;

  setStatus: (status: AppStatus) => void;
  setLastTranscription: (text: string) => void;
  setError: (error: string | null) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  status: 'idle',
  lastTranscription: '',
  error: null,
  settings: {
    hotkey: '`',
    apiKey: '',
    language: '',
    enablePolish: true,
    polishProvider: 'openai',
    grokApiKey: '',
    groqApiKey: '',
    polishModel: 'llama-3.3-70b-versatile',
  },

  setStatus: (status) => set({ status, error: status === 'error' ? undefined : null }),
  setLastTranscription: (text) => set({ lastTranscription: text }),
  setError: (error) => set({ error, status: 'error' }),
  updateSettings: (settings) =>
    set((state) => ({
      settings: { ...state.settings, ...settings },
    })),
}));
