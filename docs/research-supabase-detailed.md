# Supabase Integration: Detailed Technical Design Document

> Date: 2026-02-20
> Project: Typeless (macOS desktop voice-to-text transcription app)
> Stack: Electron 40 + React 19 + TypeScript + Vite (electron-forge) + Zustand
> Author: Research Agent

---

## Table of Contents

1. [Project Context & Current Architecture](#1-project-context--current-architecture)
2. [Database Schema (Complete SQL)](#2-database-schema-complete-sql)
3. [Auth Flow Design for Electron](#3-auth-flow-design-for-electron)
4. [API Layer & IPC Channel Design](#4-api-layer--ipc-channel-design)
5. [Environment Variables & Build Configuration](#5-environment-variables--build-configuration)
6. [Google OAuth Deep-Link Flow (Future)](#6-google-oauth-deep-link-flow-future)
7. [TypeScript Types & Supabase CLI](#7-typescript-types--supabase-cli)
8. [Implementation Checklist](#8-implementation-checklist)
9. [Sources](#9-sources)

---

## 1. Project Context & Current Architecture

### 1.1 How the App Works Today

Typeless is a macOS tray app that:
1. User presses F2 (global shortcut) to start recording
2. An overlay window appears showing recording status
3. User presses F2 again to stop; audio is sent from renderer to main via IPC
4. Main process calls OpenAI (gpt-4o-transcribe) for speech-to-text
5. Main process optionally polishes text with gpt-4o-mini
6. Result is injected into the active app via clipboard + Cmd+V simulation

### 1.2 Key Architecture Points

- **Main Process** (`src/main.ts`): Manages `TranscriptionService`, `TextInjector`, `IPCHandler`, `ShortcutManager`, `TrayManager`. Uses `electron-store` for persistent config (API key, hotkey, language, enablePolish).
- **Renderer Process** (`src/renderer/`): Single overlay window with React 19 + Zustand state management. Handles audio recording via `AudioRecorder`, sends raw WebM buffer to main process.
- **Preload** (`src/preload.ts`): Exposes `ElectronAPI` to renderer via `contextBridge`. Current IPC channels: recording events, transcription results, settings get/set.
- **Build System**: electron-forge with Vite plugin. Three separate Vite configs (main, preload, renderer) -- all currently empty `defineConfig({})`. Uses `dotenv` in `forge.config.ts` for Apple signing credentials only.
- **No routing**: The renderer is a single overlay component. There is no React Router. The app is a tray app with an overlay window, not a full windowed application.

### 1.3 Implications for Supabase Integration

- The Supabase client should live in the **main process** -- the renderer is a transparent overlay, not a full UI. Auth UI will need a **separate settings/login window** or integration into the tray menu.
- All Supabase operations go through IPC (main process calls Supabase, renderer calls main via preload bridge).
- The app currently has no concept of "user" -- adding auth means adding a user identity layer.
- `electron-store` is already a dependency and is the natural choice for session persistence.

---

## 2. Database Schema (Complete SQL)

### 2.1 `user_profiles` Table

```sql
-- ============================================================
-- user_profiles: Extended user information
-- Links to Supabase's built-in auth.users table
-- ============================================================
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days') NOT NULL
);

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

### 2.2 `transcription_history` Table

```sql
-- ============================================================
-- transcription_history: Records of all transcriptions
-- ============================================================
CREATE TABLE public.transcription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Core content
  original_text TEXT NOT NULL,           -- Raw Whisper output
  optimized_text TEXT,                   -- AI-polished text (gpt-4o-mini)

  -- Context metadata
  app_context TEXT,                      -- Which app was active when recording (e.g. "Slack", "VS Code")
  language TEXT,                         -- Detected or configured language

  -- Recording metadata
  duration_seconds REAL,                 -- Recording duration in seconds
  model_used TEXT DEFAULT 'gpt-4o-transcribe',

  -- Performance metrics
  transcription_ms INTEGER,             -- Time taken for transcription API call
  polish_ms INTEGER,                    -- Time taken for polish API call

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- Indexes for common query patterns
-- ============================================================

-- Primary query: "show me my recent transcriptions" (RLS filter + time sort)
CREATE INDEX idx_history_user_created
  ON public.transcription_history(user_id, created_at DESC);

-- Full-text search on transcription content (future feature)
-- Using GIN index for text search
CREATE INDEX idx_history_text_search
  ON public.transcription_history
  USING GIN (to_tsvector('english', COALESCE(original_text, '') || ' ' || COALESCE(optimized_text, '')));

-- Filter by app context
CREATE INDEX idx_history_app_context
  ON public.transcription_history(user_id, app_context)
  WHERE app_context IS NOT NULL;
```

### 2.3 `user_dictionary` Table (Future)

```sql
-- ============================================================
-- user_dictionary: Custom terms and replacements per user
-- For future use: auto-correct domain-specific terms
-- ============================================================
CREATE TABLE public.user_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  term TEXT NOT NULL,                    -- The term to match (e.g. "supabase")
  replacement TEXT NOT NULL,             -- What to replace it with (e.g. "Supabase")
  category TEXT DEFAULT 'general',       -- Category for organization (e.g. "tech", "medical", "names")

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Prevent duplicate terms per user
  UNIQUE(user_id, term)
);

CREATE INDEX idx_dictionary_user
  ON public.user_dictionary(user_id);

CREATE INDEX idx_dictionary_user_category
  ON public.user_dictionary(user_id, category);
```

### 2.4 Row Level Security Policies

```sql
-- ============================================================
-- Enable RLS on ALL tables
-- ============================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dictionary ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- user_profiles policies
-- ============================================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

-- Users can update their own profile (display_name only; email/id are immutable)
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Note: INSERT is handled by the trigger on auth.users, not by the user directly.
-- Note: DELETE cascades from auth.users deletion.

-- ============================================================
-- transcription_history policies
-- ============================================================

-- Users can read their own transcription history
CREATE POLICY "Users can view own history"
  ON public.transcription_history
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Users can insert their own transcription records
CREATE POLICY "Users can insert own history"
  ON public.transcription_history
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can delete their own transcription records
CREATE POLICY "Users can delete own history"
  ON public.transcription_history
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- No UPDATE policy: transcription records are immutable once created.
-- If a user wants to edit, they delete and the app can re-insert.

-- ============================================================
-- user_dictionary policies
-- ============================================================

-- Users can read their own dictionary
CREATE POLICY "Users can view own dictionary"
  ON public.user_dictionary
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Users can insert into their own dictionary
CREATE POLICY "Users can insert own dictionary entries"
  ON public.user_dictionary
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can update their own dictionary entries
CREATE POLICY "Users can update own dictionary entries"
  ON public.user_dictionary
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can delete their own dictionary entries
CREATE POLICY "Users can delete own dictionary entries"
  ON public.user_dictionary
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
```

### 2.5 RLS Performance Notes

From the official Supabase documentation, these optimizations are critical:

1. **Always wrap `auth.uid()` in a SELECT subquery**: `(SELECT auth.uid()) = user_id` is ~95% faster than `auth.uid() = user_id` because the subquery result is cached for the entire query.

2. **Always specify the role with `TO authenticated`**: This prevents the policy from being evaluated for the `anon` role, yielding ~99% improvement in benchmarks.

3. **Index the `user_id` column**: The composite index `(user_id, created_at DESC)` on `transcription_history` covers both the RLS filter and the most common sort order, yielding ~99.9% improvement.

4. **Add explicit `.eq('user_id', userId)` filters in application queries**: Even though RLS handles filtering, adding explicit filters helps the Postgres query planner choose the right index.

---

## 3. Auth Flow Design for Electron

### 3.1 Where the Supabase Client Lives

**Decision: Main Process**

The Supabase client MUST be initialized in the **main process** for the following reasons:

| Factor | Main Process | Renderer Process |
|--------|-------------|-----------------|
| Access to `electron-store` | Direct access (Node.js) | Only via IPC |
| Access to `safeStorage` | Direct access | Not available |
| Security | Tokens never exposed to renderer | Tokens in renderer memory |
| Network requests | Node.js fetch (no CORS) | Browser fetch (CORS possible) |
| Lifecycle | Persists across window close/reopen | Tied to window lifecycle |

```
Renderer (React)                Main Process
     |                              |
     |-- IPC: auth:sign-in -------->|
     |                              |-- supabase.auth.signInWithPassword()
     |                              |-- Stores session in electron-store
     |<-- IPC: result/error --------|
     |                              |
     |-- IPC: auth:get-session ---->|
     |                              |-- supabase.auth.getSession()
     |<-- IPC: session data --------|
```

### 3.2 Session Persistence with electron-store

Supabase's `createClient` accepts a custom `storage` adapter. For Electron, we use `electron-store` with encryption:

```typescript
// src/main/supabase-client.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Store from 'electron-store'
import { safeStorage } from 'electron'

const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbG...'  // Public anon key -- safe to embed

// Option A: electron-store with built-in encryption
const sessionStore = new Store({
  name: 'supabase-auth',
  encryptionKey: 'typeless-session-key-v1',  // Obfuscation, not true security
})

// Option B (Recommended): Use Electron's safeStorage for real OS-level encryption
// safeStorage uses macOS Keychain, Windows DPAPI, Linux secret stores
const secureStorage = {
  getItem: (key: string): string | null => {
    const encrypted = sessionStore.get(key) as string | undefined
    if (!encrypted) return null
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value).toString('base64')
      sessionStore.set(key, encrypted)
    } else {
      sessionStore.set(key, value)  // Fallback: store unencrypted
    }
  },
  removeItem: (key: string): void => {
    sessionStore.delete(key)
  },
}

let supabase: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,  // Critical for Electron: no URL-based session detection
        flowType: 'pkce',           // Use PKCE for better security
      },
    })
  }
  return supabase
}
```

**Key configuration decisions:**
- `detectSessionInUrl: false` -- Electron does not use URL fragments for auth tokens
- `autoRefreshToken: true` -- Automatically refreshes JWT before expiry
- `persistSession: true` -- Saves session to our custom storage
- `flowType: 'pkce'` -- More secure than implicit flow, required for OAuth

### 3.3 Auto-Refresh Token Management in Electron

From the Supabase docs: "On non-browser platforms the library is not able to effectively determine whether the application is focused or not." This means we must manually manage `startAutoRefresh` / `stopAutoRefresh`:

```typescript
// In main.ts, after app is ready:
import { BrowserWindow, app } from 'electron'
import { getSupabaseClient } from './supabase-client'

const supabase = getSupabaseClient()

// Start refresh when app launches
supabase.auth.startAutoRefresh()

// Optionally stop when all windows are hidden (tray app specific)
// For a tray app that's always running, we keep auto-refresh on.
// If battery/resource concerns arise:
app.on('before-quit', () => {
  supabase.auth.stopAutoRefresh()
})
```

Since Typeless is a tray app that runs continuously, keeping `autoRefreshToken: true` and calling `startAutoRefresh()` once at startup is the simplest approach. The refresh process checks every few seconds and refreshes close to expiry (default: 1 hour JWT lifetime).

### 3.4 Sign Up Flow

**Recommended: Disable email confirmation for MVP**

In the Supabase Dashboard, under Authentication > Providers > Email, disable "Confirm email". This means:
- Users sign up and are immediately logged in
- No email verification step (reduces friction for a desktop tool)
- Can be re-enabled later when email infrastructure is set up

```
User clicks "Sign Up" in settings window
  |
  v
Renderer sends IPC: auth:sign-up (email, password, displayName)
  |
  v
Main Process: supabase.auth.signUp({ email, password, options: { data: { display_name } } })
  |
  +-- Success: { user, session } returned
  |     - Session auto-persisted to electron-store
  |     - Trigger on auth.users auto-creates user_profiles row
  |     - Return { success: true, user } to renderer
  |
  +-- Error: AuthApiError
       - error.code === 'user_already_exists': "An account with this email already exists"
       - error.code === 'weak_password': "Password must be at least 6 characters"
       - error.code === 'email_provider_disabled': "Sign up is currently disabled"
       - error.code === 'over_request_limit' (429): "Too many requests, please wait"
       - Return { success: false, error: userFriendlyMessage } to renderer
```

**Password requirements** (configurable in Supabase Dashboard):
- Default minimum: 6 characters
- Can enforce stronger requirements via Dashboard settings

### 3.5 Sign In Flow

```
User clicks "Sign In" in settings window
  |
  v
Renderer sends IPC: auth:sign-in (email, password)
  |
  v
Main Process: supabase.auth.signInWithPassword({ email, password })
  |
  +-- Success: { user, session }
  |     - Session auto-persisted
  |     - Return { success: true, user } to renderer
  |     - Emit auth state change to update UI
  |
  +-- Error: AuthApiError
       - error.code === 'invalid_credentials': "Invalid email or password"
       - error.code === 'email_not_confirmed': "Please verify your email first"
       - error.code === 'user_banned': "Your account has been suspended"
       - 429 status: "Too many login attempts. Please wait and try again."
       - Network error: "Unable to connect. Please check your internet connection."
       - Return { success: false, error: userFriendlyMessage } to renderer
```

**Important note on error codes**: There is a known issue (GitHub issue #947 on supabase/auth-js) where `invalid_credentials` errors sometimes have `code: undefined`. Defensive handling should check both `error.code` and `error.message`:

```typescript
function getAuthErrorMessage(error: AuthApiError): string {
  // Check code first (preferred)
  switch (error.code) {
    case 'invalid_credentials':
      return 'Invalid email or password'
    case 'email_not_confirmed':
      return 'Please verify your email address first'
    case 'user_already_exists':
      return 'An account with this email already exists'
    case 'weak_password':
      return 'Password is too weak. Use at least 6 characters.'
    default:
      break
  }
  // Fallback: check message string (for the undefined code bug)
  if (error.message?.includes('Invalid login credentials')) {
    return 'Invalid email or password'
  }
  if (error.status === 429) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  return error.message || 'An unexpected error occurred'
}
```

### 3.6 Sign Out Flow

```
User clicks "Sign Out" in tray menu or settings window
  |
  v
Renderer sends IPC: auth:sign-out
  |
  v
Main Process:
  1. supabase.auth.signOut()
     - Clears session from electron-store
     - Invalidates refresh token on server
  2. Notify renderer of signed-out state
  3. Clear any cached user data in memory
```

Cleanup considerations:
- The `signOut()` call clears the persisted session from our custom storage adapter
- The `onAuthStateChange` listener fires with event `SIGNED_OUT`
- The renderer should reset any user-specific UI state
- Pending offline queue items should be kept (they belong to the user and can sync on next login)

### 3.7 Auth State Change Listener

Set up once in main process at app startup:

```typescript
// In main process initialization
const supabase = getSupabaseClient()

const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => {
    // IMPORTANT: Do NOT use async callback (causes deadlocks per Supabase docs)
    // IMPORTANT: Do NOT call other Supabase methods inside this callback

    switch (event) {
      case 'INITIAL_SESSION':
        // Fired immediately after client creation with stored session
        // Use setTimeout to defer any Supabase calls
        setTimeout(() => {
          notifyRendererAuthState(session)
        }, 0)
        break

      case 'SIGNED_IN':
        setTimeout(() => {
          notifyRendererAuthState(session)
        }, 0)
        break

      case 'SIGNED_OUT':
        notifyRendererAuthState(null)
        break

      case 'TOKEN_REFRESHED':
        // Session refreshed automatically, no UI action needed
        // Session is already persisted by the storage adapter
        break

      case 'USER_UPDATED':
        setTimeout(() => {
          notifyRendererAuthState(session)
        }, 0)
        break
    }
  }
)

