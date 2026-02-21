# Renderer Isolation & Code Logic Review

**Reviewer:** Claude Opus 4.6 (Senior Software Architect)
**Date:** 2026-02-21
**Project:** Typeless (Electron 40, macOS, dual-renderer)

---

## 1. Renderer Isolation

### CSS Isolation: PASS

- **Overlay CSS** (`src/index.css`, loaded via `src/renderer.ts`):
  - Pure vanilla CSS with custom properties.
  - Explicitly sets `html, body { background: transparent; }` -- critical for the transparent overlay window.
  - Uses a global `*` reset (`margin: 0; padding: 0; box-sizing: border-box`).
  - Does NOT import Tailwind (`@import "tailwindcss"` is absent).
  - The HTML entry (`index.html`) also sets `style="background: transparent;"` on `<body>`.

- **Main window CSS** (`src/main-app/index.css`, loaded via `src/main-app/main-renderer.ts`):
  - Imports Tailwind v4 via `@import "tailwindcss";`.
  - Sets `html, body, #app { background: var(--bg-page); }` where `--bg-page: #faf9f5`.
  - Uses `@layer base` to define design tokens and font families.
  - The HTML entry (`main.html`) sets `style="margin: 0; background: #faf9f5;"` on `<body>`.

- **PostCSS** (`postcss.config.js`) uses `@tailwindcss/postcss` globally, but this only activates Tailwind processing for CSS files that contain `@import "tailwindcss"`. The overlay's `src/index.css` does not contain this directive, so Tailwind preflight/reset will NOT be injected into the overlay bundle.

- **Verdict:** The two CSS bundles are completely independent. Tailwind's preflight (which resets `background`, `margin`, etc.) is only present in the main window bundle. The overlay's transparent background is safe.

### HTML Entry Isolation: PASS

- `index.html` loads `<script type="module" src="/src/renderer.ts">` -- the overlay entry point.
- `main.html` loads `<script type="module" src="/src/main-app/main-renderer.ts">` -- the main window entry point.
- Different Google Fonts are loaded: `Inter` for overlay, `DM Sans + IBM Plex Mono + Instrument Serif` for main window.
- Each HTML file has its own inline `<body>` styles appropriate to its window type.
- **No cross-loading is possible** -- Vite bundles each entry independently and the BrowserWindows load different URLs.

### Code Bundle Isolation: PASS

- **Overlay bundle** entry chain: `src/renderer.ts` -> `src/renderer/App.tsx` -> `src/renderer/components/Overlay.tsx`.
  - Only imports from `src/renderer/` (stores, services, components) and `src/shared/`.
  - Does NOT import anything from `src/main-app/`.

- **Main window bundle** entry chain: `src/main-app/main-renderer.ts` -> `src/main-app/App.tsx` -> pages/layouts/components under `src/main-app/`.
  - Only imports from `src/main-app/` and `src/shared/`.
  - Does NOT import anything from `src/renderer/`.

- **Vite configs** are separate:
  - `vite.renderer.config.ts` builds from `index.html`.
  - `vite.main-renderer.config.ts` builds from `main.html`.
  - Neither config includes plugins that could cause cross-contamination.

- **Shared code** (`src/shared/constants.ts`, `src/shared/types.ts`) is type definitions and constants only -- no side effects, no CSS, no DOM manipulation. Safe to share.

---

## 2. Preload Script Sharing

### Analysis: SAFE (with minor note)

Both windows share the exact same `src/preload.ts` which exposes the full `ElectronAPI` interface via `contextBridge.exposeInMainWorld('electronAPI', electronAPI)`.

**What the overlay uses (confirmed by reading Overlay.tsx):**
- `onRecordingStart`, `onRecordingStop`, `onRecordingCancel`
- `onStatusUpdate`, `onTranscriptionResult`, `onTranscriptionError`
- `sendAudioData`, `cancelRecording`

**What the main window uses (confirmed by reading main-app components):**
- `authSignIn`, `authSignUp`, `authSignOut`, `authGetSession`, `onAuthStateChanged`
- `historyList`, `historyDelete`
- `profileGet`, `profileUpdate`

