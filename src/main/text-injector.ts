import { clipboard } from 'electron';
import { execFile } from 'node:child_process';

export class TextInjector {
  async inject(text: string): Promise<void> {
    clipboard.writeText(text);

    try {
      await this.simulatePaste();
    } catch (error) {
      console.error('[TextInjector] Paste failed:', error);
    }
  }

  private simulatePaste(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (process.platform === 'darwin') {
        setTimeout(() => {
          execFile(
            'osascript',
            ['-e', 'tell application "System Events" to keystroke "v" using command down'],
            (error) => {
              if (error) {
                console.error('[TextInjector] osascript error:', error.message);
                reject(error);
              } else {
                resolve();
              }
            }
          );
        }, 50);
      } else {
        resolve();
      }
    });
  }
}