// Clean up on app quit
app.on('before-quit', () => {
  subscription.unsubscribe()
})
```

### 3.8 Auth Guard Pattern

Since Typeless uses a tray overlay (not a traditional routed app), the auth guard is simpler. There are two approaches depending on how the settings/history UI is implemented:

**Approach A: Separate Settings Window (Recommended)**

```
Tray Icon Click -> Open Settings Window
  |
  v
Settings Window loads -> checks auth state via IPC
  |
  +-- Authenticated: Show settings + history tabs
  |
  +-- Not authenticated: Show login/signup form
```

The settings window would use Zustand for auth state:

```typescript
// src/renderer/stores/auth-store.ts (for the settings window)
interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  checkSession: () => Promise<void>
}
```

**Approach B: Conditional Rendering in Overlay**

The overlay itself does not need auth guards -- it works the same whether logged in or not. The only difference is that transcription history gets saved when logged in.

**Critical insight**: The transcription pipeline should work identically whether the user is logged in or not. Saving to Supabase is a fire-and-forget side effect. The auth guard only matters for the settings/history UI, not the core transcription flow.

---

## 4. API Layer & IPC Channel Design

### 4.1 New IPC Channels

Add these to `src/shared/constants.ts`:

```typescript
export const IPC_CHANNELS = {
  // ... existing channels ...

  // Auth
  AUTH_SIGN_UP: 'auth:sign-up',
  AUTH_SIGN_IN: 'auth:sign-in',
  AUTH_SIGN_OUT: 'auth:sign-out',
  AUTH_GET_SESSION: 'auth:get-session',
  AUTH_GET_USER: 'auth:get-user',
  AUTH_STATE_CHANGED: 'auth:state-changed',      // main -> renderer push

  // History
  HISTORY_SAVE: 'history:save',                    // internal: main saves after transcription
  HISTORY_LIST: 'history:list',
  HISTORY_DELETE: 'history:delete',
  HISTORY_SEARCH: 'history:search',

  // User Profile
  PROFILE_GET: 'profile:get',
  PROFILE_UPDATE: 'profile:update',
} as const;
```

### 4.2 IPC Channel Patterns

| Channel | Direction | Type | Purpose |
|---------|-----------|------|---------|
| `auth:sign-up` | renderer -> main | `invoke` | Sign up with email/password |
| `auth:sign-in` | renderer -> main | `invoke` | Sign in with email/password |
| `auth:sign-out` | renderer -> main | `invoke` | Sign out |
| `auth:get-session` | renderer -> main | `invoke` | Check if user has active session |
| `auth:get-user` | renderer -> main | `invoke` | Get current user data |
| `auth:state-changed` | main -> renderer | `send` | Push auth state changes |
| `history:list` | renderer -> main | `invoke` | Get paginated history |
| `history:delete` | renderer -> main | `invoke` | Delete a history entry |
| `history:search` | renderer -> main | `invoke` | Search history by text |
| `profile:get` | renderer -> main | `invoke` | Get user profile |
| `profile:update` | renderer -> main | `invoke` | Update display name |

### 4.3 Preload Bridge Extensions

New methods to add to `ElectronAPI` in `src/shared/types.ts`:

```typescript
export interface AuthResult {
  success: boolean
  user?: {
    id: string
    email: string
    displayName: string
  }
  error?: string
}