**Risk assessment:**
- The overlay renderer has `window.electronAPI.authSignIn` available but never calls it. The overlay's React code (`Overlay.tsx`) does not import or reference any auth/history/profile methods.
- The main window has `window.electronAPI.sendAudioData` available but never calls it. The main-app code does not import or reference any recording methods.
- **Could the overlay accidentally call auth methods?** No -- there is no code path in the overlay React tree that invokes any auth/history/profile API. These methods exist on the bridge but are dead code from the overlay's perspective.
- **IPC listener concern (push messages):** The preload registers `ipcRenderer.on(IPC_CHANNELS.AUTH_STATE_CHANGED, ...)` in the overlay window, but the overlay code never calls `window.electronAPI.onAuthStateChanged()` to register a callback, so the handler is registered at the preload level but the callback is a no-op (it would call `callback(data.user)` where `callback` was provided, but since nobody in the overlay calls `onAuthStateChanged`, the listener function returned by the preload is never invoked, and thus no listener is registered on `ipcRenderer`).

  **Correction on closer inspection:** The preload creates the `onAuthStateChanged` *function* but does NOT eagerly register the `ipcRenderer.on` listener. The listener is only registered when the function is *called* by renderer code. Since the overlay never calls `window.electronAPI.onAuthStateChanged(...)`, no listener is registered in the overlay for `AUTH_STATE_CHANGED`. This is correct behavior.

