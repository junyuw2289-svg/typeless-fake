import { globalShortcut, BrowserWindow } from 'electron';
import { IPC_CHANNELS, DEFAULT_HOTKEY } from '../shared/constants';

const DEBOUNCE_MS = 400;

export class ShortcutManager {
  private isRecording = false;
  private overlayWindow: BrowserWindow | null = null;
  private hotkey: string;
  private onToggle: (recording: boolean) => void;
  private lastToggleTime = 0;

  constructor(hotkey: string = DEFAULT_HOTKEY, onToggle: (recording: boolean) => void) {
    this.hotkey = hotkey;
    this.onToggle = onToggle;
  }

  setOverlayWindow(window: BrowserWindow): void {
    this.overlayWindow = window;
  }

  register(): boolean {
    const success = globalShortcut.register(this.hotkey, () => {
      const now = Date.now();
      if (now - this.lastToggleTime < DEBOUNCE_MS) {
        console.log(`[Shortcut] Debounced (${now - this.lastToggleTime}ms since last toggle)`);
        return;
      }
      this.lastToggleTime = now;

      this.isRecording = !this.isRecording;

      if (this.isRecording) {
        this.overlayWindow?.webContents.send(IPC_CHANNELS.RECORDING_START);
      } else {
        this.overlayWindow?.webContents.send(IPC_CHANNELS.RECORDING_STOP);
      }

      this.onToggle(this.isRecording);
    });

    if (!success) {
      console.error(`Failed to register global shortcut: ${this.hotkey}`);
    }
    return success;
  }

  unregister(): void {
    globalShortcut.unregister(this.hotkey);
  }

  resetState(): void {
    this.isRecording = false;
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }
}