export interface TranscriptionRecord {
  id: string
  original_text: string
  optimized_text: string | null
  app_context: string | null
  language: string | null
  duration_seconds: number | null
  created_at: string
}

export interface HistoryResult {
  data: TranscriptionRecord[]
  total: number
}

export interface ElectronAPI {
  // ... existing methods ...

  // Auth
  authSignUp: (email: string, password: string, displayName: string) => Promise<AuthResult>
  authSignIn: (email: string, password: string) => Promise<AuthResult>
  authSignOut: () => Promise<{ success: boolean; error?: string }>
  authGetSession: () => Promise<{ isAuthenticated: boolean; user?: AuthResult['user'] }>
  onAuthStateChanged: (callback: (user: AuthResult['user'] | null) => void) => Disposer

  // History
  historyList: (page: number, pageSize: number) => Promise<HistoryResult>
  historyDelete: (id: string) => Promise<{ success: boolean; error?: string }>
  historySearch: (query: string) => Promise<TranscriptionRecord[]>

  // Profile
  profileGet: () => Promise<{ displayName: string; email: string; trialEndsAt: string } | null>
  profileUpdate: (data: { displayName: string }) => Promise<{ success: boolean; error?: string }>
}
```

### 4.4 Should Supabase Calls Happen in Renderer or Main Process?

**Answer: Main Process only.**

Rationale:
1. **Security**: The main process has access to `electron-store` and `safeStorage` for secure token storage. The renderer should never handle raw auth tokens.
2. **Lifecycle**: The main process persists across window open/close. The overlay window hides frequently. The Supabase client's auto-refresh timer would be disrupted if it lived in the renderer.
3. **Architecture consistency**: The app already routes all external API calls (OpenAI) through the main process. Supabase should follow the same pattern.
4. **CORS avoidance**: Main process uses Node.js `fetch` which has no CORS restrictions.

### 4.5 Transcription Pipeline Integration

The existing transcription pipeline in `IPCHandler.register()` (specifically the `RECORDING_AUDIO_DATA` handler) needs a small addition after successful transcription:

```
CURRENT FLOW:
  audio data received
    -> transcriptionService.transcribe(buffer)
    -> textInjector.inject(text)
    -> send result to overlay
    -> hide overlay after 1.5s

