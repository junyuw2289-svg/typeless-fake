import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';
import { AuthService } from './auth-service';
import { HistoryService } from './history-service';
import { DictionaryService } from './dictionary-service';
import { getSupabaseClient } from './supabase-client';
import type {
  AuthSignUpRequest,
  AuthSignInRequest,
  HistoryListRequest,
  ProfileUpdateRequest,
} from '../shared/types';
import * as fs from 'fs';

const authService = new AuthService();
const historyService = new HistoryService();
const dictionaryService = new DictionaryService();

/** Remove any existing handler before registering — safe for hot-reload. */
function safeHandle(channel: string, handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

export function registerAuthIPC(getMainWindow: () => BrowserWindow | null): void {
  // --- Auth ---
  safeHandle(IPC_CHANNELS.AUTH_SIGN_UP, async (_event, req: AuthSignUpRequest) => {
    return authService.signUp(req.email, req.password, req.displayName);
  });

  safeHandle(IPC_CHANNELS.AUTH_SIGN_IN, async (_event, req: AuthSignInRequest) => {
    const result = await authService.signIn(req.email, req.password);
    if (result.success) {
      getMainWindow()?.webContents.send(IPC_CHANNELS.AUTH_STATE_CHANGED, { user: result.user });
    }
    return result;
  });

  safeHandle(IPC_CHANNELS.AUTH_SIGN_IN_GOOGLE, async () => {
    return authService.signInWithGoogle();
  });

  safeHandle(IPC_CHANNELS.AUTH_SIGN_OUT, async () => {
    const result = await authService.signOut();
    if (result.success) {
      getMainWindow()?.webContents.send(IPC_CHANNELS.AUTH_STATE_CHANGED, { user: null });
    }
    return result;
  });

  safeHandle(IPC_CHANNELS.AUTH_GET_SESSION, async () => {
    return authService.getSession();
  });

  // --- History ---
  safeHandle(IPC_CHANNELS.HISTORY_LIST, async (_event, req: HistoryListRequest) => {
    return historyService.list(req.page, req.pageSize);
  });

  safeHandle(IPC_CHANNELS.HISTORY_DELETE, async (_event, req: { id: string }) => {
    return historyService.delete(req.id);
  });

  safeHandle(IPC_CHANNELS.HISTORY_GET_DIR, async () => {
    return historyService.getHistoryDir();
  });

  safeHandle(IPC_CHANNELS.HISTORY_SET_DIR, async (_event, req: { dir: string }) => {
    try {
      if (!fs.existsSync(req.dir)) {
        fs.mkdirSync(req.dir, { recursive: true });
      }
      historyService.setHistoryDir(req.dir);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to set directory' };
    }
  });

  // --- Stats ---
  safeHandle(IPC_CHANNELS.STATS_GET, async () => {
    return historyService.getStats();
  });

  // --- Profile ---
  safeHandle(IPC_CHANNELS.PROFILE_GET, async () => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data } = await supabase
      .from('user_profiles')
      .select('display_name, email, trial_ends_at')
      .eq('id', session.user.id)
      .single();

    if (!data) return null;
    return {
      displayName: data.display_name || '',
      email: data.email,
      trialEndsAt: data.trial_ends_at,
    };
  });

  safeHandle(IPC_CHANNELS.PROFILE_UPDATE, async (_event, req: ProfileUpdateRequest) => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('user_profiles')
      .update({ display_name: req.displayName })
      .eq('id', session.user.id);

    return { success: !error, error: error?.message };
  });

  // --- Dictionary ---
  safeHandle(IPC_CHANNELS.DICTIONARY_LIST, async () => {
    return dictionaryService.list();
  });

  safeHandle(IPC_CHANNELS.DICTIONARY_ADD, async (_event, req: { word: string }) => {
    return dictionaryService.add(req.word);
  });

  safeHandle(IPC_CHANNELS.DICTIONARY_DELETE, async (_event, req: { id: string }) => {
    return { success: dictionaryService.delete(req.id) };
  });
}

export { authService, historyService, dictionaryService };