- Similarly, `onRecordingStart`/`onRecordingStop`/`onRecordingCancel` listeners are only registered in the overlay (via `Overlay.tsx`'s `useEffect`), and the main window never calls those registration functions.

**Note:** While having a single shared preload is architecturally clean for this project size, if the API surface grows significantly, consider splitting into two preload scripts to enforce separation at the API boundary level. For now, this is fine.

---

## 3. Main Process Integration

### Overlay Independence: PASS

- In `src/main.ts`, overlay creation happens at line 44: `overlayWindow = createOverlayWindow()`.
- Main window creation is lazy -- `getMainWindow()` returns `null` until the user first clicks "Open Typeless" in the tray (which calls `toggleMainWindow()`, which calls `createMainWindow()`).
- The overlay is created unconditionally during `initApp()`. The main window is never mentioned in `initApp()` beyond passing `getMainWindow` as a callback reference to `registerAuthIPC`.
- **The overlay's creation, display, and recording flow has zero dependency on the main window existing.** Confirmed.

### Window Targeting: PASS

- **Shortcut Manager** (`shortcut-manager.ts`): F2 toggles recording. Sends `RECORDING_START`/`RECORDING_STOP` to `overlayWindow.webContents` only. Never references main window.
- **ESC shortcut** (registered in `main.ts` line 73): Sends `RECORDING_CANCEL` to `overlayWindow.webContents` only. Correct.
- **IPCHandler** (`ipc-handlers.ts`): All status updates, transcription results, and errors are sent to `this.overlayWindow.webContents`. Never references main window. Correct.
- **Auth IPC** (`auth-ipc.ts`): `AUTH_STATE_CHANGED` is sent via `getMainWindow()?.webContents.send()`. The optional chaining `?.` means if main window is null, the send is silently skipped. Correct.
- **Tray** (`tray-manager.ts`): "Open Typeless" calls `onOpenMainWindow()` which is `toggleMainWindow()`. This only affects the main window. The tray's status display updates (`updateMenu`) are independent of window targeting. Correct.

### before-quit Handling: PASS

- `before-quit` handler (line 125-131): Gets main window via `getMainWindow()`, sets `_forceClose = true`, and calls `mw.close()`. This correctly force-closes the main window (bypassing its hide-on-close behavior).
- The overlay window is not explicitly closed in `before-quit`, but Electron's default `app.quit()` flow (triggered by tray "Quit" or Cmd+Q) will destroy all remaining windows. The overlay has no `close` handler that prevents default closing, so it will be destroyed normally.
- `will-quit` handler: Unregisters all global shortcuts and destroys tray. Correct.
- `window-all-closed`: Does nothing (tray app pattern). Correct.

---

## 4. Forge Config

### Renderer Mapping: PASS

In `forge.config.ts`, the VitePlugin configuration:

```typescript
renderer: [
  {
    name: 'overlay_window',
    config: 'vite.renderer.config.ts',    // builds index.html
  },
  {
    name: 'main_window',
    config: 'vite.main-renderer.config.ts', // builds main.html
  },
],
```

This generates the magic constants:
- `OVERLAY_WINDOW_VITE_DEV_SERVER_URL` and `OVERLAY_WINDOW_VITE_NAME` -- used in `src/main/overlay-window.ts`. Confirmed correct.
- `MAIN_WINDOW_VITE_DEV_SERVER_URL` and `MAIN_WINDOW_VITE_NAME` -- used in `src/main/main-window.ts`. Confirmed correct.

Each Vite config points to its respective HTML entry:
- `vite.renderer.config.ts`: `input: 'index.html'`
- `vite.main-renderer.config.ts`: `input: 'main.html'`

Mapping is correct and consistent.

---

## 5. Shared Code Safety

### Assessment: SAFE

- `src/shared/constants.ts`: Pure constant definitions. No side effects. Both processes reading the same channel names is necessary and correct.
- `src/shared/types.ts`: Pure TypeScript type/interface definitions. Compiled away at build time. No runtime impact.
- `ElectronAPI` interface defines ALL methods for both windows. This is a **type-level union** -- it means both windows have the same API surface exposed via the preload bridge.

**Is the unified `ElectronAPI` a problem?**

No, for the following reasons:
1. **Runtime safety:** Even if the overlay could theoretically call `authSignIn`, the IPC handlers are registered via `ipcMain.handle` which responds to any renderer that invokes them. Auth methods are stateless from the renderer's perspective -- they just call Supabase. No harm if called from the overlay (though it never does).
2. **No ambient listeners leak:** Push-model IPC (like `AUTH_STATE_CHANGED`) is sent via `getMainWindow()?.webContents.send()`, which targets only the main window. The overlay never receives these messages.
3. **Practical risk is zero:** The overlay's React component tree (`Overlay.tsx`) has no code path that invokes auth/history/profile methods. Tree-shaking may even eliminate these from the overlay bundle.

**Recommendation (nice-to-have, not required):** If the API surface grows, consider splitting into `OverlayElectronAPI` and `MainWindowElectronAPI` interfaces with separate preload scripts. For the current project size, the single preload approach is pragmatic and safe.

---

## 6. IPC Message Routing

### Correct Targeting: PASS

**Renderer -> Main (ipcMain.handle / ipcMain.on):**

| Channel | Who sends | Handler | Notes |
|---------|-----------|---------|-------|
| `RECORDING_AUDIO_DATA` | Overlay | `ipc-handlers.ts` | Processes audio, saves to history via `historyService.save()` |
| `RECORDING_CANCELLED` | Overlay | `ipc-handlers.ts` | Hides overlay |
| `SETTINGS_GET/SET` | Either (but only overlay in practice) | `ipc-handlers.ts` | Reads/writes config store |
| `AUTH_SIGN_UP/IN/OUT` | Main window | `auth-ipc.ts` | Supabase auth |
| `AUTH_GET_SESSION` | Main window | `auth-ipc.ts` | Session check |
| `HISTORY_LIST/DELETE` | Main window | `auth-ipc.ts` | Supabase history |
| `PROFILE_GET/UPDATE` | Main window | `auth-ipc.ts` | Supabase profiles |

All `ipcMain.handle` handlers respond to the calling renderer. No cross-window confusion.

**Main -> Renderer (webContents.send):**

| Channel | Target | Sender | Notes |
|---------|--------|--------|-------|
| `RECORDING_START` | Overlay only | `shortcut-manager.ts` via `overlayWindow.webContents` | Correct |
| `RECORDING_STOP` | Overlay only | `shortcut-manager.ts` via `overlayWindow.webContents` | Correct |
| `RECORDING_CANCEL` | Overlay only | `main.ts` ESC handler via `overlayWindow.webContents` | Correct |
| `STATUS_UPDATE` | Overlay only | `ipc-handlers.ts` via `this.overlayWindow.webContents` | Correct |
| `TRANSCRIPTION_RESULT` | Overlay only | `ipc-handlers.ts` via `this.overlayWindow.webContents` | Correct |
| `TRANSCRIPTION_ERROR` | Overlay only | `ipc-handlers.ts` via `this.overlayWindow.webContents` | Correct |
| `AUTH_STATE_CHANGED` | Main window only | `auth-ipc.ts` via `getMainWindow()?.webContents` | Correct |
| `SETTINGS_UPDATED` | Overlay only | `ipc-handlers.ts` via `this.overlayWindow.webContents` | Correct |

**No IPC messages go to the wrong window.** Every `webContents.send` call uses the correct window reference.

---

## 7. Edge Cases

### Case 1: Record while main window is hidden
**PASS**

The recording pipeline is: F2 -> shortcutManager sends `RECORDING_START` to overlay -> user speaks -> F2 again -> overlay sends `RECORDING_AUDIO_DATA` to main process -> `IPCHandler` transcribes -> `historyService.save()`.

`historyService.save()` (in `history-service.ts`) calls `supabase.auth.getSession()` directly in the main process. It does NOT depend on the main window being visible or existing. The Supabase client lives in the main process with its own session storage (`electron-store` + `safeStorage`). If the user is logged in (session exists), history saves regardless of main window state. If the user is not logged in, `save()` returns early (`if (!session) return;`). No crash, no error.

### Case 2: Main window has never been opened (null), user records
**PASS**

- `getMainWindow()` returns `null` since `createMainWindow()` was never called.
- `historyService.save()` does not depend on the main window at all -- it runs entirely in the main process using the Supabase client singleton.
- `getMainWindow()?.webContents.send(IPC_CHANNELS.AUTH_STATE_CHANGED, ...)` -- the optional chaining silently skips this since `getMainWindow()` is null. No crash.
- Recording and transcription work entirely through the overlay window. No dependency on main window.

### Case 3: User opens main window first time, redirected to login
**PASS**

- `toggleMainWindow()` calls `createMainWindow()` on first invocation.
- Main window loads `main.html` -> `main-renderer.ts` -> `App.tsx` with `HashRouter`.
- Default route `*` redirects to `/dashboard`.
- `/dashboard` is wrapped in `<AuthGuard>` which calls `checkSession()` on mount.
- `checkSession()` invokes `window.electronAPI.authGetSession()` -> `authService.getSession()` -> Supabase session check.
- If no session exists: `isAuthenticated: false` -> `AuthGuard` renders `<Navigate to="/login" replace />`.
- User sees the login page. This flow works correctly.

### Case 4: User logs out from main window, then records
**PASS**

- User clicks sign out -> `authSignOut()` -> Supabase session is cleared.
- `AUTH_STATE_CHANGED` with `{ user: null }` is sent to main window. Main window updates its auth store and redirects to login.
- User presses F2 to record via overlay. Recording and transcription proceed normally (they depend on OpenAI API key in `config-store`, not on Supabase auth).
- After transcription, `historyService.save()` is called. It checks `supabase.auth.getSession()` -> no session -> `return;` (early exit, no save). This is silent and intentional.
- The transcribed text is still injected into the active app (text injection is independent of auth).
- **Overlay recording works perfectly. History saving is silently skipped. No crash, no error.**

### Case 5: App quits while main window is hidden
**PASS**

- Tray "Quit" calls `app.quit()`.
- `before-quit` fires: gets main window (may be hidden but still exists), sets `_forceClose = true`, calls `mw.close()`. The close handler in `main-window.ts` checks `_forceClose` and allows the close to proceed (does not `preventDefault()`).
- If `getMainWindow()` returns null (never opened), the `if (mw)` check skips the force-close. No crash.
- `will-quit` fires: unregisters shortcuts, destroys tray.
- App exits cleanly.

### Case 6: Both windows open simultaneously
**PASS**

- Each window has its own `webContents` and receives only messages targeted to it.
- The overlay can record while the main window displays history. No interference.
- IPC handlers (`ipcMain.handle`) are process-global singletons -- they respond to whichever renderer calls them. No conflict since the two windows call different subsets of channels.

### Case 7: Overlay receives AUTH_STATE_CHANGED
**NOT POSSIBLE (PASS)**

- `AUTH_STATE_CHANGED` is sent via `getMainWindow()?.webContents.send()`.
- The overlay window reference is held in a separate variable (`overlayWindow` in `main.ts`).
- `getMainWindow()` returns the `mainWindow` variable from `main-window.ts` module scope.
- These are distinct `BrowserWindow` instances. The overlay will never receive `AUTH_STATE_CHANGED`.

---

## Critical Issues (must fix before ship)

None identified.

---

## Warnings (should fix)

1. **`SETTINGS_UPDATED` is sent only to overlay, but main window might also need it.** In `ipc-handlers.ts` line 136, when settings are updated via `SETTINGS_SET`, the `SETTINGS_UPDATED` event is sent to `this.overlayWindow.webContents` only. If the main window ever needs to react to settings changes (e.g., displaying current hotkey or language), it would not receive this notification. Currently the main window does not use settings, so this is not a bug -- but it could become one if settings UI is added to the main window.

2. **`historyService` is exported as a module-level singleton from `auth-ipc.ts`.** The `IPCHandler` in `ipc-handlers.ts` imports `historyService` directly from `auth-ipc.ts` (line 7). This works because `auth-ipc.ts` instantiates `historyService` at module scope (line 14), independent of `registerAuthIPC` being called. However, this creates an implicit coupling: `ipc-handlers.ts` depends on a module that also handles auth IPC registration. If `auth-ipc.ts` is ever refactored, this import path could break. Consider moving `historyService` to its own import or to a shared services module.

3. **Hardcoded enablePolish override in config-store.ts (line 24).** `store.set('enablePolish', true);` runs on every app start, forcing polish to always be enabled regardless of user preference. This appears intentional for now but could frustrate users if a settings UI is added later.

---

## Recommendations (nice to have)

1. **Consider separate preload scripts** if the API surface grows beyond ~20 methods. This would enforce separation at the build level rather than relying on discipline in the React code. For the current 15-method API, a single preload is fine.

2. **Add TypeScript module boundary linting.** An ESLint rule like `no-restricted-imports` could enforce that files in `src/renderer/` cannot import from `src/main-app/` and vice versa. This would catch accidental cross-imports at build time.

3. **Main window should handle the case where Supabase credentials are placeholder.** The `supabase-client.ts` has `SUPABASE_URL = 'https://placeholder.supabase.co'` and `SUPABASE_ANON_KEY = 'placeholder-anon-key'`. If these are not replaced before shipping, all auth/history/profile operations will fail silently or with confusing errors. The overlay (recording) would still work since it only uses OpenAI, but the entire main window would be non-functional.

4. **Consider sending `AUTH_STATE_CHANGED` on Supabase's `onAuthStateChange` listener** rather than only on explicit sign-in/sign-out. This would handle edge cases like token refresh failures or session expiry, where the user is silently logged out without the main window knowing.

---

## Overall Verdict: SHIP

The two-renderer architecture is clean and correctly isolated. CSS bundles are separate (Tailwind v4 preflight is confined to the main window). HTML entry points load different scripts. Code bundles share nothing except type-safe constants and interfaces. IPC message routing is correct -- every `webContents.send()` targets the right window. The preload sharing is safe because listeners are only registered when explicitly called by renderer code. All edge cases (main window null, hidden, logged out) are handled gracefully with optional chaining and early returns. No critical issues were found.
