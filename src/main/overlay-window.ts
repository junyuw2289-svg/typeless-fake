import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { OVERLAY_WIDTH, OVERLAY_HEIGHT } from '../shared/constants';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

export function createOverlayWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  const overlay = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: Math.round(screenWidth / 2 - OVERLAY_WIDTH / 2),
    y: 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 🔧 初始状态忽略鼠标事件（后续根据状态动态切换）
  overlay.setIgnoreMouseEvents(true);
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.setAlwaysOnTop(true, 'floating');

  // Load the same renderer but the overlay component will handle routing
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    overlay.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    overlay.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  return overlay;
}
