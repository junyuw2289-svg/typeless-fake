import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';
import { TranscriptionService } from './transcription-service';
import { TextInjector } from './text-injector';
import { getConfig, setConfig } from './config-store';
import type { AppStatus } from '../shared/types';
import { historyService, dictionaryService } from './auth-ipc';

export class IPCHandler {
  private transcriptionService: TranscriptionService;
  private textInjector: TextInjector;
  private overlayWindow: BrowserWindow | null = null;
  private getMainWindow: (() => BrowserWindow | null) | null = null;
  private onStatusChange: ((status: string) => void) | null = null;
  private onRecordingEnded: (() => void) | null = null;
  private isTranscribing = false;
  private recordingStartedAt: number | null = null;

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

  setGetMainWindow(getter: () => BrowserWindow | null): void {
    this.getMainWindow = getter;
  }

  setOnStatusChange(callback: (status: string) => void): void {
    this.onStatusChange = callback;
  }

  /** Called when audio data arrives, meaning recording has ended (user-initiated or auto-stopped) */
  setOnRecordingEnded(callback: () => void): void {
    this.onRecordingEnded = callback;
  }

  markRecordingStarted(): void {
    this.recordingStartedAt = Date.now();
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
    ipcMain.on(IPC_CHANNELS.RECORDING_AUDIO_DATA, async (_event, buffer: ArrayBuffer, stopInitiatedAt: number) => {
      const ipcReceivedAt = Date.now();
      console.log(`[Timing][IPC] Audio data received: +${ipcReceivedAt - stopInitiatedAt}ms from stop (IPC transit + flush)`);
      console.log('[IPC] Received audio data, size:', buffer.byteLength, 'bytes');

      if (this.isTranscribing) {
        console.log('[IPC] Already transcribing — ignoring duplicate audio data');
        return;
      }
      this.isTranscribing = true;

      this.onRecordingEnded?.();
      this.sendStatus('transcribing');

      try {
        const config = getConfig();
        console.log('[IPC] Config loaded, API key exists:', !!config.apiKey, 'Polish enabled:', config.enablePolish);
        this.transcriptionService.updateApiKey(config.apiKey);

        const dictionaryWords = dictionaryService.getAllWords();
        console.log(`[IPC] Dictionary words for prompt: ${dictionaryWords.length}`);

        console.log(`[Timing][IPC] Starting transcription: +${Date.now() - stopInitiatedAt}ms from stop`);
        const text = await this.transcriptionService.transcribe(
          Buffer.from(buffer),
          config.language,
          config.enablePolish,
          stopInitiatedAt,
          dictionaryWords
        );
        console.log(`[Timing][IPC] Transcription complete: +${Date.now() - stopInitiatedAt}ms from stop`);
        console.log('[IPC] Transcription result:', text);

        if (text && text.trim()) {
          const injectStart = Date.now();
          console.log(`[Timing][IPC] Injecting text: +${injectStart - stopInitiatedAt}ms from stop`);
          await this.textInjector.inject(text);
          console.log(`[Timing][IPC] Text injection done: +${Date.now() - stopInitiatedAt}ms from stop (inject took ${Date.now() - injectStart}ms)`);

          const durationSeconds = this.recordingStartedAt
            ? parseFloat(((stopInitiatedAt - this.recordingStartedAt) / 1000).toFixed(2))
            : null;
          this.recordingStartedAt = null;

          // Save to history (fire-and-forget, don't block main flow)
          historyService.save({
            original_text: text,
            optimized_text: config.enablePolish ? text : null,
            app_context: null,
            duration_seconds: durationSeconds,
          }).then(() => {
            // Notify main window so Dashboard/History can refresh
            this.getMainWindow?.()?.webContents.send(IPC_CHANNELS.HISTORY_UPDATED);
          }).catch((err) => console.error('[History] Failed to save:', err));

          this.overlayWindow?.webContents.send(IPC_CHANNELS.TRANSCRIPTION_RESULT, text);
          this.sendStatus('done');
          console.log(`[Timing][IPC] ===== Total pipeline: ${Date.now() - stopInitiatedAt}ms =====`);

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
        console.log(`[Timing][IPC] Transcription FAILED: +${Date.now() - stopInitiatedAt}ms from stop`);
        this.overlayWindow?.webContents.send(IPC_CHANNELS.TRANSCRIPTION_ERROR, message);
        this.sendStatus('error');

        setTimeout(() => {
          this.overlayWindow?.hide();
          this.sendStatus('idle');
        }, 3000);
      } finally {
        this.isTranscribing = false;
      }
    });

    // Handle cancel from renderer (X button clicked)
    ipcMain.on(IPC_CHANNELS.RECORDING_CANCELLED, () => {
      console.log('[IPC] Recording cancelled by user');
      this.recordingStartedAt = null;
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
