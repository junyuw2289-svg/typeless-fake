# Pencil <-> React Cross-Validation Report

Generated: 2026-02-21

---

## Login Page (m7qTP)

### Matches

- **Overall layout**: Vertical flex column, centered content in a 520px container -- matches `.pen` `width:520` container inside a `fill_container` body with `justifyContent:"center"`.
- **Logo emoji**: `🎙️` at `fontSize:48` -- code has `text-[48px]`.
- **Title text**: "Welcome to Typeless" in Instrument Serif at 38px with `-0.6px` letter-spacing -- code has `font-heading text-[38px] tracking-[-0.6px] leading-[1.2]`.
- **Pro badge**: "Pro" text in `#d97757` at 12px font-medium, background `rgba(217,119,87,0.15)`, `cornerRadius:6`, padding `[4,8]` -- code has `rounded-[6px] bg-[rgba(217,119,87,0.15)] px-[8px] py-[4px]`.
- **Subtitle**: "Voice keyboard that makes you smarter" in DM Sans 15px, `#b0aea5`, `leading-[1.5]`, centered -- matches.
- **Button layout**: Three auth buttons, each `height:50`, `cornerRadius:12`, border `#e8e6dc`, `gap:8` between icon and text, `fontSize:15`, `fontWeight:500` -- code matches dimensions and border styling.
- **Button text content**: "Continue with Google", "Continue with email", "Continue with Apple" -- matches.
- **Divider**: `height:1`, `fill:#e8e6dc`, `width:fill_container` -- code has `h-[1px] w-full bg-[var(--border-light)]` where `--border-light:#e8e6dc`.
- **Feature card backgrounds**: `rgba(217,119,87,0.12)`, `rgba(147,130,220,0.12)`, `rgba(72,160,120,0.12)` -- code matches.
- **Feature card structure**: `cornerRadius:16`, `padding:24`, `gap:12`, `clip:true`, `border:#f0ede4` -- code has `rounded-[16px] p-[24px] gap-[12px] overflow-hidden border-[var(--border-card)]` where `--border-card:#f0ede4`.
- **Feature card titles**: "Voice to Text", "AI Personalization", "Save Time" in Instrument Serif 18px -- code has `font-heading text-[18px]`.
- **Feature card descriptions**: 13px, DM Sans, `#8a8880`, `leading-[1.5]`, `height:80`, centered -- code has `h-[80px] w-full text-[13px] text-[var(--text-secondary)]` where `--text-secondary:#8a8880`.
- **Feature emojis**: `🎤`, `✨`, `⏱` -- matches.
- **Footer terms text**: "By signing up, you agree to the / Terms of Service / and / Privacy Policy" -- content matches.
- **Footer version**: "Version v1.0.2" and "Check for updates" in proper colors -- matches.
- **Container gap**: `gap:32` -- code has `gap-[32px]`.
- **Icon circle dimensions**: `width:48 height:48 cornerRadius:24` -- code has `h-[48px] w-[48px] rounded-[24px]`.

### Discrepancies

1. **[LAYOUT] Login page missing Window Chrome bar**
   - Pencil: Has a `Window Chrome` bar (`fill:#f2f1ec`, `height:52`, `padding:20`) with 3 traffic light dots (red `#ff5f57`, yellow `#febc2e`, green `#28c840`, each `12x12 cornerRadius:6 gap:8`) at the top of the page frame.
   - Code: No window chrome bar rendered in `LoginPage.tsx`. The page starts directly with the centered content. (Note: likely handled at the Electron/app shell level, but it IS part of the .pen design for this page frame.)

2. **[ICONS] Auth buttons use SVG icons instead of Phosphor icon font**
   - Pencil: Uses Phosphor icon font -- `google-logo`, `envelope-simple`, `apple-logo` (each `20x20`).
   - Code: Uses inline SVG paths for Google (colored multi-path), email (envelope path), and Apple (apple path). The visual result is similar but the implementation differs. The Google icon in code is multi-colored (brand colors) while the Pencil icon is a monochrome `#141413` icon.

