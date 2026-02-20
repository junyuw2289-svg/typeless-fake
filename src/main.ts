import { app, BrowserWindow, globalShortcut, systemPreferences, dialog } from 'electron';
import started from 'electron-squirrel-startup';
import { ShortcutManager } from './main/shortcut-manager';
import { TranscriptionService } from './main/transcription-service';
import { TextInjector } from './main/text-injector';
import { TrayManager } from './main/tray-manager';
import { IPCHandler } from './main/ipc-handlers';
import { createOverlayWindow, repositionOverlayTocursor } from './main/overlay-window';
import { getConfig } from './main/config-store';
import { IPC_CHANNELS } from './shared/constants';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

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

  // Create shortcut manager
  shortcutManager = new ShortcutManager(config.hotkey, (recording) => {
    if (recording) {
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

  // Create tray
  trayManager = new TrayManager(
    () => app.quit(),
    (apiKey) => transcriptionService.updateApiKey(apiKey),
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

  console.log('Typeless initialized. Press F2 to start/stop recording.');
}

app.on('ready', () => {
  initApp();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  trayManager?.destroy();
});

// Keep app running when all windows are closed (it's a tray app)
app.on('window-all-closed', () => {
  // Don't quit - this is a tray app
});
