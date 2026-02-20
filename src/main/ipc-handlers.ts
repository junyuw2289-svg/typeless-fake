import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';
import { TranscriptionService } from './transcription-service';
import { TextInjector } from './text-injector';
import { getConfig, setConfig } from './config-store';
import type { AppStatus } from '../shared/types';

export class IPCHandler {
  private transcriptionService: TranscriptionService;
  private textInjector: TextInjector;
  private overlayWindow: BrowserWindow | null = null;
  private onStatusChange: ((status: string) => void) | null = null;
  private onRecordingEnded: (() => void) | null = null;

  constructor(
    transcriptionService: TranscriptionService,
    textInjector: TextInjector,
  ) {
    this.transcriptionService = transcriptionService;
    this.textInjector = textInjector;
  }

  setOverlayWindow(window: BrowserWindow): void {
    this.overlayWindow = window;
  }

  setOnStatusChange(callback: (status: string) => void): void {
    this.onStatusChange = callback;
  }

  /** Called when audio data arrives, meaning recording has ended (user-initiated or auto-stopped) */
  setOnRecordingEnded(callback: () => void): void {
    this.onRecordingEnded = callback;
  }

  private sendStatus(status: AppStatus): void {
    this.overlayWindow?.webContents.send(IPC_CHANNELS.STATUS_UPDATE, status);
    this.onStatusChange?.(status);

    // Overlay interactivity for recording is managed in main.ts (shortcut callback).
    // Here we only need to disable interactivity when leaving recording state.
    if (this.overlayWindow && status !== 'recording') {
      this.overlayWindow.setIgnoreMouseEvents(true);
    }
  }

  register(): void {
    // Handle audio data from renderer (after recording stops)
    ipcMain.on(IPC_CHANNELS.RECORDING_AUDIO_DATA, async (_event, buffer: ArrayBuffer) => {
      console.log('[IPC] Received audio data, size:', buffer.byteLength, 'bytes');
      this.onRecordingEnded?.();
      this.sendStatus('transcribing');

      try {
        const config = getConfig();
        console.log('[IPC] Config loaded, API key exists:', !!config.apiKey, 'Polish enabled:', config.enablePolish);
        this.transcriptionService.updateApiKey(config.apiKey);
        console.log('[IPC] Starting transcription...');
        const text = await this.transcriptionService.transcribe(
          Buffer.from(buffer),
          config.language,
          config.enablePolish
        );
        console.log('[IPC] Transcription result:', text);

        if (text && text.trim()) {
          // Inject text into active app
          console.log('[IPC] Injecting text:', text);
          await this.textInjector.inject(text);
          console.log('[IPC] Text injection complete');

          this.overlayWindow?.webContents.send(IPC_CHANNELS.TRANSCRIPTION_RESULT, text);
          this.sendStatus('done');

          // Hide overlay after showing "Done" for 1.5s
          setTimeout(() => {
            this.overlayWindow?.hide();
            this.sendStatus('idle');
          }, 1500);
        } else {
          this.sendStatus('idle');
          this.overlayWindow?.hide();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Transcription failed';
        console.error('Transcription error:', message);
        this.overlayWindow?.webContents.send(IPC_CHANNELS.TRANSCRIPTION_ERROR, message);
        this.sendStatus('error');

        setTimeout(() => {
          this.overlayWindow?.hide();
          this.sendStatus('idle');
        }, 3000);
      }
    });

    // Handle cancel from renderer (X button clicked)
    ipcMain.on(IPC_CHANNELS.RECORDING_CANCELLED, () => {
      console.log('[IPC] Recording cancelled by user');
      this.sendStatus('idle');
      this.overlayWindow?.hide();
    });

    // Handle settings
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
      return getConfig();
    });

    ipcMain.on(IPC_CHANNELS.SETTINGS_SET, (_event, settings) => {
      setConfig(settings);
      this.overlayWindow?.webContents.send(IPC_CHANNELS.SETTINGS_UPDATED, getConfig());
    });
  }
}
