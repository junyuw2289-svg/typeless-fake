import { Tray, Menu, nativeImage, dialog } from 'electron';
import type { NativeImage } from 'electron';
import { getConfig, setConfig } from './config-store';

export class TrayManager {
  private tray: Tray | null = null;
  private onQuit: () => void;
  private onApiKeyChanged: (key: string) => void;

  constructor(onQuit: () => void, onApiKeyChanged: (key: string) => void) {
    this.onQuit = onQuit;
    this.onApiKeyChanged = onApiKeyChanged;
  }

  create(): void {
    this.tray = new Tray(this.createTrayIcon());
    this.tray.setToolTip('Typeless - Voice to Text');
    this.updateMenu('idle');
  }

  updateMenu(status: string): void {
    if (!this.tray) return;

    const config = getConfig();
    const hasApiKey = !!config.apiKey;
    const statusText = status === 'recording' ? 'Recording...'
      : status === 'transcribing' ? 'Transcribing...'
      : hasApiKey ? 'Ready' : 'API Key Required';

    const contextMenu = Menu.buildFromTemplate([
      { label: `Typeless - ${statusText}`, enabled: false },
      { type: 'separator' },
      { label: 'Press F2 to start/stop recording', enabled: false },
      { type: 'separator' },
      {
        label: hasApiKey ? 'Change OpenAI API Key...' : 'Set OpenAI API Key...',
        click: () => this.promptApiKey(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.onQuit(),
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  private async promptApiKey(): Promise<void> {
    // Use a simple prompt dialog for API key input
    const result = await dialog.showMessageBox({
      type: 'question',
      title: 'OpenAI API Key',
      message: 'Enter your OpenAI API Key',
      detail: 'Your API key is stored locally and used only for Whisper transcription.\n\nPaste your key and click OK.',
      buttons: ['Cancel', 'OK'],
      defaultId: 1,
    });

    if (result.response === 1) {
      // Since Electron dialog doesn't support text input natively,
      // we'll read from clipboard as a workaround
      const { clipboard } = await import('electron');
      const clipboardText = clipboard.readText().trim();

      if (clipboardText && clipboardText.startsWith('sk-')) {
        setConfig({ apiKey: clipboardText });
        this.onApiKeyChanged(clipboardText);
        this.updateMenu('idle');

        dialog.showMessageBox({
          type: 'info',
          title: 'API Key Set',
          message: 'OpenAI API Key has been saved successfully.',
        });
      } else {
        dialog.showMessageBox({
          type: 'warning',
          title: 'Invalid API Key',
          message: 'Please copy a valid OpenAI API key (starting with "sk-") to your clipboard, then try again.',
        });
      }
    }
  }

  private createTrayIcon(): NativeImage {
    const size = 16;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16">
      <rect x="5.5" y="2" width="5" height="7" rx="2.5" fill="black"/>
      <path d="M3.5 8 Q3.5 12.5 8 12.5 Q12.5 12.5 12.5 8" stroke="black" fill="none" stroke-width="1.2"/>
      <line x1="8" y1="12.5" x2="8" y2="14.5" stroke="black" stroke-width="1.2"/>
      <line x1="5.5" y1="14.5" x2="10.5" y2="14.5" stroke="black" stroke-width="1.2"/>
    </svg>`;

    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    const img = nativeImage.createFromDataURL(dataUrl);
    img.setTemplateImage(true);
    return img;
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
