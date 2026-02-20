import { clipboard } from 'electron';
import { exec } from 'node:child_process';

export class TextInjector {
  async inject(text: string): Promise<void> {
    // Write transcription to clipboard (and keep it there!)
    clipboard.writeText(text);
    console.log('[TextInjector] Text written to clipboard:', text);

    // Wait a bit to ensure clipboard is written
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate Cmd+V paste via osascript (macOS)
    try {
      await this.simulatePaste();
      console.log('[TextInjector] Paste command executed');
    } catch (error) {
      console.error('[TextInjector] Paste failed:', error);
      // Even if paste fails, text is still in clipboard for manual paste
    }

    // DON'T restore clipboard - keep the transcribed text there
    // so user can manually paste if auto-paste didn't work
  }

  private simulatePaste(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (process.platform === 'darwin') {
        // Add a small delay before pasting to ensure focus is correct
        setTimeout(() => {
          // Simple and reliable: just send Cmd+V
          exec(
            'osascript -e \'tell application "System Events" to keystroke "v" using command down\'',
            (error) => {
              if (error) {
                console.error('[TextInjector] osascript error:', error.message);
                reject(error);
              } else {
                console.log('[TextInjector] Paste command successful');
                resolve();
              }
            }
          );
        }, 300);
      } else {
        // Windows fallback (future)
        resolve();
      }
    });
  }
}
