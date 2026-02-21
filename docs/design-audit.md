# one% Design Audit: Landing Page Claims vs. Codebase Reality

**Date:** 2026-02-21
**Auditor:** Codebase Auditor Agent
**Scope:** All source files in `src/` compared against landing page marketing claims
**Method:** Full codebase read of every `.ts` and `.tsx` file in the project

---

## Part 1: Implemented Features (Keep)

These features are **confirmed working in the codebase** and can be honestly marketed on the landing page.

### 1.1 Voice-to-Text Transcription (Core Feature)
- **Files:** `src/main/transcription-service.ts`, `src/renderer/services/audio-recorder.ts`
- **Details:** Uses OpenAI `gpt-4o-transcribe` with automatic fallback to `whisper-1`. Records via browser MediaRecorder API (WebM/Opus at 128kbps). Fully functional end-to-end pipeline: hotkey -> record -> transcribe -> paste.

### 1.2 AI Polish / Filler Word Removal
- **File:** `src/main/transcription-service.ts:130-201`
- **Details:** Post-transcription LLM pass that removes filler words (um, uh, er, ah, etc. in English and Chinese), fixes punctuation, removes stuttered repetitions. Supports multiple LLM providers. This is a real, working feature.

### 1.3 Custom Dictionary
- **Files:** `src/main/dictionary-service.ts`, `src/main-app/pages/DictionaryPage.tsx`
- **Details:** Users can add custom words/phrases stored as local JSON files. Dictionary words are passed as prompts to the transcription API to improve recognition accuracy. Full CRUD UI with grid layout.