MODIFIED FLOW:
  audio data received
    -> transcriptionService.transcribe(buffer)
    -> textInjector.inject(text)
    -> send result to overlay
    -> [NEW] historyService.saveTranscription(record).catch(console.error)  // fire-and-forget
    -> hide overlay after 1.5s
```

**Key design principles:**
- `saveTranscription()` is called with `.catch()` -- it must NEVER throw or block the main flow
- If the user is not logged in, `saveTranscription()` returns immediately (no-op)
- If the network is down, the record is added to an offline queue
- The save includes: `original_text`, `optimized_text`, `app_context` (from active window detection), `duration_seconds`, `model_used`, `transcription_ms`, `polish_ms`

**Getting app_context**: On macOS, the active application can be detected before recording starts. This can be done via:
```typescript
// Using Electron's BrowserWindow.getFocusedWindow() won't work (it's our overlay)
// Instead, use a native module or AppleScript:
import { execSync } from 'child_process'

function getActiveAppName(): string | null {
  try {
    const result = execSync(
      'osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\''
    ).toString().trim()
    return result
  } catch {
    return null
  }
}
```

### 4.6 Error Handling Patterns

All IPC handlers should follow a consistent result pattern:

```typescript
// Success case
{ success: true, data: ... }

// Error case
{ success: false, error: 'User-friendly error message' }
```

Network error handling:

```typescript
async function withNetworkErrorHandling<T>(
  fn: () => Promise<T>,
  fallbackMessage: string
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error) {
    if (error instanceof AuthApiError) {
      return { success: false, error: getAuthErrorMessage(error) }
    }
    if (error instanceof Error && error.message.includes('fetch')) {
      return { success: false, error: 'No internet connection. Please check your network.' }
    }
    return { success: false, error: fallbackMessage }
  }
}
```

---

## 5. Environment Variables & Build Configuration

### 5.1 Where to Store Supabase Credentials

There are two approaches, and Option A is recommended:

**Option A: Hardcode in source (Recommended)**

```typescript
// src/main/supabase-config.ts
export const SUPABASE_URL = 'https://xxxxx.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

