import { app, BrowserWindow, globalShortcut, systemPreferences, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { ShortcutManager } from './main/shortcut-manager';
import { TranscriptionService } from './main/transcription-service';
import { TextInjector } from './main/text-injector';
import { TrayManager } from './main/tray-manager';
import { IPCHandler } from './main/ipc-handlers';
import { createOverlayWindow, repositionOverlayTocursor } from './main/overlay-window';
import { toggleMainWindow, getMainWindow } from './main/main-window';
import { getConfig } from './main/config-store';
import { IPC_CHANNELS } from './shared/constants';
import { registerAuthIPC, authService } from './main/auth-ipc';
import { getSupabaseClient } from './main/supabase-client';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Register custom protocol for OAuth deep link callback (packaged mode only)
if (app.isPackaged) {
  app.setAsDefaultProtocolClient('typeless');
} else if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient('typeless', process.execPath, [path.resolve(process.argv[1])]);
}

// Handle deep link on macOS (open-url event) — used in packaged mode
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAuthDeepLink(url);
});

async function handleAuthDeepLink(url: string): Promise<void> {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.host === 'auth' && parsedUrl.pathname === '/callback') {
      console.log('[Auth] Deep link callback received');
      const result = await authService.handleOAuthCallback(url);
      showAuthResult(result);
    }
  } catch (err) {
    console.error('Failed to handle auth deep link:', err);
  }
}

function showAuthResult(result: { success: boolean; user?: any }): void {
  const mw = getMainWindow();
  if (result.success && mw) {
    mw.webContents.send(IPC_CHANNELS.AUTH_STATE_CHANGED, { user: result.user });
    mw.show();
    mw.focus();
  }
}

// Dev mode: wire up localhost HTTP callback notification
authService.onOAuthComplete = (result) => {
  console.log('[Auth] OAuth complete via dev server:', result.success);
  showAuthResult(result);
};

let overlayWindow: BrowserWindow | null = null;
let shortcutManager: ShortcutManager | null = null;
let trayManager: TrayManager | null = null;

const transcriptionService = new TranscriptionService();
const textInjector = new TextInjector();
const ipcHandler = new IPCHandler(transcriptionService, textInjector);

function initApp(): void {
  const config = getConfig();

  console.log('=== Typeless Initializing ===');
  console.log('API Key configured:', !!config.apiKey);
  console.log('Hotkey:', config.hotkey);
  console.log('Language:', config.language);

  // Initialize transcription service with stored API key
  if (config.apiKey) {
    transcriptionService.updateApiKey(config.apiKey);
    console.log('Transcription service initialized with API key');
  } else {
    console.log('WARNING: No API key configured!');
  }

  // Create overlay window
  overlayWindow = createOverlayWindow();
  ipcHandler.setOverlayWindow(overlayWindow);
  ipcHandler.setGetMainWindow(getMainWindow);
  ipcHandler.setOnStatusChange((status) => {
    trayManager?.updateMenu(status);
    if (status === 'idle') {
      shortcutManager?.resetState();
    }
    if (status !== 'recording') {
      try { globalShortcut.unregister('Escape'); } catch { /* already unregistered */ }
    }
  });
  ipcHandler.setOnRecordingEnded(() => {
    shortcutManager?.resetState();
    trayManager?.updateMenu('transcribing');
  });
  ipcHandler.register();
  registerAuthIPC(getMainWindow);

  // Start Supabase auth auto-refresh (required for non-browser environments)
  const supabase = getSupabaseClient();
  supabase.auth.startAutoRefresh();

  // Listen for auth state changes and push to renderer
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
      const mw = getMainWindow();
      if (mw) {
        const user = session ? {
          id: session.user.id,
          email: session.user.email!,
          displayName: session.user.user_metadata?.full_name || session.user.user_metadata?.display_name || session.user.email!.split('@')[0],
        } : null;
        setTimeout(() => {
          mw.webContents.send(IPC_CHANNELS.AUTH_STATE_CHANGED, { user });
        }, 0);
      }
    }
  });

  // Create shortcut manager
  shortcutManager = new ShortcutManager(config.hotkey, (recording) => {
    if (recording) {
      ipcHandler.markRecordingStarted();
      if (overlayWindow) {
        repositionOverlayTocursor(overlayWindow);
        overlayWindow.showInactive();
        overlayWindow.setIgnoreMouseEvents(false);
      }

      // Register a temporary global ESC shortcut to cancel recording
      // (global shortcut works even when overlay doesn't have focus)
      globalShortcut.register('Escape', () => {
        console.log('[Main] ESC pressed — cancelling recording');
        overlayWindow?.webContents.send(IPC_CHANNELS.RECORDING_CANCEL);
        try { globalShortcut.unregister('Escape'); } catch { /* noop */ }
      });

      trayManager?.updateMenu('recording');
    } else {
      try { globalShortcut.unregister('Escape'); } catch { /* noop */ }
      trayManager?.updateMenu('transcribing');
    }
  });
  shortcutManager.setOverlayWindow(overlayWindow);
  shortcutManager.register();

  // Create and show main window on startup
  toggleMainWindow();

  // Create tray
  trayManager = new TrayManager(
    () => app.quit(),
    (apiKey) => transcriptionService.updateApiKey(apiKey),
    () => toggleMainWindow(),
  );
  trayManager.create();

  // Check Accessibility permission (required for auto-paste via Cmd+V simulation)
  if (process.platform === 'darwin') {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false);
    if (!trusted) {
      console.log('WARNING: Accessibility permission not granted. Auto-paste will not work.');
      dialog.showMessageBox({
        type: 'warning',
        title: 'Accessibility Permission Required',
        message: 'Typeless needs Accessibility access to auto-paste transcribed text.',
        detail: 'Go to System Settings → Privacy & Security → Accessibility, then add and enable the app running this process (Cursor / Terminal).\n\nWithout this, transcribed text will be copied to clipboard but not auto-pasted.',
        buttons: ['Open System Settings', 'Later'],
        defaultId: 0,
      }).then((result) => {
        if (result.response === 0) {
          systemPreferences.isTrustedAccessibilityClient(true);
        }
      });
    } else {
      console.log('Accessibility permission: granted');
    }
  }

  console.log('Typeless initialized. Press ` to start/stop recording.');
}

app.on('ready', () => {
  initApp();
});

app.on('before-quit', () => {
  getSupabaseClient().auth.stopAutoRefresh();
  const mw = getMainWindow();
  if (mw) {
    (mw as any)._forceClose = true;
    mw.close();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  trayManager?.destroy();
});

// Keep app running when all windows are closed (it's a tray app)
app.on('window-all-closed', () => {
  // Don't quit - this is a tray app
});