3. **[CONTENT] Email button text capitalization**
   - Pencil: "Continue with email" (lowercase "e")
   - Code: "Continue with email" (lowercase "e")
   - This actually matches. No issue.

4. **[TYPOGRAPHY] Auth button text `letterSpacing`**
   - Pencil: `letterSpacing:0.2` only on the Google button text (`68udG`). The email (`k22qT`) and Apple (`H1Sbd`) button texts do NOT have `letterSpacing` specified.
   - Code: All three buttons have `tracking-[0.2px]` applied uniformly.

5. **[LAYOUT] Login page outer frame `fill` vs code background**
   - Pencil: The outer frame `m7qTP` has `fill:#faf9f5`, `cornerRadius:12`, `width:1440`, `height:900`. The body `hbFOV` also has `fill:#faf9f5`.
   - Code: The LoginPage component has `flex flex-1 flex-col items-center justify-center` with no explicit background. Background is inherited from the `--bg-page` CSS variable (`#faf9f5`), which is correct. The `cornerRadius:12` and fixed dimensions are handled at the app shell level. OK overall.

6. **[MISSING] Email form not in design**
   - Pencil: Only shows three auth buttons (Google, Email, Apple). No email/password form exists in the design.
   - Code: Has a `showEmailForm` state toggle that reveals an email + password form with a "Sign in" button and "Back to other options" link. This is an extra interactive feature not present in the .pen design.

---

## Dashboard Page (MaeiK)

### Matches

- **Overall layout**: Sidebar (240px) + Main Content area in horizontal flex. Main content has `padding:48`, `gap:32`, vertical layout.
- **Header title**: "Speak naturally, write perfectly -- in any app" in Instrument Serif 32px, `letterSpacing:-0.5` -- code has `font-heading text-[32px] tracking-[-0.5px]`.
- **Key badge**: `cornerRadius:6`, `fill:#e8e6dc`, `padding:4`, contains "J" in IBM Plex Mono 13px -- code has `rounded-[6px] bg-[var(--border-light)] px-[4px] py-[4px]` with `font-mono text-[13px]`.
- **Subtitle content**: "Press" / key badge / "to start and stop dictation. Or hold to say something short." with proper fonts and colors -- matches.
- **Stats grid gap**: `gap:16` horizontal -- code has `gap-[16px]`.
- **StatCard structure**: `cornerRadius:14`, `fill:#f0efea`, `gap:8`, `padding:24` -- StatCard code has `rounded-[14px] bg-[var(--bg-card)] p-[24px] gap-[8px]` where `--bg-card:#f0efea`.
- **StatCard icons**: `✨`, `⏱`, `🎤` at 16px -- code has `text-[16px]`.
- **StatCard values**: IBM Plex Mono 28px, fontWeight 500, `letterSpacing:-0.5` -- code has `font-mono text-[28px] font-medium tracking-[-0.5px]`.
- **StatCard labels**: DM Sans 12px, `#8a8880` -- code has `text-[12px] text-[var(--text-secondary)]` where `--text-secondary:#8a8880`.
- **StatCard accent lines**: height 3px, cornerRadius 2, colors `#d97757`, `#6a9bcc`, `#b8a88a` -- code passes `accentColor` as `var(--accent-orange)`, `var(--accent-blue)`, `var(--accent-brown)` which map correctly.
- **Refer card**: `cornerRadius:14`, `fill:#dfe9f3`, `gap:20`, `padding:24` -- code has `rounded-[14px] bg-[var(--bg-refer)] p-[24px] gap-[20px]`.
- **Refer illustration**: `100x100`, `cornerRadius:20`, `fill:rgba(106,155,204,0.12)` -- code matches.
- **Refer content texts**: "Refer friends" in Instrument Serif 20px, description in DM Sans 14px -- matches.
- **Refer button**: `fill:#6a9bcc`, `height:40`, `width:140`, `cornerRadius:8`, text "Invite friends" in white 13px -- code has matching dimensions and colors.
- **Affiliate card**: `fill:#f5e6df`, same structure -- code has `bg-[var(--bg-affiliate)]` where `--bg-affiliate:#f5e6df`.
- **Affiliate button**: `fill:#d97757`, `height:40`, `width:120`, `cornerRadius:8`, text "Join now" -- code matches.
- **Feedback section title**: "Give feedback" in Instrument Serif 20px -- code matches.
- **Feedback input**: `cornerRadius:10`, `fill:#ffffff`, `height:46`, `padding:16` -- code has `rounded-[10px] bg-[var(--bg-white)] h-[46px] px-[16px]`.
- **Feedback send button**: `cornerRadius:10`, `fill:#f0efea`, `height:46`, `width:160` -- code has `rounded-[10px] bg-[var(--bg-card)] h-[46px] w-[160px]`.
- **Footer version text**: "Version v1.0.2" and "Check for updates" -- matches.