**Why this is OK:**
- The anon key is designed to be public (like Firebase's API key)
- Security comes from RLS policies, not from key secrecy
- Simplest approach, no build configuration needed
- The key is embedded in the distributed app binary regardless of approach

**Why this is better than env vars for this case:**
- Environment variables in Electron Forge with Vite require coordination between three Vite configs
- The `VITE_` prefix only exposes vars to the renderer; the main process needs different handling
- For a desktop app, there is no "server" to keep secrets on -- the binary ships to users

**Option B: Vite define (for separation of concerns)**

If you prefer keeping credentials out of source code:

```typescript
// vite.main.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || 'https://xxx.supabase.co'),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || 'eyJ...'),
  },
})
```

And in `.env`:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Note: `electron-forge` with the Vite plugin loads `.env` via `dotenv` in `forge.config.ts`. For the main process Vite config, you would need to explicitly load it or use `define`.

### 5.2 Security Considerations

| Key | Where it lives | Security model |
|-----|---------------|----------------|
| `SUPABASE_URL` | Hardcoded in main process | Public, no concern |
| `SUPABASE_ANON_KEY` | Hardcoded in main process | Public by design. Security via RLS + JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | **NEVER in the app** | Must stay on server only. Bypasses RLS |
| User's auth session (JWT) | `electron-store` encrypted with `safeStorage` | OS-level encryption |
| User's OpenAI API key | `electron-store` (existing) | Consider migrating to `safeStorage` |

**What if someone extracts the anon key from the binary?**
- They can only make authenticated requests with a valid JWT
- RLS ensures they can only access their own data
- Rate limiting on the Supabase project prevents abuse
- This is the same security model as any web app where the key is in the JavaScript bundle

### 5.3 Production Build Behavior

With electron-forge + Vite:
1. `electron-forge make` runs Vite build for main, preload, and renderer
2. Vite statically replaces `import.meta.env.VITE_*` in renderer code
3. For main process, `process.env.*` values are replaced via `define` in `vite.main.config.ts`
4. The resulting JS files are bundled into an ASAR archive
5. The ASAR is signed and notarized (existing config in `forge.config.ts`)

Since we recommend hardcoding (Option A), no build configuration changes are needed.

---

## 6. Google OAuth Deep-Link Flow (Future)

This section documents the approach for adding Google OAuth in the future. It is not recommended for the initial implementation due to complexity.

### 6.1 Overview

The flow requires:
1. Opening the system browser for Google authentication
2. Google redirecting to Supabase
3. Supabase redirecting to a custom protocol (`typeless://auth/callback`)
4. Electron catching the deep link and exchanging the code for a session

### 6.2 Custom Protocol Registration

In `forge.config.ts`, add to `packagerConfig`:

```typescript
packagerConfig: {
  // ... existing config ...
  protocols: [
    {
      name: 'Typeless Auth',
      schemes: ['typeless'],
    },
  ],
}
```

In `main.ts`:

```typescript
// Register protocol handler (must be before app.ready on some platforms)
if (process.defaultApp) {
  app.setAsDefaultProtocolClient('typeless', process.execPath, [path.resolve(process.argv[1])])
} else {
  app.setAsDefaultProtocolClient('typeless')
}

// Handle deep link on macOS
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleAuthDeepLink(url)
})
```

### 6.3 OAuth Initiation

```typescript
import { shell } from 'electron'

async function signInWithGoogle() {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'typeless://auth/callback',
      queryParams: {
        access_type: 'offline',  // Request refresh token from Google
        prompt: 'consent',       // Force consent screen to get refresh token
      },
    },
  })

  if (data?.url) {
    // Open in system browser, NOT in Electron webview
    shell.openExternal(data.url)
  }
}
```

### 6.4 Handling the Callback

```typescript
async function handleAuthDeepLink(url: string) {
  const parsedUrl = new URL(url)

  if (parsedUrl.hostname === 'auth' && parsedUrl.pathname === '/callback') {
    const code = parsedUrl.searchParams.get('code')

    if (code) {
      // PKCE flow: exchange the authorization code for a session
      const supabase = getSupabaseClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('OAuth callback error:', error)
        // Show error to user
      } else {
        // Session is now established and persisted
        console.log('OAuth sign-in successful:', data.user?.email)
        // Bring app window to front
        BrowserWindow.getAllWindows().forEach(w => w.show())
      }
    }
  }
}
```

### 6.5 PKCE Limitation

**Critical**: The PKCE flow requires that `exchangeCodeForSession` is called from the same client that initiated `signInWithOAuth`, because the code verifier is stored locally. Since we initiate from the main process and the redirect comes back to the main process, this works correctly.

However, if you were to initiate the OAuth flow from a different process/machine, PKCE would fail. This is by design for security.

### 6.6 Supabase Dashboard Configuration for OAuth

1. In Google Cloud Console:
   - Create OAuth 2.0 Client ID (type: Web Application)
   - Add authorized redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

2. In Supabase Dashboard:
   - Authentication > Providers > Google
   - Enable Google provider
   - Enter Client ID and Client Secret from Google
   - Add `typeless://auth/callback` to Redirect URLs

3. In Supabase Dashboard:
   - Authentication > URL Configuration
   - Add `typeless://auth/callback` to Redirect URLs list

### 6.7 Why OAuth is Deferred

| Challenge | Description |
|-----------|------------|
| Development testing | Deep links only work in packaged apps, not during `electron-forge start` |
| Cross-platform | Custom protocol registration differs by OS |
| Error handling | Browser-to-app handoff can fail silently |
| User confusion | "Open Typeless?" browser prompt may confuse users |
| Maintenance | Google OAuth requires Google Cloud Console project management |

---

## 7. TypeScript Types & Supabase CLI

### 7.1 Generating Database Types

Supabase CLI can auto-generate TypeScript types from your database schema:

```bash
# Install Supabase CLI
npm install -D supabase

# Generate types
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/shared/database.types.ts
```

Add to `package.json`:
```json
{
  "scripts": {
    "update-types": "npx supabase gen types typescript --project-id \"$PROJECT_REF\" > src/shared/database.types.ts"
  }
}
```

### 7.2 Using Generated Types

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../shared/database.types'

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, { ... })

