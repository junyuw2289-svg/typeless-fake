# Research: Adding a Multi-Page Main Window to Typeless

## Table of Contents

1. [Current Architecture Summary](#1-current-architecture-summary)
2. [Window Architecture: 1 Renderer vs 2 Renderers](#2-window-architecture-1-renderer-vs-2-renderers)
3. [Main Window Configuration](#3-main-window-configuration)
4. [Routing Design](#4-routing-design)
5. [Tray Integration](#5-tray-integration)
6. [Preload Bridge](#6-preload-bridge)
7. [Implementation Checklist](#7-implementation-checklist)

---

## 1. Current Architecture Summary

### How the app works today

Typeless is an Electron tray app that provides voice-to-text transcription. It has **one window** (the overlay) and **no visible main window or dock icon**.

```
                    Tray Icon (macOS menu bar)
                        |
                   TrayManager
                        |
        +---------------+---------------+
        |               |               |
  ShortcutManager  IPCHandler    TranscriptionService
        |               |
   F2 hotkey     Recording IPC
        |               |
        +-------+-------+
                |
        Overlay BrowserWindow
          (frameless, transparent,
           always-on-top, 220x64px)
                |
          Single Renderer
          (index.html -> renderer.ts -> App.tsx -> Overlay component)
```

### Key files and their roles

| File | Role |
|------|------|
| `src/main.ts` | Main process entry. Creates overlay, sets up shortcut manager, tray, and IPC handler. |
| `src/main/overlay-window.ts` | Creates the overlay `BrowserWindow` (frameless, transparent, 220x64). Uses `MAIN_WINDOW_VITE_DEV_SERVER_URL` / `MAIN_WINDOW_VITE_NAME` magic globals. |
| `src/main/tray-manager.ts` | Creates the system tray icon and context menu. Currently has: status display, API key prompt, and Quit. |
| `src/main/ipc-handlers.ts` | Handles all IPC: audio data, transcription, settings. Only knows about `overlayWindow`. |
| `src/preload.ts` | Bridges IPC channels to renderer. Exposes `window.electronAPI` with recording/transcription/settings methods. |
| `src/renderer.ts` | Renderer entry point. Mounts `<App />` into `#app`. |
| `src/renderer/App.tsx` | Simply renders `<Overlay />`. No routing. |
| `index.html` | Single HTML entry. Background is transparent. |
| `forge.config.ts` | Electron Forge config with ONE renderer entry named `main_window`. |
| `vite.renderer.config.ts` | Empty Vite config for the renderer. |

### Important constraints

- The overlay window loads `MAIN_WINDOW_VITE_DEV_SERVER_URL` (the name `main_window` is from Forge config, not because it is the "main" app window).
- `index.html` has `background: transparent` on `<body>` -- this is required for the overlay to work as a floating pill.
- The CSS in `index.css` sets `overflow: hidden`, `user-select: none`, and overlay-specific styles.
- There is no `react-router-dom` dependency yet.
- The app uses `zustand` for state management in the renderer.
- The app uses `electron-store` for persistent settings in the main process.

---

## 2. Window Architecture: 1 Renderer vs 2 Renderers

### Option A: Single Renderer Entry (Both windows share `index.html`)

**How it works:** Both the overlay and main window load the same `MAIN_WINDOW_VITE_DEV_SERVER_URL`. The renderer `App.tsx` checks a distinguishing signal (query param, hash, or environment variable) to decide which UI to show.

**Example distinguishing mechanisms:**
- **Query parameter:** Overlay loads `?window=overlay`, main loads `?window=main` (or default)
- **Hash:** Overlay loads `#overlay`, main loads `#/dashboard`
- **Global variable via preload:** Set `window.__WINDOW_TYPE__ = 'overlay'` in the preload

**App.tsx would become:**
```tsx
const App: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const windowType = params.get('window');

  if (windowType === 'overlay') {
    return <Overlay />;
  }
  return <MainApp />; // HashRouter with all pages
};
```

**Pros:**
- Simpler Forge config (no changes to `forge.config.ts`)
- Shared CSS, shared dependencies, single bundle
- Easier to share React context/hooks between windows
- Only one Vite renderer config to maintain

**Cons:**
- The main window loads overlay code (and vice versa) -- larger bundle for each window
- `index.html` has `background: transparent` which conflicts with the main window (main window needs an opaque background). Must override in CSS based on window type.
- The overlay's CSS (`overflow: hidden`, body transparent) conflicts with the main window's needs (scrollable content, opaque background)
- Harder to tree-shake dead code per window
- Testing/debugging is more confusing (same entry, different behaviors)

### Option B: Two Separate Renderer Entries

**How it works:** Add a second entry to the Forge Vite plugin `renderer` array. Each window gets its own HTML file, entry TS file, and Vite config.

**Forge config change:**
```typescript
renderer: [
  {
    name: 'overlay_window',      // renamed from 'main_window'
    config: 'vite.renderer.config.ts',
  },
  {
    name: 'main_window',         // the new main app window
    config: 'vite.main-renderer.config.ts',
  },
],
```

This generates magic globals:
- `OVERLAY_WINDOW_VITE_DEV_SERVER_URL` / `OVERLAY_WINDOW_VITE_NAME`
- `MAIN_WINDOW_VITE_DEV_SERVER_URL` / `MAIN_WINDOW_VITE_NAME`

**New file structure:**
```
/index.html                          -> overlay entry (rename or keep, transparent bg)
/main.html                           -> main window entry (opaque bg, Inter font)
/src/renderer.ts                     -> overlay renderer entry (mounts Overlay)
/src/main-renderer.ts                -> main window renderer entry (mounts MainApp with HashRouter)
/src/renderer/App.tsx                -> remains overlay-only (or remove, inline in renderer.ts)
/src/main-app/App.tsx                -> main window root with HashRouter
/src/main-app/pages/Login.tsx
/src/main-app/pages/Dashboard.tsx
/src/main-app/pages/History.tsx
/src/main-app/pages/Dictionary.tsx
/src/main-app/layouts/AppLayout.tsx  -> sidebar + outlet
/src/main-app/layouts/AuthLayout.tsx -> no sidebar (login page)
```

**Pros:**
- Clean separation of concerns
- Each window gets its own HTML with appropriate `<body>` styling
- No conditional logic to distinguish windows at runtime
- Smaller bundles (overlay bundle is tiny, main window bundle has React Router, pages, etc.)
- Each can have its own CSS entry (overlay CSS stays transparent, main window CSS has opaque bg)
- Easier to reason about, test, and debug

**Cons:**
- More Forge config boilerplate
- Need a second Vite renderer config file (can be minimal)
- Shared components need to be imported from a shared path (but this is good practice anyway)
- Renaming the existing `main_window` to `overlay_window` requires updating the variable declarations in `overlay-window.ts`

### RECOMMENDATION: Option B -- Two Separate Renderer Entries

**Reasoning:**

1. **The overlay and main window have fundamentally different requirements.** The overlay is frameless, transparent, 220x64px, always-on-top, and ignores mouse events. The main window is a standard macOS window with traffic lights, sidebar, routing, and opaque background. Forcing them into one entry creates constant friction.

2. **CSS conflicts are real and annoying.** The current `index.html` sets `background: transparent` on `<body>` and the CSS has `overflow: hidden` globally. The main window needs the opposite. Conditional CSS based on query params is fragile.

3. **Bundle size matters for the overlay.** The overlay should be tiny and instant -- it appears on every recording. Loading React Router, page components, and sidebar code into the overlay is wasteful.

4. **Electron Forge's Vite plugin is designed for this.** The `renderer` array explicitly supports multiple entries. This is the intended usage pattern.

5. **The migration is manageable.** The main change is renaming `main_window` to `overlay_window` in the Forge config and updating the `declare` statements in `overlay-window.ts`. Everything else is additive.

---

## 3. Main Window Configuration

### A. BrowserWindow Options

```typescript
// src/main/main-window.ts

import { BrowserWindow } from 'electron';
import path from 'node:path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    show: false,                            // Don't show until ready-to-show
    titleBarStyle: 'hiddenInset',           // macOS: native traffic lights, inset position
    trafficLightPosition: { x: 20, y: 18 },// Fine-tune traffic light position
    vibrancy: 'sidebar',                    // Optional: macOS sidebar vibrancy
    backgroundColor: '#FFFFFF',             // Prevent white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Show when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the main window renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
```

### B. titleBarStyle Explained

| Option | Effect |
|--------|--------|
| `'hidden'` | Hides the title bar, traffic lights at top-left corner flush with window edge |
| `'hiddenInset'` | Hides the title bar, traffic lights shifted inward by a fixed amount |
| `'customButtonsOnHover'` | Traffic lights hidden until mouse hover in top-left area |

**Recommendation: `'hiddenInset'`** -- This is the standard for modern macOS apps with custom title bars (like Notion, Linear, Arc). The traffic lights are slightly inset, which looks natural alongside a sidebar.

### C. Traffic Light Positioning

Use `trafficLightPosition` for pixel-perfect control:

```typescript
trafficLightPosition: { x: 20, y: 18 }
```

This positions the traffic lights 20px from the left edge and 18px from the top, which works well with a custom sidebar header area.

### D. Making the Title Bar Draggable

The area beside the traffic lights needs to be draggable so users can move the window. In your main window's CSS:

```css
/* The top bar / header area */
.titlebar-drag-region {
  -webkit-app-region: drag;
  height: 52px;           /* Match the header height */
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
}

/* Ensure interactive elements inside are NOT draggable */
.titlebar-drag-region button,
.titlebar-drag-region input,
.titlebar-drag-region a {
  -webkit-app-region: no-drag;
}
```

### E. Window Lifecycle

| Event | Action |
|-------|--------|
| App ready | Do NOT create main window immediately. Create only on first user request (tray click or "Open Typeless"). |
| "Open Typeless" from tray | If `mainWindow` is null, create it. If it exists and is hidden, call `mainWindow.show()`. If visible, call `mainWindow.focus()`. |
| User clicks close button (red traffic light) | **Hide** the window, do NOT destroy. Intercept with `close` event. |
| App quitting (`before-quit`) | Allow the close event to proceed normally (destroy the window). |
| User clicks tray "Open Typeless" again | Show the hidden window (fast, no re-creation). |

**Hide-on-close pattern:**

```typescript
let isAppQuitting = false;

app.on('before-quit', () => {
  isAppQuitting = true;
});

mainWindow.on('close', (event) => {
  if (!isAppQuitting) {
    event.preventDefault();
    mainWindow.hide();

    // On macOS, also hide from dock when main window is hidden
    // (only if you want a pure tray app with no dock icon when window is closed)
    // app.dock.hide();
  }
});
```

---

## 4. Routing Design

### A. HashRouter vs MemoryRouter vs BrowserRouter

| Router | URL Format | Works in Electron? | Notes |
|--------|-----------|-------------------|-------|
| `BrowserRouter` | `/dashboard` | NO | Requires an HTTP server to handle fallback routes. Electron loads `file://` protocol in production, which cannot handle client-side routing. |
| `HashRouter` | `/#/dashboard` | YES | Uses the hash portion of the URL. Works with `file://` protocol. The standard choice for Electron. |
| `MemoryRouter` | (no URL change) | YES | Keeps routes in memory only. URL bar never changes. Good for embedded views, but you lose the ability to deep-link or debug routes by URL. |

**Recommendation: `HashRouter`** -- It works with Electron's `file://` protocol, shows routes in the URL (useful for debugging), and is the standard pattern for Electron + React Router apps. There is no meaningful downside compared to `MemoryRouter` since Electron windows do not have a visible address bar.

### B. Route Structure

```tsx
// src/main-app/App.tsx
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

const MainApp: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        {/* Public routes (no sidebar) */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Protected routes (with sidebar) */}
        <Route element={<AuthGuard />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/dictionary" element={<DictionaryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
};
```

### C. Auth Guard Implementation

```tsx
// src/main-app/components/AuthGuard.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

const AuthGuard: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    // Save the attempted URL for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};
```

### D. Layout Architecture (Login vs App Pages)

The key insight is that React Router v6's **layout routes** (routes with just an `element` and no `path`, wrapping child routes) handle this perfectly.

**AuthLayout (Login page -- no sidebar):**

```tsx
// src/main-app/layouts/AuthLayout.tsx
const AuthLayout: React.FC = () => {
  return (
    <div className="auth-layout">
      {/* Full-width centered content, no sidebar */}
      {/* Title bar drag region still needed at top for macOS */}
      <div className="titlebar-drag-region" />
      <Outlet />
    </div>
  );
};
```

**AppLayout (Dashboard/History/Dictionary -- with sidebar):**

```tsx
// src/main-app/layouts/AppLayout.tsx
import { Outlet, useLocation } from 'react-router-dom';

const AppLayout: React.FC = () => {
  return (
    <div className="app-layout">
      {/* Drag region for the entire top bar area */}
      <div className="titlebar-drag-region" />

      <aside className="sidebar">
        <div className="sidebar-header">
          {/* Empty space where traffic lights sit (approx 70px) */}
        </div>
        <nav className="sidebar-nav">
          <SidebarLink to="/dashboard" icon={DashboardIcon} label="Dashboard" />
          <SidebarLink to="/history" icon={HistoryIcon} label="History" />
          <SidebarLink to="/dictionary" icon={BookIcon} label="Dictionary" />
        </nav>
        <div className="sidebar-footer">
          <SidebarLink to="/settings" icon={SettingsIcon} label="Settings" />
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};
```

**CSS for the app layout:**

```css
.app-layout {
  display: flex;
  height: 100vh;
  background: #FFFFFF;
}

.sidebar {
  width: 240px;
  background: #F5F5F5;
  border-right: 1px solid #E5E5E5;
  display: flex;
  flex-direction: column;
  padding-top: 52px;  /* Space for traffic lights + drag region */
}

.main-content {
  flex: 1;
  padding-top: 52px;  /* Space for drag region */
  overflow-y: auto;
}

.titlebar-drag-region {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 52px;
  -webkit-app-region: drag;
  z-index: 100;
}
```

### E. Sidebar Navigation State

Use `useLocation()` from React Router to highlight the active sidebar item:

```tsx
// src/main-app/components/SidebarLink.tsx
import { NavLink } from 'react-router-dom';

const SidebarLink: React.FC<{ to: string; icon: React.FC; label: string }> = ({ to, icon: Icon, label }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
      }
    >
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
};
```

React Router's `<NavLink>` component automatically applies the `isActive` state based on the current URL. No manual state tracking needed.

---

## 5. Tray Integration

### A. Adding "Open Typeless" to the Tray Menu

Modify `src/main/tray-manager.ts` to accept a callback for opening the main window:

```typescript
export class TrayManager {
  private tray: Tray | null = null;
  private onQuit: () => void;
  private onApiKeyChanged: (key: string) => void;
  private onOpenMainWindow: () => void;    // NEW

  constructor(
    onQuit: () => void,
    onApiKeyChanged: (key: string) => void,
    onOpenMainWindow: () => void,           // NEW
  ) {
    this.onQuit = onQuit;
    this.onApiKeyChanged = onApiKeyChanged;
    this.onOpenMainWindow = onOpenMainWindow;
  }

  updateMenu(status: string): void {
    if (!this.tray) return;

    const config = getConfig();
    const hasApiKey = !!config.apiKey;
    const statusText = /* ... same as before ... */;

    const contextMenu = Menu.buildFromTemplate([
      { label: `Typeless - ${statusText}`, enabled: false },
      { type: 'separator' },
      {
        label: 'Open Typeless',                     // NEW
        click: () => this.onOpenMainWindow(),
      },
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
}
```

### B. Toggle Main Window Visibility

In `src/main.ts`:

```typescript
import { createMainWindow, getMainWindow } from './main/main-window';

function toggleMainWindow(): void {
  let win = getMainWindow();

  if (!win || win.isDestroyed()) {
    // First time opening (lazy creation)
    win = createMainWindow();
    setupMainWindowCloseHandler(win);
    return;
  }

  if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
    win.focus();
  }
}

// Pass to TrayManager constructor
trayManager = new TrayManager(
  () => app.quit(),
  (apiKey) => transcriptionService.updateApiKey(apiKey),
  () => toggleMainWindow(),  // NEW
);
```

### C. Close Behavior: Hide vs Destroy

**Recommendation: Hide on close, destroy only on quit.**

This is the standard macOS pattern (same as Slack, Discord, Spotify). The user clicks the red traffic light to dismiss the window, but the app keeps running in the tray. The window re-appears instantly when they click "Open Typeless" again because it was hidden, not destroyed.

```typescript
function setupMainWindowCloseHandler(win: BrowserWindow): void {
  let isAppQuitting = false;

  app.on('before-quit', () => {
    isAppQuitting = true;
  });

  win.on('close', (event) => {
    if (!isAppQuitting) {
      event.preventDefault();
      win.hide();
    }
    // If isAppQuitting, let the default close/destroy happen
  });
}
```

**Memory note:** A hidden BrowserWindow still consumes ~150-250MB of memory (due to Chromium process isolation). This is acceptable for a desktop app that the user opens frequently. If memory is a concern, you could destroy the window and re-create it on demand, but this adds a ~1-2 second delay when reopening.

---

## 6. Preload Bridge

### A. Should the Main Window Use a Different Preload?

**Recommendation: Share the same `preload.ts` for both windows, but extend it with new channels.**

Both windows need `contextIsolation: true` and `nodeIntegration: false`. The preload script simply bridges IPC channels. It is safe and clean to expose a superset of APIs, since unused APIs do no harm.

Alternatively, you could create a second preload script (e.g., `preload-main.ts`) and add it as another `build` entry in `forge.config.ts`. This gives cleaner separation but adds complexity. For this project, sharing one preload is simpler and recommended.

**If you do want separate preloads later**, the Forge config would look like:

```typescript
build: [
  { entry: 'src/main.ts', config: 'vite.main.config.ts', target: 'main' },
  { entry: 'src/preload.ts', config: 'vite.preload.config.ts', target: 'preload' },
  { entry: 'src/preload-main.ts', config: 'vite.preload.config.ts', target: 'preload' },
],
```

Both preload scripts would build with the same Vite config but produce separate output files. Each `BrowserWindow` would reference its own preload path.

### B. New IPC Channels for the Main Window

The main window will need additional IPC channels beyond what the overlay uses. Here is what to add to `src/shared/constants.ts`:

```typescript
export const IPC_CHANNELS = {
  // ... existing channels ...

  // Main window lifecycle
  MAIN_WINDOW_SHOW: 'main-window:show',
  MAIN_WINDOW_HIDE: 'main-window:hide',

  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_SESSION: 'auth:get-session',
  AUTH_ON_SESSION_CHANGE: 'auth:on-session-change',

  // History
  HISTORY_GET_ALL: 'history:get-all',
  HISTORY_GET_BY_ID: 'history:get-by-id',
  HISTORY_DELETE: 'history:delete',
  HISTORY_SEARCH: 'history:search',

  // Dictionary
  DICTIONARY_GET_ALL: 'dictionary:get-all',
  DICTIONARY_ADD_WORD: 'dictionary:add-word',
  DICTIONARY_DELETE_WORD: 'dictionary:delete-word',
  DICTIONARY_UPDATE_WORD: 'dictionary:update-word',

  // Navigation (main -> renderer)
  NAVIGATE_TO: 'navigate:to',
} as const;
```

### C. Extended Preload API

Add new methods to the `ElectronAPI` interface and `preload.ts`:

```typescript
// Add to ElectronAPI interface in shared/types.ts
export interface ElectronAPI {
  // ... existing methods ...

  // Main window
  showMainWindow: () => void;
  hideMainWindow: () => void;

  // Auth
  login: (credentials: { email: string; password: string }) => Promise<Session>;
  logout: () => Promise<void>;
  getSession: () => Promise<Session | null>;
  onSessionChange: (callback: (session: Session | null) => void) => Disposer;

  // History
  getHistory: () => Promise<HistoryEntry[]>;
  deleteHistoryEntry: (id: string) => Promise<void>;
  searchHistory: (query: string) => Promise<HistoryEntry[]>;

  // Navigation
  onNavigateTo: (callback: (path: string) => void) => Disposer;
}
```

### D. Sharing the Preload Between Windows

Since both windows reference `path.join(__dirname, 'preload.js')`, and both windows get the full `window.electronAPI`, this works out of the box. The overlay simply does not call the history/dictionary/auth methods, and the main window simply does not call the recording methods (though it could, if you want to show recording status in the main window too).

---

## 7. Implementation Checklist

### Phase 1: Forge Config and File Structure

- [ ] Rename the existing renderer entry from `main_window` to `overlay_window` in `forge.config.ts`
- [ ] Update `declare` statements in `overlay-window.ts` to use `OVERLAY_WINDOW_VITE_DEV_SERVER_URL` / `OVERLAY_WINDOW_VITE_NAME`
- [ ] Add the new `main_window` renderer entry in `forge.config.ts`
- [ ] Create `main.html` (new HTML entry for main window, opaque background)
- [ ] Create `vite.main-renderer.config.ts` (can start as empty `defineConfig({})`)
- [ ] Create `src/main-renderer.ts` (entry point that mounts the main window React app)
- [ ] Install `react-router-dom` (`npm install react-router-dom`)

### Phase 2: Main Window Creation

- [ ] Create `src/main/main-window.ts` with `createMainWindow()` and `getMainWindow()`
- [ ] Configure BrowserWindow with `titleBarStyle: 'hiddenInset'`, traffic light position, etc.
- [ ] Implement hide-on-close pattern
- [ ] Add `isAppQuitting` flag in `main.ts`
- [ ] Add `toggleMainWindow()` function in `main.ts`

### Phase 3: Tray Integration

- [ ] Add `onOpenMainWindow` callback to `TrayManager` constructor
- [ ] Add "Open Typeless" menu item to tray context menu
- [ ] Pass `toggleMainWindow` to `TrayManager` in `main.ts`

### Phase 4: React Router Setup

- [ ] Create `src/main-app/App.tsx` with `HashRouter` and route definitions
- [ ] Create `AuthLayout` (no sidebar, for login page)
- [ ] Create `AppLayout` (sidebar + outlet, for authenticated pages)
- [ ] Create `AuthGuard` component
- [ ] Create `SidebarLink` component with `NavLink`
- [ ] Create page stubs: `LoginPage`, `DashboardPage`, `HistoryPage`, `DictionaryPage`, `SettingsPage`

### Phase 5: Main Window CSS

- [ ] Create `src/main-app/index.css` (or use Tailwind) with:
  - App layout styles (sidebar, main content)
  - Title bar drag region
  - Sidebar styles (240px wide, nav links)
  - Traffic light safe zone (top-left padding)
- [ ] Ensure the main window body has opaque background (not transparent)

### Phase 6: IPC Extension

- [ ] Add new IPC channels to `constants.ts`
- [ ] Extend `preload.ts` with new API methods
- [ ] Extend `ElectronAPI` interface in `types.ts`
- [ ] Add main window IPC handlers in a new `src/main/main-window-ipc.ts` or extend existing `ipc-handlers.ts`

---

## Appendix: Forge Config Diff

Here is the exact change needed in `forge.config.ts`:

```diff
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
-         name: 'main_window',
+         name: 'overlay_window',
          config: 'vite.renderer.config.ts',
        },
+       {
+         name: 'main_window',
+         config: 'vite.main-renderer.config.ts',
+       },
      ],
    }),
```

And in `src/main/overlay-window.ts`:

```diff
- declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
- declare const MAIN_WINDOW_VITE_NAME: string;
+ declare const OVERLAY_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
+ declare const OVERLAY_WINDOW_VITE_NAME: string;

  // ...

- if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
-   overlay.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
+ if (OVERLAY_WINDOW_VITE_DEV_SERVER_URL) {
+   overlay.loadURL(OVERLAY_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    overlay.loadFile(
-     path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
+     path.join(__dirname, `../renderer/${OVERLAY_WINDOW_VITE_NAME}/index.html`)
    );
  }
```

## Appendix: New File Templates

### `main.html`

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Typeless</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main-renderer.ts"></script>
  </body>
</html>
```

Note: No `style="background: transparent;"` on `<body>` -- the main window has an opaque background.

### `src/main-renderer.ts`

```typescript
import './main-app/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import MainApp from './main-app/App';

const root = document.getElementById('app');
if (root) {
  createRoot(root).render(React.createElement(MainApp));
}
```

### `vite.main-renderer.config.ts`

```typescript
import { defineConfig } from 'vite';

export default defineConfig({});
```

---

## Sources

- [Vite Plugin | Electron Forge](https://www.electronforge.io/config/plugins/vite) -- Official docs on configuring multiple renderers
- [Custom Title Bar | Electron](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar) -- titleBarStyle, trafficLightPosition, drag regions
- [BrowserWindow | Electron](https://www.electronjs.org/docs/latest/api/browser-window) -- Window options and lifecycle events
- [Multiple Windows in Electron apps](https://blog.bloomca.me/2025/07/21/multi-window-in-electron.html) -- Patterns for multi-window architecture, memory considerations
- [Electron: Hide window instead of quitting](https://gist.github.com/t4t5/169727139514a81c603646a7de2044b4) -- Hide-on-close pattern for macOS
- [Routing in React (HashRouter) with Electron](https://medium.com/@biplavmazumdar5/routing-in-react-hashrouter-with-electron-js-48469a698f24) -- Why HashRouter is needed for Electron
- [Creating Protected Routes With React Router V6](https://medium.com/@dennisivy/creating-protected-routes-with-react-router-v6-2c4bbaf7bc1c) -- Auth guard pattern with Outlet
- [Authentication with React Router v6 | LogRocket](https://blog.logrocket.com/authentication-react-router-v6/) -- Layout routes and protected route patterns
- [electron-forge-docs/vite.md](https://github.com/electron-forge/electron-forge-docs/blob/v6/config/plugins/vite.md) -- Forge Vite plugin internals and naming conventions
- [Building a Custom Title Bar in Electron | DoltHub](https://www.dolthub.com/blog/2025-02-11-building-a-custom-title-bar-in-electron/) -- Practical custom title bar implementation