### 1.4 Global Hotkey (Press-to-Record)
- **Files:** `src/main/shortcut-manager.ts`, `src/main.ts:135-159`
- **Details:** Default hotkey is backtick (`` ` ``). Toggle to start/stop recording. ESC to cancel. With debounce protection (400ms).

### 1.5 Auto-Paste into Active App (macOS)
- **File:** `src/main/text-injector.ts`
- **Details:** Copies transcribed text to clipboard and simulates Cmd+V via `osascript`. Works in any active app on macOS. Requires Accessibility permission.

### 1.6 Overlay UI During Recording
- **Files:** `src/main/overlay-window.ts`, `src/renderer/components/Overlay.tsx`, `src/renderer/components/WaveformAnimation.tsx`
- **Details:** Floating transparent window with waveform animation, always-on-top, positioned at bottom-center near cursor. Shows recording/transcribing/done states.

### 1.7 System Tray App
- **File:** `src/main/tray-manager.ts`
- **Details:** Runs as tray app with status display, API key management, and quick access to main window.

### 1.8 Sound Effects for Recording Start/Stop
- **File:** `src/renderer/services/sound-effects.ts`
- **Details:** Synthesized audio tones using Web Audio API for recording start/stop feedback.

### 1.9 User Authentication (Email + Google OAuth)
- **Files:** `src/main/auth-service.ts`, `src/main/auth-ipc.ts`, `src/main-app/stores/auth-store.ts`, `src/main-app/pages/LoginPage.tsx`
- **Details:** Full sign-up, sign-in (email/password), Google OAuth with deep link callback. Supabase-backed with encrypted session storage via `safeStorage`.

### 1.10 Transcription History
- **Files:** `src/main/history-service.ts`, `src/main/local-history-service.ts`, `src/main-app/pages/HistoryPage.tsx`
- **Details:** Local JSON file storage with pagination. Tracks word count (CJK + Latin), duration, original vs. polished text. Syncs cumulative stats to Supabase.

### 1.11 User Dashboard with Stats
- **File:** `src/main-app/pages/DashboardPage.tsx`
- **Details:** Shows total transcriptions, total dictation time, and words dictated. Real-time updates when new transcriptions are saved.

### 1.12 User Profile Management
- **File:** `src/main/auth-ipc.ts:86-116`
- **Details:** Get/update profile (display name) via Supabase `user_profiles` table. Includes trial end date tracking.

### 1.13 Multi-Language Transcription
- **Files:** `src/main/transcription-service.ts:60-63`, `src/main/config-store.ts:8`
- **Details:** Language parameter passed to OpenAI Whisper/gpt-4o-transcribe. The polish prompt explicitly handles Chinese/English mixed content. However, there is no language picker UI or auto-detection.

### 1.14 Multiple Polish Provider Support
- **Files:** `src/main/transcription-service.ts:8-12`, `src/main/config-store.ts:43-48`
- **Details:** Supports OpenAI (GPT-4o-mini), Grok (grok-3-mini-fast), and Groq (Llama 3.3 70B). Configurable with model override.

---

## Part 2: NOT Yet Implemented (Remove or Mark "Coming Soon")

These features are **claimed on the landing page but DO NOT exist in the code**.

### 2.1 Context-Aware Formatting (Adapts to Slack/Gmail/VS Code)
- **Status: NOT IMPLEMENTED**
- The `app_context` field exists in the `TranscriptionRecord` type but is **always set to `null`** (`src/main/ipc-handlers.ts:103`). There is zero logic to detect the active application or adapt formatting. The text injector (`text-injector.ts`) does a blind clipboard paste with no awareness of the target app.
- **Landing page node IDs:** `5lge1`, `P6cd4`, `91kjQ`, `Xn0wE`, `NC9Nj`

### 2.2 Voice Commands
- **Status: NOT IMPLEMENTED**
- There is no voice command recognition, command parsing, or action execution anywhere in the codebase. The transcription pipeline is: record -> transcribe -> polish -> paste. No intermediate step interprets commands.
- **Landing page node IDs:** `ErM5Z`, `MI178`

### 2.3 Cross Platform: Windows, iOS, Android
- **Status: NOT IMPLEMENTED**
- The app is an **Electron desktop app only**. The text injector only has macOS paste simulation (`osascript`). The Windows path in `simulatePaste()` is a no-op (`resolve()` immediately at `text-injector.ts:32`). There are no iOS or Android builds, no React Native code, no mobile-specific code. **macOS is the only truly functional platform.**
- **Landing page node IDs:** `42aui`, `EouHs`, `1SFSo`

### 2.4 100+ Languages
- **Status: MISLEADING**
- The code passes a `language` parameter to OpenAI Whisper, which supports ~97 languages. However, there is no language selector UI, no language list, no auto-detection, and the polish prompt is specifically tuned for Chinese/English only. Claiming "100+" is inherited from Whisper's capability, not validated by one%.
- **Landing page node IDs:** `TAm1t`, `rloQ1`, `NPUjr`

### 2.5 Automatic Language Detection
- **Status: NOT IMPLEMENTED**
- Language is manually set in `config-store.ts`. No auto-detection logic exists.
- **Landing page node ID:** `0ST9y`

### 2.6 Seamless Language Mixing (Mid-Sentence Switching)
- **Status: NOT IMPLEMENTED as a feature**
- The polish prompt preserves mixed Chinese/English, but this is a prompt instruction, not a built feature. Whisper may or may not handle it well.
- **Landing page node ID:** `7gNRl`

### 2.7 Real-Time Translation
- **Status: NOT IMPLEMENTED**
- No translation service or translation logic exists anywhere in the codebase.
- **Landing page node ID:** `zHvnD`

### 2.8 Smart Formatting for Lists, Bullets, Headings
- **Status: NOT IMPLEMENTED**
- The polish prompt explicitly forbids restructuring text into lists or bullet points (`transcription-service.ts:181`).
- **Landing page node ID:** `wqXMS`

### 2.9 Priority Processing (Pro Feature)
- **Status: NOT IMPLEMENTED**
- No queuing, priority system, or tier-based processing exists. All users hit the same OpenAI API.
- **Landing page node ID:** `ZH0Q4`

### 2.10 Team Management (Pro Feature)
- **Status: NOT IMPLEMENTED**
- No team, organization, or multi-user features exist. Single-user auth only.
- **Landing page node ID:** `RZiCG`

### 2.11 Advanced AI Formatting (Pro Feature)
- **Status: NOT IMPLEMENTED**
- Same polish pipeline for all users. No tiered AI features.
- **Landing page node ID:** `x9zvf`

### 2.12 Referral Program / Affiliate Program
- **Status: UI ONLY, NOT FUNCTIONAL**
- `DashboardPage.tsx:74-113` shows referral and affiliate cards with buttons, but these are **purely decorative**. No referral links, tracking, credit systems, or affiliate management exists.

---

## Part 3: Typeless-Specific Content to Change

### 3.1 Exact Numbers Copied from Typeless

| Claim | Where Used | Code Evidence | Action |
|-------|-----------|---------------|--------|
| **220 WPM** | Hero subheadline (`04VEB`) | No speed benchmarking exists anywhere in codebase | **REMOVE** -- replace with "real-time" or "as fast as you speak" |
| **4,000 words/week** | Hero CTA (`ZMuAV`), Social Proof (`iaxjv`), Pricing Free tier (`66HO1`), FAQ (`see00`) | No usage metering, word count limits, or enforcement logic in code | **REMOVE** -- no usage limit system exists |
| **$12/month** | Pricing Pro tier (`74reZ`), FAQ (`see00`) | No payment integration (Stripe, etc.) or subscription management in code | **REMOVE** -- no payment system exists |
| **99.2% accuracy** / **98% accuracy** | FAQ (`qMeNk`) | No accuracy measurement or benchmarking code | **REMOVE** -- replace with "powered by OpenAI's latest models" |
| **100+ languages** | Core Features (`TAm1t`), Social Proof (`rloQ1`), Pricing (`NPUjr`) | Only `language` config param passed to Whisper; no validation or testing of 100+ languages | **REPLACE** with "multi-language support" |
| **10,000+ professionals** | Hero trust badge (`6Mcdy`) | App is at version 0.1.0 in early development | **REMOVE** -- fabricated claim |

### 3.2 "Typeless" Brand Name in Code (Not Landing Page)
The codebase itself still uses "Typeless" extensively -- these should also be renamed for consistency:

| File | Line | Content |
|------|------|---------|
| `package.json` | 2, 4 | `"productName": "Typeless"`, `"Typeless clone"` |
| `src/main.ts` | 23-25 | `app.setAsDefaultProtocolClient('typeless')` |
| `src/main.ts` | 73, 194 | `'=== Typeless Initializing ==='`, `'Typeless initialized'` |
| `src/main/tray-manager.ts` | 20, 34, 43 | `'Typeless - Voice to Text'`, `'Typeless - ${statusText}'`, `'Open Typeless'` |
| `src/main/auth-service.ts` | 9 | `"return to Typeless"` |
| `src/main-app/pages/DashboardPage.tsx` | 87 | `"$5 credit for Typeless Pro"` |
| `src/main-app/pages/DashboardPage.tsx` | 107 | `"sharing Typeless"` |
| `src/main-app/pages/DashboardPage.tsx` | 124 | `"How can Typeless be improved?"` |

### 3.3 Landing Page "Typeless" References (18 nodes)
Per the previous audit pass, these landing page nodes still contain "Typeless":
- `ljEnU`, `04VEB`, `rp47x`, `P6cd4`, `1VG7V`, `hYeSN`, `EouHs`
- `CJZSL`, `VfxBl`, `jw3Sp`, `BHFeB`, `dwBSp`, `YjgVh`, `DXYQZ`
- `see00`, `yVPer`, `D8WlX`, `qMeNk`

### 3.4 Fabricated Testimonials
All three testimonials are fictional people at real companies:

| Node IDs | Content | Problem |
|----------|---------|---------|
| `CJZSL`, `iPe25`, `q7rFi` | "Sarah Kim, PM at Stripe" | Fake person, real company |
| `VfxBl`, `2wVtO`, `5EQvs` | "Marcus Rivera, Senior Engineer at Vercel" | Fake person, real company |
| `jw3Sp`, `fkZ3N`, `noEBh` | "Ana Lopez, Content Lead at Notion" | Fake person, real company |

**Action:** Remove all testimonials until real user feedback exists. Using real company names with fabricated quotes could create legal issues.

---

## Part 4: Recommended Replacements

### 4.1 Hero Section
| Current | Replacement |
|---------|-------------|
| "220 WPM" stat | "Real-time transcription" or remove stat entirely |
| "Typeless turns your speech into polished text at 220 WPM..." | "one% captures your voice and delivers clean, polished text -- right where your cursor is." |
| "Download Free -- 4,000 Words/Week" | "Try one% Free" |
| "Trusted by 10,000+ professionals" | "Built for professionals who think faster than they type" or remove |
| "Now available on macOS, Windows, iOS & Android" | "Now available on macOS" |

### 4.2 Core Features -- Replace Context-Aware Card
The "Context-Aware Formatting" card (`5lge1`, `P6cd4`) should be replaced with a feature that actually exists. Suggestions:
- **"Smart AI Polish"** -- "Choose from multiple AI providers (OpenAI, Groq, Grok) to clean up your speech. Filler words disappear, punctuation appears, and your message stays authentic."
- **"Custom Vocabulary"** -- Promote the dictionary feature from the grid to a primary card.

### 4.3 Core Features -- Rewrite Language Card
| Current | Replacement |
|---------|-------------|
| "100+ Languages" | "Multi-Language Support" |
| "Speak in any language and Typeless understands..." | "Speak in English, Chinese, or dozens of other languages. one% uses state-of-the-art speech recognition for accurate transcription." |
| Remove: auto-detection, mid-sentence switching, real-time translation | These are not implemented |

### 4.4 Feature Grid Fixes
| Item | Action |
|------|--------|
| Voice Commands | **REMOVE** entirely |
| Cross Platform | Change to "macOS App" |
| Privacy First | Rewrite: "Your transcription history stays on your device. Audio is processed via OpenAI's API and immediately discarded." |
| Auto Formatting | Change to "AI-powered punctuation and cleanup" |
| Filler Word Removal | **KEEP** -- confirmed working |
| Custom Dictionary | **KEEP** -- confirmed working |

### 4.5 Social Proof Section
| Current | Replacement |
|---------|-------------|
| Fabricated testimonials | Remove entirely, or replace with use-case scenarios without fake attributions |
| "4,000 Free Words Every Week" | Remove specific number |
| "100+ Languages Supported" | "Multi-language support" |

### 4.6 Pricing Section
| Current | Replacement |
|---------|-------------|
| Free: 4,000 words/week, 100+ languages | "Free during beta -- all features included" |
| Pro: $12/month | "Pro plan coming soon" or remove pricing section entirely |
| Pro features: priority processing, team management, advanced AI formatting | Remove all -- none are implemented |

### 4.7 Privacy Claim (Important)
The landing page claims "privacy first / local processing" but the reality is:
- Audio is sent to **OpenAI's cloud API** for transcription
- Polish text is sent to **OpenAI/Grok/Groq cloud APIs**
- Auth data goes through **Supabase** (cloud)
- Stats are synced to **Supabase** (cloud)
- Dictionary and history are stored **locally** (true)
- Temp audio files are deleted after transcription (true)

**Honest claim:** "Your transcription history stays on your device. Audio is processed securely via OpenAI and never permanently stored."

### 4.8 FAQ Updates
| Question | Current Answer Issue | Fix |
|----------|---------------------|-----|
| "How does one% work?" | References Typeless | Replace brand name |
| "What languages?" | Claims "100 languages" and auto-detection | Say "multiple languages including English and Chinese" |
| "Can I try free?" | Quotes Typeless's exact pricing ($12/mo, 4000 words) | Use your own pricing or say "free during beta" |
| "How accurate?" | Claims "98% accuracy" | Say "powered by OpenAI's latest transcription models" |
| "Privacy?" | Claims local processing | Be honest about cloud APIs |

---

## Part 5: Severity Summary

| Severity | Count | Category |
|----------|-------|----------|
| **CRITICAL** | 6 | Major features claimed but not implemented (context-aware formatting, voice commands, real-time translation, mobile apps, team management, priority processing) |
| **HIGH** | 18 | "Typeless" brand name still in landing page nodes |
| **HIGH** | 8 | Exact Typeless stats/pricing copied (220 WPM, 4000 words, $12/mo, 100+ languages, 98% accuracy, 10000+ users) |
| **HIGH** | 6 | Fabricated testimonials with real company names (legal risk) |
| **MEDIUM** | 8 | "Typeless" brand name in source code files |
| **MEDIUM** | 3 | Partially implemented features over-promised (language support, auto formatting, cross-platform) |
| **LOW** | 2 | Privacy claims need nuance |

**Total issues: 51**

### Top 5 Priority Fixes
1. **Remove all fabricated social proof** -- testimonials with real company names are a legal liability
2. **Remove or rewrite pricing** -- no payment system exists; don't copy Typeless's exact numbers
3. **Remove voice commands and context-aware formatting claims** -- these are not implemented at all
4. **Change platform claim to macOS only** -- Windows/iOS/Android don't work
5. **Replace all 18 "Typeless" references** in the landing page with "one%"