### Discrepancies

1. **[ICONS] Refer card uses Phosphor `users` icon, code uses emoji**
   - Pencil: Uses Phosphor icon font `users` with `fill:#6a9bcc`, `width:44`, `height:44` inside the illustration circle.
   - Code: Uses emoji `👥` at `text-[44px]` with `text-[var(--accent-blue)]`. The visual appearance differs (Phosphor line icon vs emoji).

2. **[ICONS] Affiliate card uses Phosphor `coins` icon, code uses emoji**
   - Pencil: Uses Phosphor icon font `coins` with `fill:#d97757`, `width:44`, `height:44`.
   - Code: Uses emoji `🪙` at `text-[44px]` with `text-[var(--accent-orange)]`.

3. **[LAYOUT] Dashboard page missing Window Chrome bar**
   - Pencil: Has a `Window Chrome` bar (identical to Login page) at the top.
   - Code: Not rendered in `DashboardPage.tsx` (likely handled at app shell level).

4. **[LAYOUT] Header subtitle gap**
   - Pencil: `gap:6` between "Press", key badge, and trailing text.
   - Code: `gap-[6px]` -- matches. No issue.

5. **[TYPOGRAPHY] Feedback send button text fontWeight**
   - Pencil: `fontWeight:"normal"` on "Send feedback" text.
   - Code: No explicit font-weight class (defaults to normal). Matches.

6. **[STRUCTURE] Feedback section gap hierarchy**
   - Pencil: feedbackSection has `gap:16` between title and feedbackRow. feedbackRow has `gap:12` between input and button.
   - Code: `gap-[16px]` on outer div, `gap-[12px]` on inner div. Matches.

7. **[CONTENT] Refer card button text**
   - Pencil: "Invite friends" (13px, fontWeight normal)
   - Code: "Invite friends" (13px)
   - Matches.

---

## History Page (Q8lej)

### Matches

- **Overall layout**: Sidebar + Main Content with `padding:48`, `gap:40` vertical.
- **Header**: "History" in Instrument Serif 32px, with a `...` menu button (DM Sans 24px) aligned right.
- **Filter tabs**: "All" (active: `fill:#141413` text white), "Dictations", "Ask anything" at 13px, `cornerRadius:100`, `padding:10` -- code uses `rounded-full px-[10px] py-[10px] text-[13px]` and toggles `bg-[var(--text-primary)] text-white` vs `bg-[var(--border-light)]`.
- **Tab gap**: `gap:8` -- code has `gap-[8px]`.
- **Settings section background**: `fill:#e8e5d8`, `cornerRadius:12`, `padding:16` -- code has `bg-[var(--bg-settings)] rounded-[12px] p-[16px]` where `--bg-settings:#e8e5d8`.
- **Privacy section**: "Your data stays private" with lock emoji, description text -- matches.
- **Privacy description**: Exact text match including "Your voice dictations are private with zero data retention..."
- **Keep History dropdown**: `cornerRadius:10`, `fill:#ffffff`, `height:40`, `padding:12`, "Forever" text, triangle icon -- code matches.
- **History items structure**: Time (IBM Plex Mono 12px, `#b0aea5`) + message text (DM Sans 14px, `leading-[1.6]`) with `gap:16`.
- **History items content**: All three messages match the Pencil design exactly (Chinese text entries).
- **"Today" label**: 13px, DM Sans, `#b0aea5` -- code has `text-[13px] font-sans text-[var(--text-tertiary)]`.

