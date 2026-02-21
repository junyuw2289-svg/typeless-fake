export type AppStatus = 'idle' | 'recording' | 'transcribing' | 'done' | 'error';

export interface AppSettings {
  hotkey: string;
  apiKey: string;
  language: string;
  enablePolish: boolean; // Enable AI polish after transcription
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthSignUpRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthSignInRequest {
  email: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export interface SessionResult {
  isAuthenticated: boolean;
  user?: AuthUser;
}

// History types
export interface TranscriptionRecord {
  id: string;
  original_text: string;
  optimized_text: string | null;
  app_context: string | null;
  language: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface HistoryListRequest {
  page: number;
  pageSize: number;
}

export interface HistoryListResult {
  data: TranscriptionRecord[];
  total: number;
}

export interface HistoryDeleteResult {
  success: boolean;
  error?: string;
}

// Profile types
export interface UserProfile {
  displayName: string;
  email: string;
  trialEndsAt: string;
}

export interface ProfileUpdateRequest {
  displayName: string;
}

export interface ProfileUpdateResult {
  success: boolean;
  error?: string;
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

  // Auth
  authSignUp: (email: string, password: string, displayName: string) => Promise<AuthResult>;
  authSignIn: (email: string, password: string) => Promise<AuthResult>;
  authSignInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  authSignOut: () => Promise<{ success: boolean; error?: string }>;
  authGetSession: () => Promise<SessionResult>;
  onAuthStateChanged: (callback: (user: AuthUser | null) => void) => Disposer;

  // History
  historyList: (page: number, pageSize: number) => Promise<HistoryListResult>;
  historyDelete: (id: string) => Promise<HistoryDeleteResult>;

  // Profile
  profileGet: () => Promise<UserProfile | null>;
  profileUpdate: (data: ProfileUpdateRequest) => Promise<ProfileUpdateResult>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
