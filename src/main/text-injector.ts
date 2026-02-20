import { clipboard } from 'electron';
import { execFile } from 'node:child_process';

export class TextInjector {
  async inject(text: string): Promise<void> {
    clipboard.writeText(text);
    console.log('[TextInjector] Text written to clipboard:', text);

    try {
      await this.simulatePaste();
      console.log('[TextInjector] Paste command executed');
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
                console.log('[TextInjector] Paste command successful');
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
