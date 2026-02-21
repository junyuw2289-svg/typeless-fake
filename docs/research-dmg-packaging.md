# DMG Packaging Without Notarization + Environment Variables in Production

> Research Report | 2026-02-20
> Scope: Electron Forge DMG packaging without Apple notarization, and environment variable handling for Supabase keys in production builds

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Build Configuration Changes](#2-build-configuration-changes)
3. [Environment Variables in Production](#3-environment-variables-in-production)
4. [Build and Test Steps](#4-build-and-test-steps)
5. [User Experience for Unsigned Apps](#5-user-experience-for-unsigned-apps)
6. [Recommendations](#6-recommendations)
7. [References](#7-references)

---

## 1. Current State Analysis

### 1.1 Current forge.config.ts

The current configuration at `/Users/junyu/coding/typeless-fake/forge.config.ts` has:

- **osxSign**: Configured with `identity: 'Developer ID Application'`, hardened runtime, and entitlements
- **osxNotarize**: Requires `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID` environment variables
- **MakerDMG**: Format `ULFO`, icon from `./assets/icon.icns`
- **FusesPlugin**: Has `EnableEmbeddedAsarIntegrityValidation: true` and `OnlyLoadAppFromAsar: true`
- **dotenv**: Loaded at config level for Apple signing credentials

### 1.2 Current .env File

The `.env` file currently only contains Apple signing credentials (`APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID`). There are no Supabase variables yet.

### 1.3 Current Vite Configs

Both `vite.main.config.ts` and `vite.renderer.config.ts` are empty (`defineConfig({})`). No `define` options, no `envPrefix` customization, no environment variable handling.

### 1.4 Current Code Environment Variable Usage

- **Main process**: Does NOT use `process.env` or `import.meta.env` anywhere in `src/`. The OpenAI API key is stored in `electron-store` (persisted user config), not environment variables.
- **Renderer process**: Does NOT use `import.meta.env` anywhere currently.
- **Forge config**: Uses `dotenv` + `process.env` for Apple signing credentials only.

---

## 2. Build Configuration Changes

### 2.1 Disabling Notarization

**How it works**: In Electron Forge, `osxNotarize` in `packagerConfig` triggers Apple notarization during the Package step. If `osxNotarize` is absent or undefined, notarization is skipped entirely.

**Change**: Remove or conditionally exclude the `osxNotarize` block.

```typescript
// Option A: Remove entirely
packagerConfig: {
  asar: true,
  appBundleId: 'com.junyuwang.typeless',
  // ... other config
  // osxNotarize: removed
},

// Option B: Conditional based on environment (RECOMMENDED)
packagerConfig: {
  asar: true,
  appBundleId: 'com.junyuwang.typeless',
  // ... other config
  ...(process.env.APPLE_ID ? {
    osxNotarize: {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD!,
      teamId: process.env.APPLE_TEAM_ID!,
    },
  } : {}),
},
```

### 2.2 Code Signing: Keep vs Disable

There are three options:

#### Option A: Remove osxSign entirely (No signing at all)

```typescript
packagerConfig: {
  asar: true,
  // osxSign: removed
  // osxNotarize: removed
},
```

- **Pros**: Simplest. No Developer ID certificate needed.
- **Cons**: On Apple Silicon (M1+), macOS requires at least ad-hoc signing. Electron Packager will typically ad-hoc sign automatically if no osxSign is specified. However, the app will be treated as "unidentified developer" by Gatekeeper.

#### Option B: Ad-hoc signing (RECOMMENDED for development/testing)

When `osxSign` is **omitted** from the config, Electron Packager does NOT sign the app. However, on Apple Silicon Macs, the binary needs at least an ad-hoc signature to run. macOS will usually auto-apply an ad-hoc signature on first launch if the quarantine attribute is removed.

To explicitly ad-hoc sign:

```typescript
packagerConfig: {
  asar: true,
  osxSign: {
    identity: '-',  // '-' means ad-hoc signing
  },
  // No osxNotarize
},
```

- **Pros**: App runs on Apple Silicon without extra steps. No Apple Developer account needed.
- **Cons**: Still triggers Gatekeeper warnings. Users must bypass Gatekeeper.

#### Option C: Keep Developer ID signing, skip notarization only

```typescript
packagerConfig: {
  asar: true,
  osxSign: {
    identity: 'Developer ID Application',
    'hardened-runtime': true,
    entitlements: 'entitlements.plist',
    'entitlements-inherit': 'entitlements.plist',
  },
  // osxNotarize: removed
},
```

- **Pros**: App is properly signed (reduces Gatekeeper friction). Users see "identified developer" instead of "unidentified developer."
- **Cons**: Requires a valid Developer ID certificate. Without notarization, macOS Sequoia (15+) will still show warnings and require the "Open Anyway" flow.

### 2.3 FusesPlugin Considerations

The current config has two fuses that interact with code signing:

```typescript
[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
[FuseV1Options.OnlyLoadAppFromAsar]: true,
```

**Important findings**:

- `EnableEmbeddedAsarIntegrityValidation` validates ASAR contents via SHA256 hashes. This is **not dependent on code signing** -- it uses hashes embedded in the ASAR bundle by Electron Forge/Packager at build time.
- This fuse should work fine with unsigned apps as long as `@electron/asar` (used by Electron Forge) properly generates the integrity hashes. Electron Forge handles this automatically.
- The fuse only functions on macOS; it does nothing on other platforms.
- There have been reports of this fuse causing instant app exit on macOS when the ASAR hashes are not properly generated (GitHub issue electron/fuses#7). This was a tooling issue with electron-builder, NOT Electron Forge.

**Recommendation**: Keep both fuses enabled. They should work with unsigned/ad-hoc-signed apps. If the app fails to launch, try setting `EnableEmbeddedAsarIntegrityValidation` to `false` as a diagnostic step.

### 2.4 Recommended forge.config.ts Changes

```typescript
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import dotenv from 'dotenv';

dotenv.config();

// Determine if we should sign and notarize
const shouldSign = !!process.env.APPLE_ID;

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.junyuwang.typeless',
    appCategoryType: 'public.app-category.productivity',
    icon: './assets/icon.icns',
    extendInfo: {
      NSMicrophoneUsageDescription: '...',
      NSAppleEventsUsageDescription: '...',
    },
    // Conditional signing
    ...(shouldSign ? {
      osxSign: {
        identity: 'Developer ID Application',
        'hardened-runtime': true,
        entitlements: 'entitlements.plist',
        'entitlements-inherit': 'entitlements.plist',
      },
      osxNotarize: {
        tool: 'notarytool',
        appleId: process.env.APPLE_ID!,
        appleIdPassword: process.env.APPLE_ID_PASSWORD!,
        teamId: process.env.APPLE_TEAM_ID!,
      },
    } : {
      // Ad-hoc signing for unsigned builds (required for Apple Silicon)
      osxSign: {
        identity: '-',
      },
    }),
  },
  // ... rest of config
};
```

**Key insight**: When `APPLE_ID` is not set in the environment, the config will use ad-hoc signing (`identity: '-'`) and skip notarization entirely. When `APPLE_ID` is set, it will do full signing + notarization.

---

## 3. Environment Variables in Production

### 3.1 How Vite VITE_ Variables Work in the Renderer

**Mechanism**: Vite uses `dotenv` to load `.env` files, then **statically replaces** references to `import.meta.env.VITE_*` in source code at build time. The values are literally string-replaced into the compiled JavaScript bundle.

**Key facts**:
- Only variables prefixed with `VITE_` are exposed to client (renderer) code
- They are accessed via `import.meta.env.VITE_SOME_KEY`
- At build time, `import.meta.env.VITE_SOME_KEY` is replaced with the literal string value (e.g., `"https://xyz.supabase.co"`)
- The values are **baked into the bundle** -- they cannot be changed after build
- `.env` files are loaded in priority order: `.env` < `.env.local` < `.env.[mode]` < `.env.[mode].local`
- Production build (`vite build`) loads `.env.production` if it exists

**For the renderer (Supabase client in browser context)**:
```
# .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

```typescript
// src/renderer/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

After Vite builds, the compiled JS will contain the literal strings:
```javascript
const supabase = createClient(
  "https://your-project.supabase.co",
  "eyJhbGciOiJIUzI1NiIs..."
)
```

### 3.2 Environment Variables in the Main Process

**Critical difference**: The Electron main process is also built by Vite (via `@electron-forge/plugin-vite`), but it uses `vite.main.config.ts`. The Vite plugin for Electron Forge bundles the main process code.

**How it differs from the renderer**:
- `import.meta.env.VITE_*` variables **do work** in the main process when built by Vite -- Vite performs the same static replacement
- `process.env.*` does NOT work the same way: at build time, Vite does not replace `process.env.X` by default. At runtime in a packaged app, `process.env` only contains system environment variables, NOT `.env` file values
- The Electron Forge Vite plugin defines special globals like `MAIN_WINDOW_VITE_DEV_SERVER_URL` and `MAIN_WINDOW_VITE_NAME` (these are injected via Vite's `define` config)

**Three approaches for main process env vars**:

#### Approach A: Use VITE_ prefix (works for both main and renderer)

Since both main and renderer are built by Vite, `import.meta.env.VITE_*` works in both. This is the simplest approach.

```typescript
// Works in src/main/*.ts (built by vite.main.config.ts)
const url = import.meta.env.VITE_SUPABASE_URL;
```

**Caveat**: You may need to add TypeScript declarations:
```typescript
// src/env.d.ts
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
```

#### Approach B: Use Vite's `define` option for compile-time replacement

In `vite.main.config.ts`:
```typescript
import { defineConfig } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  define: {
    'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
  },
});
```

This replaces `process.env.SUPABASE_URL` in source code with the literal string at build time.

**Warning**: Do NOT use `define: { 'process.env': process.env }` as this would leak ALL environment variables (including secrets) into the bundle.

#### Approach C: Hardcode the values directly in source code

Since Supabase anon keys are designed to be public (security comes from RLS, not key secrecy), hardcoding is acceptable:

```typescript
// src/main/supabase-config.ts
export const SUPABASE_URL = 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...';
```

### 3.3 Best Practice for Supabase Keys

**Background**: Supabase anon keys are explicitly designed to be public. Per Supabase documentation:
> "The anon key is designed to be used in your client-side applications, like your frontend JavaScript code, mobile apps, or any untrusted environment. It grants limited access... Security doesn't depend on key secrecy, but on Row Level Security (RLS) policies."

**Recommendation for this project**:

1. **For the renderer** (where the Supabase client will likely live): Use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` files. Access via `import.meta.env.VITE_SUPABASE_URL`. They get baked into the bundle at build time.

2. **For the main process** (if Supabase client is initialized there per the existing research doc's recommendation): Use the same `import.meta.env.VITE_SUPABASE_URL` approach, OR hardcode the values directly. Both are acceptable since anon keys are public.

3. **Never put the service_role key** in client code. If you need server-side operations, use Supabase Edge Functions.

4. **dotenv in main process at runtime**: Do NOT rely on `dotenv` in a packaged Electron app. The `.env` file won't be bundled into the ASAR archive. Environment variables must be resolved at **build time** (via Vite's static replacement) or hardcoded.

### 3.4 How the Build Pipeline Actually Works

```
Source Code (.ts files)
    |
    v
Vite Build (reads .env, performs static replacement)
    |
    +-- vite.main.config.ts    --> .vite/build/main.js    (main process bundle)
    +-- vite.preload.config.ts --> .vite/build/preload.js  (preload bundle)
    +-- vite.renderer.config.ts --> .vite/renderer/         (renderer bundle)
    |
    v
Electron Packager (creates .app bundle with ASAR)
    |
    v
electron-osx-sign (signs if osxSign configured)
    |
    v
electron-notarize (notarizes if osxNotarize configured)
    |
    v
MakerDMG (creates .dmg from signed .app)
```

**Important**: `.env` files are read by Vite at step 1 (build time). They are NOT included in the packaged app. The values are baked into the JavaScript bundles as string literals. After packaging, the `.env` file is irrelevant.

### 3.5 Needed Changes to Vite Configs

To support Supabase environment variables:

**vite.renderer.config.ts** -- No changes needed. Vite automatically picks up `VITE_*` variables from `.env` and makes them available via `import.meta.env`.

**vite.main.config.ts** -- Also no changes needed if using `import.meta.env.VITE_*`. Vite handles this automatically.

**However**, if you want the main process to use `process.env.SUPABASE_URL` syntax instead:

```typescript
// vite.main.config.ts
import { defineConfig } from 'vite';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  define: {
    'process.env.SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
    'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ''),
  },
});
```

### 3.6 Updated .env File Structure

```bash
# Apple Developer (for signed builds only)
APPLE_ID=your-apple-id@example.com
APPLE_ID_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX

# Supabase (baked into app at build time -- these are public keys)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## 4. Build and Test Steps

### 4.1 Build Commands

#### Unsigned DMG (no Apple credentials needed):

```bash
# Clean previous builds
rm -rf out/

# Build DMG without signing credentials
# (When APPLE_ID is not set, forge.config.ts should skip signing/notarization)
unset APPLE_ID APPLE_ID_PASSWORD APPLE_TEAM_ID
npm run make

# Output: out/make/Typeless-0.1.0-arm64.dmg
```

#### Signed but not notarized DMG:

```bash
# Clean
rm -rf out/

# Only set signing env vars, remove notarization trigger
# (Requires modifying forge.config.ts to separate sign from notarize)
export APPLE_ID=""  # Empty = skip notarization in conditional config
npm run make
```

#### Fully signed + notarized DMG:

```bash
rm -rf out/
source .env  # Loads APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID
npm run make
```

### 4.2 Testing the DMG

#### On the build machine:

```bash
# 1. Mount the DMG
open out/make/Typeless-0.1.0-arm64.dmg

# 2. Copy to Applications
cp -R /Volumes/Typeless/Typeless.app /Applications/

# 3. If unsigned, remove quarantine attribute
xattr -r -d com.apple.quarantine /Applications/Typeless.app

# 4. Launch
open /Applications/Typeless.app
```

#### On a clean macOS system (the real test):

1. Transfer the DMG to the test machine (AirDrop, USB, download)
2. Double-click to mount
3. Drag `Typeless.app` to `/Applications`
4. Try to open -- Gatekeeper will block it
5. Follow the bypass steps (see Section 5)
6. Verify all features: overlay, recording, transcription, keyboard shortcuts
7. Verify microphone permission prompt appears
8. Verify accessibility permission prompt appears

#### Verification commands:

```bash
# Check if the app is signed
codesign -dvv /Applications/Typeless.app

# For ad-hoc signed:
# "Signature=adhoc"

# For Developer ID signed:
# "Authority=Developer ID Application: ..."

# Check ASAR integrity
# (App should launch without crashing)

# Check entitlements
codesign -d --entitlements - /Applications/Typeless.app
```

### 4.3 Common Gotchas

#### Gotcha 1: Gatekeeper Quarantine Attribute

When a file is downloaded from the internet (browser, AirDrop, email), macOS adds the `com.apple.quarantine` extended attribute. This triggers Gatekeeper checking on first launch.

**Solution**: Users must remove it manually:
```bash
xattr -r -d com.apple.quarantine /Applications/Typeless.app
```

#### Gotcha 2: macOS Sequoia (15+) Stricter Enforcement

Starting with macOS Sequoia 15.0, Apple removed the ability to Control-click to bypass Gatekeeper. In macOS 15.1, unsigned apps are even more restricted.

**Impact**: Users on Sequoia must either:
- Use the Settings > Privacy & Security > "Open Anyway" button
- Remove the quarantine attribute via Terminal
- The app needs at minimum an ad-hoc signature on Apple Silicon

#### Gotcha 3: Apple Silicon Requires Signing

On M1/M2/M3 Macs, all executables must be signed (even ad-hoc) to run. If you omit `osxSign` entirely and the quarantine flag is present, the app will not launch at all.

**Solution**: Always use at least ad-hoc signing (`identity: '-'`) when building for Apple Silicon.

#### Gotcha 4: DMG Signing (Don't Do It)

DMG files themselves should NOT be signed/notarized separately from the .app inside them. The .app is what gets signed. Signing the DMG can actually cause errors.

From electron-builder docs: "Starting in electron-builder 20.43.0, DMGs are unsigned by default." Electron Forge's MakerDMG also does not sign the DMG itself.

#### Gotcha 5: Missing Icon File

The config references `./assets/icon.icns`. If this file doesn't exist, the build will fail. Either create the icon or remove the `icon` property from the config.

#### Gotcha 6: Environment Variables Not Available at Runtime

A common mistake: assuming `.env` values are available at runtime in the packaged app. They are NOT. The `.env` file is consumed by Vite at build time. The packaged app's `process.env` only contains system-level environment variables.

If your code does `process.env.VITE_SUPABASE_URL` at runtime (not via Vite's static replacement), it will be `undefined`.

#### Gotcha 7: dotenv in forge.config.ts

The `dotenv.config()` call at the top of `forge.config.ts` runs during the build process (when `electron-forge make` executes). This is fine for build-time configuration. But if any code in `src/` does `require('dotenv').config()`, it will fail in the packaged app because:
1. The `.env` file is not in the ASAR archive
2. The working directory of the packaged app is not the project root

---

## 5. User Experience for Unsigned Apps

### 5.1 What Happens When Users Open an Unsigned App

#### macOS Sonoma (14) and earlier:

1. User double-clicks the app
2. Dialog: "Typeless can't be opened because it is from an unidentified developer"
3. User goes to System Settings > Privacy & Security
4. Finds "Open Anyway" button next to the blocked app name
5. Clicks "Open Anyway"
6. Second dialog: "macOS cannot verify that this app is free from malware"
7. User clicks "Open"
8. App launches

#### macOS Sequoia (15.0):

Same as above, but the old Control-click > Open bypass no longer works. Users must use the Settings route.

#### macOS Sequoia (15.1+):

Even stricter. The "Open Anyway" button may not appear for completely unsigned apps. The most reliable method is the Terminal command:

```bash
xattr -r -d com.apple.quarantine /Applications/Typeless.app
```

### 5.2 Recommended Instructions for Users

Include these instructions with your download:

```
## Installation Instructions

1. Download Typeless.dmg
2. Double-click to open the DMG
3. Drag Typeless to your Applications folder
4. IMPORTANT: Before opening, run this command in Terminal:

   xattr -r -d com.apple.quarantine /Applications/Typeless.app

5. Open Typeless from Applications
6. Grant Microphone access when prompted
7. Grant Accessibility access when prompted
   (System Settings > Privacy & Security > Accessibility)
```

### 5.3 Alternative: Distribute as ZIP Instead of DMG

A ZIP file may have slightly different Gatekeeper behavior. When extracted by macOS Archive Utility, the quarantine attribute is typically preserved. However, some third-party unzip tools may not set the quarantine attribute, making the app easier to open.

---

## 6. Recommendations

### 6.1 Immediate Plan (Phase 7 - DMG Packaging)

1. **Modify `forge.config.ts`** to conditionally enable signing/notarization based on `APPLE_ID` presence
2. **Use ad-hoc signing** (`identity: '-'`) as the fallback when no Apple credentials are provided
3. **Keep FusesPlugin** as-is (including `EnableEmbeddedAsarIntegrityValidation`)
4. **Add Supabase env vars** to `.env` with `VITE_` prefix
5. **Use `import.meta.env.VITE_SUPABASE_URL`** in both renderer and main process code
6. **Update `.env.example`** to include Supabase variable templates
7. **Build with**: `unset APPLE_ID && npm run make` for unsigned builds

### 6.2 Environment Variable Strategy

| Variable | Where Used | How to Access | Baked at Build Time? |
|----------|-----------|---------------|---------------------|
| `VITE_SUPABASE_URL` | Renderer + Main | `import.meta.env.VITE_SUPABASE_URL` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Renderer + Main | `import.meta.env.VITE_SUPABASE_ANON_KEY` | Yes |
| `APPLE_ID` | forge.config.ts only | `process.env.APPLE_ID` | N/A (build config) |
| `APPLE_ID_PASSWORD` | forge.config.ts only | `process.env.APPLE_ID_PASSWORD` | N/A (build config) |
| `APPLE_TEAM_ID` | forge.config.ts only | `process.env.APPLE_TEAM_ID` | N/A (build config) |
| OpenAI API Key | Main (runtime) | `electron-store` (user input) | No (runtime) |

### 6.3 Security Considerations

- **Supabase anon key**: Safe to embed in client code. Security relies on RLS policies, not key secrecy.
- **Supabase service_role key**: NEVER embed in client code. Use Edge Functions for server-side operations.
- **OpenAI API key**: Currently stored in `electron-store` (user provides it). This is the correct approach -- do not hardcode.
- **Apple credentials**: Only used at build time in `forge.config.ts`. Never bundled into the app.

### 6.4 Future Consideration: Full Signing + Notarization

For production distribution to real users, the recommended path is:
1. Obtain a Developer ID certificate ($99/year Apple Developer Program)
2. Set up the Apple credentials in `.env`
3. Build with `source .env && npm run make`
4. The conditional config will automatically enable signing + notarization
5. Users can install without any Terminal commands

---

## 7. References

### Electron Forge Documentation
- [Signing a macOS app](https://www.electronforge.io/guides/code-signing/code-signing-macos)
- [DMG Maker Configuration](https://www.electronforge.io/config/makers/dmg)
- [Vite Plugin](https://www.electronforge.io/config/plugins/vite)
- [Fuses Plugin](https://www.electronforge.io/config/plugins/fuses)
- [Configuration Overview](https://www.electronforge.io/config/configuration)

### Electron Documentation
- [Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [ASAR Integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity)
- [Electron Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)
- [Packaging Your Application](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging)

### Vite Documentation
- [Env Variables and Modes](https://vite.dev/guide/env-and-mode)

### Supabase Documentation
- [Understanding API Keys](https://supabase.com/docs/guides/api/api-keys)
- [How to use Supabase with Electron](https://bootstrapped.app/guide/how-to-use-supabase-with-electron-for-desktop-apps)

### macOS Gatekeeper / Unsigned Apps
- [How to run unsigned apps in macOS 15.1](https://ordonez.tv/2024/11/04/how-to-run-unsigned-apps-in-macos-15-1/)
- [macOS Sequoia Gatekeeper changes](https://www.idownloadblog.com/2024/08/07/apple-macos-sequoia-gatekeeper-change-install-unsigned-apps-mac/)
- [Apple Forces Signing in macOS Sequoia 15.1](https://hackaday.com/2024/11/01/apple-forces-the-signing-of-applications-in-macos-sequoia-15-1/)
- [macOS 15.1 removes ability to launch unsigned apps (discussion)](https://forums.macrumors.com/threads/macos-15-1-completely-removes-ability-to-launch-unsigned-applications.2441792/)

### GitHub Issues
- [EnableEmbeddedAsarIntegrityValidation exits app on macOS (electron/fuses#7)](https://github.com/electron/fuses/issues/7)
- [Code Signing and Notarizing macOS (electron/forge#1692)](https://github.com/electron/forge/issues/1692)
- [Mac Code Signing Error (electron/forge#3252)](https://github.com/electron/forge/issues/3252)