// Now all queries are fully typed:
const { data } = await supabase
  .from('transcription_history')  // Autocomplete for table names
  .select('*')
  .order('created_at', { ascending: false })
// data is typed as Database['public']['Tables']['transcription_history']['Row'][]
```

### 7.3 Manual Type Definition (Alternative)

If you prefer not to use the CLI, define types manually:

```typescript
// src/shared/database.types.ts
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          display_name: string | null
          email: string
          created_at: string
          updated_at: string
          trial_ends_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          email: string
          created_at?: string
          updated_at?: string
          trial_ends_at?: string
        }
        Update: {
          display_name?: string | null
          updated_at?: string
        }
      }
      transcription_history: {
        Row: {
          id: string
          user_id: string
          original_text: string
          optimized_text: string | null
          app_context: string | null
          language: string | null
          duration_seconds: number | null
          model_used: string | null
          transcription_ms: number | null
          polish_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          original_text: string
          optimized_text?: string | null
          app_context?: string | null
          language?: string | null
          duration_seconds?: number | null
          model_used?: string | null
          transcription_ms?: number | null
          polish_ms?: number | null
          created_at?: string
        }
        Update: never  // Immutable records
      }
      user_dictionary: {
        Row: {
          id: string
          user_id: string
          term: string
          replacement: string
          category: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          term: string
          replacement: string
          category?: string
          created_at?: string
        }
        Update: {
          term?: string
          replacement?: string
          category?: string
        }
      }
    }
  }
}
```

---

## 8. Implementation Checklist

### Phase 1: Foundation (Auth + Client Setup)

- [ ] Create Supabase project in dashboard
- [ ] Run the SQL from Section 2 to create tables, triggers, and RLS policies
- [ ] `npm install @supabase/supabase-js`
- [ ] Create `src/main/supabase-client.ts` with custom storage adapter
- [ ] Create `src/main/auth-service.ts` with signUp/signIn/signOut/getSession
- [ ] Add auth IPC channels to `src/shared/constants.ts`
- [ ] Add auth types to `src/shared/types.ts`
- [ ] Register auth IPC handlers in main process
- [ ] Add auth methods to preload bridge
- [ ] Test: sign up, sign in, sign out, session persistence across app restart

### Phase 2: History Saving

- [ ] Create `src/main/history-service.ts`
- [ ] Integrate `saveTranscription()` into the existing `RECORDING_AUDIO_DATA` handler (fire-and-forget)
- [ ] Add app_context detection (active app name via AppleScript)
- [ ] Add history IPC channels and handlers
- [ ] Add history methods to preload bridge
- [ ] Test: transcribe while logged in, verify record appears in Supabase Dashboard

### Phase 3: Settings/History Window (UI)

- [ ] Create a separate BrowserWindow for settings (or expand the tray menu)
- [ ] Build login/signup form component
- [ ] Build transcription history list component
- [ ] Build search functionality
- [ ] Connect UI to IPC channels via preload bridge
- [ ] Test: full user flow from sign up to viewing history

### Phase 4: Offline Queue

- [ ] Create `src/main/offline-queue.ts` using electron-store
- [ ] Modify `history-service.ts` to use offline queue on network failure
- [ ] Add queue flush on network recovery (periodic check or connectivity event)
- [ ] Add queue flush on auth state change (user logs in)
- [ ] Test: transcribe while offline, verify sync when online

### Phase 5 (Future): Google OAuth

- [ ] Follow Section 6 to set up custom protocol + Google Cloud Console + Supabase config
- [ ] Implement deep link handler
- [ ] Add "Sign in with Google" button to settings UI
- [ ] Test in packaged app (deep links do not work in dev mode)

---

## 9. Sources

### Official Supabase Documentation
- [Supabase Auth Overview](https://supabase.com/docs/guides/auth)
- [Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [JavaScript Client Initialization](https://supabase.com/docs/reference/javascript/initializing)
- [Row Level Security Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [User Sessions](https://supabase.com/docs/guides/auth/sessions)
- [PKCE Flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Auth Error Codes](https://supabase.com/docs/guides/auth/debugging/error-codes)
- [onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [startAutoRefresh](https://supabase.com/docs/reference/javascript/auth-startautorefresh)
- [Google OAuth Login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [General Auth Configuration](https://supabase.com/docs/guides/auth/general-configuration)
- [Redirect URLs Configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Generating TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types)
- [Native Mobile Deep Linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)

### Community Discussions
- [Best Practice for Supabase Google OAuth with Electron (GitHub Discussion #17722)](https://github.com/orgs/supabase/discussions/17722)
- [Authenticating Electron Users via Default Browser (GitHub Discussion #22270)](https://github.com/orgs/supabase/discussions/22270)
- [Electron Deep Link Auth Session Generation (GitHub Discussion #27181)](https://github.com/orgs/supabase/discussions/27181)
- [Authentication Persistence in Supabase (GitHub Discussion #11100)](https://github.com/orgs/supabase/discussions/11100)
- [Secure Storage of Sessions using Encryption (GitHub Discussion #3731)](https://github.com/orgs/supabase/discussions/3731)
- [Auth Error Code for invalid_credentials Missing (GitHub Issue auth-js #947)](https://github.com/supabase/auth-js/issues/947)

### Electron Documentation
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)

### Vite & Build Configuration
- [Vite Env Variables and Modes](https://vite.dev/guide/env-and-mode)
- [electron-vite Env Variables](https://electron-vite.org/guide/env-and-mode)
- [Electron Forge Vite Plugin](https://www.electronforge.io/config/plugins/vite)

### RLS Best Practices
- [Supabase Row Level Security Complete Guide 2026 (DesignRevision)](https://designrevision.com/blog/supabase-row-level-security)
- [Supabase Row Level Security Complete Guide 2026 (VibeAppScanner)](https://vibeappscanner.com/supabase-row-level-security)

### Supabase + Electron Guides
- [Supabase + Google OAuth in Tauri 2.0 macOS App with Deep Links](https://medium.com/@nathancovey/supabase-google-oauth-in-a-tauri-2-0-macos-app-with-deep-links-f8876375cb0a)
- [supabase-js on npm](https://www.npmjs.com/package/@supabase/supabase-js)
- [supabase-js on GitHub](https://github.com/supabase/supabase-js)
