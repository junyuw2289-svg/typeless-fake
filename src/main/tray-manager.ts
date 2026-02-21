import { Tray, Menu, nativeImage, dialog, app } from 'electron';
import type { NativeImage } from 'electron';
import path from 'node:path';
import { getConfig, setConfig } from './config-store';

export class TrayManager {
  private tray: Tray | null = null;
  private onQuit: () => void;
  private onApiKeyChanged: (key: string) => void;
  private onOpenMainWindow: () => void;

  constructor(onQuit: () => void, onApiKeyChanged: (key: string) => void, onOpenMainWindow: () => void) {
    this.onQuit = onQuit;
    this.onApiKeyChanged = onApiKeyChanged;
    this.onOpenMainWindow = onOpenMainWindow;
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
      { label: 'Press ` to start/stop recording', enabled: false },
      { type: 'separator' },
      {
        label: hasApiKey ? 'Change OpenAI API Key...' : 'Set OpenAI API Key...',
        click: () => this.promptApiKey(),
      },
      { type: 'separator' },
      { label: 'Open Typeless', click: () => this.onOpenMainWindow() },
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
    // nativeImage.createFromDataURL does NOT support SVG — use PNG files
    const assetsDir = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(app.getAppPath(), 'assets');
    const img = nativeImage.createFromPath(path.join(assetsDir, 'trayTemplate.png'));
    img.setTemplateImage(true);
    return img;
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