### Discrepancies

1. **[ICONS] Keep History icon mismatch**
   - Pencil: Uses `📦` (package/archive emoji) for the "Keep history" setting title icon.
   - Code: Uses `📦` emoji as well -- actually matches. No issue.

2. **[LAYOUT] History page missing Window Chrome bar**
   - Pencil: Has Window Chrome bar at the top.
   - Code: Not rendered (app shell level).

3. **[CONTENT] Extra history groups in code not in design**
   - Pencil: Only shows "Today" group with 3 entries.
   - Code: Default data includes "Yesterday" (2 entries) and "Earlier" (1 entry) groups with English text entries not present in the design. These are fallback sample data.

4. **[LAYOUT] Settings section gap**
   - Pencil: `settingsSection` has `gap:12` between "keepHistorySetting" and "privacySection".
   - Code: Parent div has `gap-[12px]`. Matches.

5. **[TYPOGRAPHY] Menu button character**
   - Pencil: Uses `⋯` (Unicode horizontal ellipsis character, DM Sans 24px).
   - Code: Uses `&#x22EF;` which is Unicode `U+22EF` (midline horizontal ellipsis). The Pencil design character `⋯` is `U+22EF` as well. Matches.

6. **[FEATURE] Loading state not in design**
   - Pencil: Shows static history entries.
   - Code: Has `isLoading` state with "Loading..." text and `useEffect` hook that calls `window.electronAPI.historyList()`. The loading state and API integration are code-only features.

7. **[FEATURE] Active tab filtering logic**
   - Pencil: Static design with "All" tab selected.
   - Code: Interactive tab filtering by `'all' | 'dictations' | 'ask'` with `useState`. Functional enhancement.

---

## Dictionary Page (99vPS)

### Matches

- **Overall layout**: Sidebar + Main Content with `padding:48`, `gap:32`, vertical flex.
- **Dictionary title**: "Dictionary" in Instrument Serif 32px -- code has `font-heading text-[32px]`.
- **New word button**: `cornerRadius:22`, `fill:#141413`, `height:44`, `padding:12`, "New word" text in white 14px -- code has `rounded-[22px] bg-[var(--text-primary)] h-[44px] px-[12px] text-[14px] text-white`.
- **Filter "All" tab**: Same pattern as History page -- `cornerRadius:100`, `fill:#141413`, white text, 13px.
- **Search button**: `40x40`, `cornerRadius:20`, `fill:#e8e6dc`, `🔍` emoji at 16px -- code has `h-[40px] w-[40px] rounded-[20px] bg-[var(--border-light)]`.
- **Word items**: `gap:8`, `width:310` each, sparkle `✨` icon in `#788c5d` at 14px + word text in DM Sans 14px -- code has `w-[310px] gap-[8px] text-[14px] text-[var(--accent-green)]` where `--accent-green:#788c5d`.
- **Words grid layout**: Rows of 3, `gap:20` between items in a row, `gap:16` between rows -- code has `gap-[20px]` horizontal and `gap-[16px]` vertical.
- **All 24 word entries**: Exact match of all words in the same order -- "Skylight", "reveal", "Xin", "claude code", "online markdown render", "Scene", "SceneItems", "Anvar Kayumov", "Yixuan Ye", "UnLockView", "消重", "comment", "结构体", "边界条件", "renyue", "ERD", "欣一些", "FI-CN", "GetFeedrecall", "RPC", "tphase-out", "feed recall", "view Status", "mixank".

### Discrepancies

1. **[CONTENT] Subheading text mismatch**
   - Pencil: "Degine Your Own Work In Fixtionary" (appears to be intentionally quirky/typo text in design: `id:6GipB`)
   - Code: "Define Your Own Words In Dictionary" (corrected version)

2. **[LAYOUT] Header structure differs**
   - Pencil: The `dictHeader` frame (`Aj56R`) has `gap:16` and `width:216` (fixed), with `justifyContent:"center"` -- contains only "Dictionary" title and "New word" button.
   - Code: The header uses `w-full items-center gap-[16px]` -- full width, not 216px fixed width.

3. **[LAYOUT] Dictionary page missing Window Chrome bar**
   - Pencil: Has Window Chrome bar at the top.
   - Code: Not rendered (app shell level).

4. **[SPACING] Dictionary main content gap**
   - Pencil: Main Content (`FxWGI`) has `gap:32`.
   - Code: `gap-[32px]`. Matches.

5. **[STRUCTURE] Subheading appears above the header**
   - Pencil: The text node `6GipB` ("Degine Your Own Work In Fixtionary") appears as a direct child of Main Content BEFORE the `dictHeader`, with `fontSize:14`, Instrument Serif.
   - Code: The subheading span also appears before the header div. Structure matches.

---

## Shared Components

### Sidebar

**Matches:**
- Width `240px`, `fill:#f0efea`, `gap:24`, `padding:24`, vertical layout -- code has `w-[240px] bg-[var(--bg-sidebar)] gap-[24px] p-[24px]` where `--bg-sidebar:#f0efea`.
- Logo section: `🎙️` at 20px, "Typeless" in Instrument Serif 20px, `height:32`, `gap:8` -- matches.
- Nav items: `gap:4` between items, each `height:44`, `cornerRadius:8`, `gap:12`, `padding:12` -- NavItem code has `gap-[12px] h-[44px] rounded-[8px] px-[12px]`.
- Active nav: `fill:#e8e6dc` -- code uses `bg-[var(--border-light)]` where `--border-light:#e8e6dc`.
- Inactive nav: `fill:#00000000` (transparent) -- code uses `bg-transparent`.
- Nav icons: `🏠`, `🕐`, `📖` at 16px -- matches.
- Nav labels: "Home", "History", "Dictionary" in DM Sans 14px -- matches.
- Upgrade section: `gap:10`, `padding:16` -- code has `gap-[10px] p-[16px]`.
- Trial title: "Pro Trial" in DM Sans 13px fontWeight 500 -- code has `text-[13px] font-medium`.
- Trial days: "22 of 30 days used" in DM Sans 13px, `#b0aea5` -- matches.
- Progress bar: Background `#e8e6dc` height 4px cornerRadius 2, foreground `#d97757` width 140px -- matches.
- Trial message: "Upgrade to Typeless Pro before your trial ends" 12px, `#b0aea5`, leading 1.5 -- matches.
- Upgrade button: `height:48`, `cornerRadius:10`, `fill:#d97757`, "Upgrade" text in white 15px, `letterSpacing:0.2` -- code has `h-[48px] rounded-[10px] bg-[var(--accent-orange)] text-[15px] tracking-[0.2px]`.

**Discrepancies:**

1. **[TYPOGRAPHY] Upgrade button fontWeight**
   - Pencil: `fontWeight:"normal"` on the "Upgrade" text.
   - Code: No explicit `font-normal` class but Tailwind defaults to normal. Matches.

### ProBadge

**Matches:**
- `cornerRadius:4`, `fill:rgba(217,119,87,0.2)`, `padding:[3,6]` -- code has `rounded-[4px] bg-[rgba(217,119,87,0.2)] px-[6px] py-[3px]`.
- "Pro Trial" text in `#d97757` at 12px, DM Sans -- code has `text-[12px] text-[var(--accent-orange)]`.

**No discrepancies found.**

### StatCard

**Matches (see Dashboard section for details).**

**No discrepancies beyond those noted in Dashboard section.**

### NavItem

**Matches (see Sidebar section for details).**

**No discrepancies found.**

---

## CSS Variables Cross-Reference

| CSS Variable | CSS Value | .pen Value(s) | Match? |
|---|---|---|---|
| `--bg-page` | `#faf9f5` | `fill:#faf9f5` on page frames | YES |
| `--bg-sidebar` | `#f0efea` | `fill:#f0efea` on Sidebar frames | YES |
| `--bg-chrome` | `#f2f1ec` | `fill:#f2f1ec` on Window Chrome | YES |
| `--bg-card` | `#f0efea` | `fill:#f0efea` on stat cards + feedback button | YES |
| `--bg-white` | `#ffffff` | `fill:#ffffff` on buttons, inputs | YES |
| `--bg-refer` | `#dfe9f3` | `fill:#dfe9f3` on referCard | YES |
| `--bg-affiliate` | `#f5e6df` | `fill:#f5e6df` on affiliateCard | YES |
| `--bg-settings` | `#e8e5d8` | `fill:#e8e5d8` on keepHistorySetting/privacySection | YES |
| `--text-primary` | `#141413` | `fill:#141413` on primary text | YES |
| `--text-secondary` | `#8a8880` | `fill:#8a8880` on stat labels, feature descriptions | YES |
| `--text-tertiary` | `#b0aea5` | `fill:#b0aea5` on subtitles, tertiary text | YES |
| `--accent-orange` | `#d97757` | `fill:#d97757` on Pro badge, upgrade button, accent line, etc. | YES |
| `--accent-blue` | `#6a9bcc` | `fill:#6a9bcc` on stat line 2, refer card button/icon | YES |
| `--accent-brown` | `#b8a88a` | `fill:#b8a88a` on stat line 3 | YES |
| `--accent-green` | `#788c5d` | `fill:#788c5d` on dictionary sparkle icons | YES |
| `--border-light` | `#e8e6dc` | `fill:#e8e6dc` on borders, dividers, active nav bg | YES |
| `--border-card` | `#f0ede4` | `stroke.fill:#f0ede4` on feature cards | YES |

**All CSS variables match their corresponding .pen color values.**

### Font Families

| CSS Class | CSS Value | .pen fontFamily | Match? |
|---|---|---|---|
| `.font-heading` | `'Instrument Serif', serif` | `Instrument Serif` | YES |
| `.font-sans` | `'DM Sans', sans-serif` | `DM Sans` | YES |
| `.font-mono` | `'IBM Plex Mono', monospace` | `IBM Plex Mono` | YES |
| base body | `'DM Sans', sans-serif` | Default body font | YES |

---

## Summary

### Total discrepancies found: 10

### Critical (layout/structural): 2
1. **Dictionary subheading text** -- "Degine Your Own Work In Fixtionary" (design) vs "Define Your Own Words In Dictionary" (code). The code "corrected" what appears to be a design typo. This needs a decision on which is intentional.
2. **Dictionary header width** -- Design has `width:216` (fixed), code has `w-full`. This could cause layout differences at various viewport sizes.

### Medium (icons/visual): 3
3. **Refer card icon** -- Phosphor `users` icon (design) vs `👥` emoji (code).
4. **Affiliate card icon** -- Phosphor `coins` icon (design) vs `🪙` emoji (code).
5. **Auth button icons** -- Phosphor icon font (design) vs inline SVGs (code). Google icon in code is multi-colored brand icon vs monochrome in design.

### Minor (extra features in code, not in design): 4
6. **Window Chrome bar** -- Present in all 4 .pen page designs but not rendered by React page components (assumed to be handled at Electron shell level).
7. **Login email form** -- Code has email/password form toggle not present in design.
8. **History extra groups** -- Code has "Yesterday" and "Earlier" sample data groups beyond what the design shows.
9. **History loading state** -- Code has loading state and Electron API integration not shown in static design.

### Trivial (spacing/typography): 1
10. **Auth button letterSpacing** -- Design only has `letterSpacing:0.2` on Google button text; code applies `tracking-[0.2px]` to all three buttons uniformly.
