# Pencil MCP Code Generation: Complete Research Report

## Table of Contents

1. [How Pencil Code Generation Works](#1-how-pencil-code-generation-works)
2. [Design File Structure Analysis](#2-design-file-structure-analysis)
3. [Design Tokens and Styling](#3-design-tokens-and-styling)
4. [Shared Components Analysis](#4-shared-components-analysis)
5. [Step-by-Step Conversion Process](#5-step-by-step-conversion-process)
6. [Generated Code Structure](#6-generated-code-structure)
7. [Per-Page Conversion Details](#7-per-page-conversion-details)
8. [Gotchas and Electron-Specific Considerations](#8-gotchas-and-electron-specific-considerations)

---

## 1. How Pencil Code Generation Works

### 1.1 Core Mechanism

Pencil does NOT have a built-in "export to code" button. Code generation is performed by the AI agent (Claude Code) reading the .pen file structure through MCP tools and translating it into React + Tailwind code. The process is:

```
.pen file (JSON structure) --> AI reads via MCP tools --> AI generates .tsx files
```

The AI reads the exact vector node tree (coordinates, colors, spacing, fonts, layout properties) and translates each node into corresponding React JSX with Tailwind CSS classes.

### 1.2 MCP Tools Used for Code Generation

| Tool | Purpose in Code Generation |
|------|---------------------------|
| `batch_get` | Read node tree structure, component definitions, all properties |
| `get_variables` | Extract design tokens (colors, fonts, spacing) for CSS variables |
| `get_screenshot` | Visual verification - compare design vs rendered code |
| `get_guidelines("code")` | Get code generation workflow instructions |
| `get_guidelines("tailwind")` | Get Tailwind v4 specific implementation rules |
| `snapshot_layout` | Analyze layout structure, detect positioning issues |

### 1.3 The Generation Workflow (from Guidelines)

The official Pencil code generation workflow has 5 steps:

**Step 1: Component Analysis and Extraction**
- Read the target frame/design using `batch_get`
- Identify reusable components (refs) used in the frame
- Count instances of each component
- Extract component definitions with full depth

**Step 2: React Component Creation**
- Create `.tsx` files with TypeScript interfaces
- Use Tailwind classes exclusively (NO inline styles)
- Match design values exactly using arbitrary Tailwind values when needed
- Use CSS variables for colors

**Step 3: Component Validation**
- Use `get_screenshot` to visually verify
- Compare rendered output against design
- Check dimensions, spacing, colors, typography

**Step 4: Frame Integration**
- Read complete target frame with `maxDepth: 10`
- Map all component instances with their overrides
- Assemble the page layout

**Step 5: Final Validation**
- Verify responsive behavior
- Check scrollable areas
- Verify all interactive elements

### 1.4 Key Principle: No Pencil Runtime

Generated code is pure React + Tailwind. It does NOT depend on any Pencil library or runtime. The .pen file is only used at design time by the AI agent.

---

## 2. Design File Structure Analysis

### 2.1 File Location

The design file is at `/Users/junyu/coding/pencil-new.pen`.

### 2.2 No Reusable Components Defined

**Important finding**: The `batch_get` search for `{"reusable": true}` returned an empty array `[]`. This means the .pen file has **zero reusable components** (no component instances/refs). All four pages are built with raw frames. This means:

- The Sidebar is duplicated across 3 pages as independent frame subtrees (not component instances)
- There is no design system layer to map to React components automatically
- The AI must identify visual patterns manually and extract shared components

### 2.3 No Design Variables Defined

The `get_variables` call returned `{"variables": {}}`. This means:
- No CSS variable tokens are defined in the .pen file
- All colors are hardcoded hex/rgba values in the nodes
- The AI will need to extract colors manually and define CSS variables

### 2.4 Page Structure Overview

All four pages share the same outer structure:
- **Canvas size**: 1440 x 900px
- **Corner radius**: 12px (macOS window appearance)
- **Background**: `#faf9f5` (warm off-white)
- **Layout**: Vertical - Window Chrome bar on top, then body content

**Window Chrome Bar** (present on all 4 pages):
- Height: 52px
- Background: `#f2f1ec`
- Contains macOS traffic lights (red `#ff5f57`, yellow `#febc2e`, green `#28c840`)
- Traffic light dots: 12x12px, cornerRadius 6 (circles), gap 8px

---

## 3. Design Tokens and Styling

### 3.1 Color Palette (Extracted from All Pages)

#### Background Colors
| Token Name (suggested) | Hex Value | Usage |
|----------------------|-----------|-------|
| `--bg-page` | `#faf9f5` | Page background |
| `--bg-sidebar` | `#f0efea` | Sidebar background |
| `--bg-chrome` | `#f2f1ec` | Window chrome bar |
| `--bg-card` | `#f0efea` | Stat cards, input backgrounds |
| `--bg-white` | `#ffffff` | Buttons, inputs, feature cards |
| `--bg-refer` | `#dfe9f3` | Refer friends card |
| `--bg-affiliate` | `#f5e6df` | Affiliate card |
| `--bg-settings` | `#e8e5d8` | History settings sections |

#### Text Colors
| Token Name (suggested) | Hex Value | Usage |
|----------------------|-----------|-------|
| `--text-primary` | `#141413` | Headings, body text, nav items |
| `--text-secondary` | `#8a8880` | Stat labels, descriptions |
| `--text-tertiary` | `#b0aea5` | Subtitles, timestamps, placeholders |

#### Accent Colors
| Token Name (suggested) | Hex Value | Usage |
|----------------------|-----------|-------|
| `--accent-orange` | `#d97757` | CTA buttons, upgrade, pro badge, links |
| `--accent-blue` | `#6a9bcc` | Refer card, stat line, invite button |
| `--accent-brown` | `#b8a88a` | Words dictated stat line |
| `--accent-green-word` | `#788c5d` | Dictionary word icons |

#### Border/Divider Colors
| Token Name (suggested) | Hex Value | Usage |
|----------------------|-----------|-------|
| `--border-light` | `#e8e6dc` | Button borders, nav active bg, dividers |
| `--border-card` | `#f0ede4` | Feature card borders |

#### Accent Background Tints (with alpha)
| Value | Usage |
|-------|-------|
| `rgba(217, 119, 87, 0.15)` | Pro badge bg (login) |
| `rgba(217, 119, 87, 0.20)` | Pro badge bg (sidebar) |
| `rgba(217, 119, 87, 0.12)` | Orange icon backgrounds |
| `rgba(147, 130, 220, 0.12)` | Purple icon background |
| `rgba(72, 160, 120, 0.12)` | Green icon background |
| `rgba(106, 155, 204, 0.12)` | Blue icon background |

### 3.2 Typography

#### Font Families
| Font | Usage | Weight(s) |
|------|-------|-----------|
| **Instrument Serif** | Headings, titles, logo text, feature titles | normal (400) |
| **DM Sans** | Body text, buttons, labels, descriptions | normal (400), 500 |
| **IBM Plex Mono** | Stat values, timestamps, keyboard shortcuts | normal (400), 500 |
| **Inter** | Emoji icons (used as text nodes), some labels | normal (400) |

#### Font Size Scale
| Size | Usage |
|------|-------|
| 38px | Login title ("Welcome to Typeless") |
| 32px | Page titles (Dashboard header, "History", "Dictionary") |
| 28px | Stat card values ("7.6%", "1 hr 57 min") |
| 20px | Section titles (feedback, refer, affiliate), logo text, feature titles (login) |
| 18px | Feature card titles (login) |
| 16px | Emoji icons in sidebar nav |
| 15px | Body text, button labels, setting titles |
| 14px | Nav items, descriptions, form inputs, dictionary words |
| 13px | Small labels, tab text, trial title, footer terms |
| 12px | Version text, timestamps, pro badge text, stat labels |
| 10px | Dropdown arrow icon |

#### Letter Spacing
| Value | Usage |
|-------|-------|
| -0.6px | Login title |
| -0.5px | Page titles, stat values |
| -0.2px | Feature titles |
| 0.2px | Button text (upgrade, auth buttons) |

### 3.3 Spacing Tokens

#### Padding
| Value | Usage |
|-------|-------|
| 48px | Main content area padding |
| 24px | Sidebar padding, feature cards, stat cards, promo cards |
| 20px | Window chrome padding |
| 16px | Upgrade section, history settings, feedback input |
| 12px | Nav items, dropdown, buttons |
| 10px | Tab pills |
| 4px | Key badge, pro badge vertical |
| [3, 6] | Pro badge (asymmetric) |

#### Gap
| Value | Usage |
|-------|-------|
| 40px | History main content sections |
| 32px | Login container sections, dashboard sections, dictionary sections |
| 24px | Sidebar sections |
| 20px | History items list, dictionary word rows, promo cards |
| 16px | Stats grid, feature grid, card rows, dictionary word grid, form fields |
| 12px | Login button group, refer/affiliate content, filter tabs, subtitle elements |
| 10px | Login title row, upgrade section |
| 8px | Traffic lights, sidebar nav, trial status, login logo area, word items, filter tabs (dict), settings sections, footer |
| 6px | Header subtitle |
| 4px | Nav section items |

### 3.4 Border Radius
| Value | Usage |
|-------|-------|
| 100px (pill) | Tab pills, search button |
| 24px | Icon backgrounds (login features) |
| 22px | "New word" button |
| 20px | Illustration containers, search button |
| 16px | Feature cards (login) |
| 14px | Stat cards, promo cards |
| 12px | Window frame, auth buttons |
| 10px | Upgrade button, feedback input/button, dropdown, history settings |
| 8px | Nav items, refer/affiliate action buttons |
| 6px | Traffic light dots, pro badge, key badge |
| 4px | Pro badge (sidebar) |
| 2px | Trial progress bar |

### 3.5 Icon System

The design uses TWO icon approaches:
1. **Emoji text nodes**: Most icons are emoji characters rendered as Inter font text (`"content": "🎙️"`, `"content": "🏠"`, etc.)
2. **Phosphor icon_font**: Used in promo cards (`users`, `coins`) and login buttons (`google-logo`, `envelope-simple`, `apple-logo`)

For code generation, emojis should remain as-is. Phosphor icons require the `@phosphor-icons/react` package or the Phosphor icon font.

---

## 4. Shared Components Analysis

### 4.1 Sidebar (Used in 3 pages: Dashboard, History, Dictionary)

The Sidebar appears in 3 of 4 pages with identical structure but different active states:

**Structure:**
```
Sidebar (240px wide, #f0efea background, 24px padding, 24px gap, vertical layout)
  ├── Logo Section (horizontal: emoji + "Typeless" + Pro Trial badge)
  ├── Nav Section (vertical, 4px gap)
  │   ├── Home nav item (emoji + text, 44px height, 12px padding, 8px cornerRadius)
  │   ├── History nav item
  │   └── Dictionary nav item
  ├── Spacer (fill_container - pushes upgrade to bottom)
  └── Upgrade Section (16px padding, 10px gap, vertical)
      ├── Trial Status ("Pro Trial", "22 of 30 days used", progress bar)
      ├── Trial Message
      └── Upgrade Button (#d97757, 48px height, 10px cornerRadius)
```

**Active state**: The active nav item has `fill: "#e8e6dc"`, inactive items have `fill: "#00000000"` (transparent).

| Page | Active Item |
|------|------------|
| Dashboard | Home |
| History | History |
| Dictionary | Dictionary |

**React component approach**: Extract a `<Sidebar>` component accepting `activePage: "home" | "history" | "dictionary"` as a prop.

### 4.2 Window Chrome (Used in ALL 4 pages)

Identical across all pages:
- Height: 52px, padding: 20px, background: `#f2f1ec`
- Three traffic light dots with macOS colors

**React component approach**: Extract a `<WindowChrome>` component. In Electron with `titleBarStyle: 'hiddenInset'`, the actual traffic lights are native, so this component may only need to render the background bar (or be omitted entirely if using native title bar).

### 4.3 Pro Badge (Used in Sidebar and Login)

Small badge: `cornerRadius: 4, fill: rgba(217, 119, 87, 0.2), padding: [3, 6]` containing "Pro Trial" text in `#d97757`.

### 4.4 Stat Card Pattern (Dashboard only)

Three stat cards with identical structure:
```
StatCard (cornerRadius: 14, fill: #f0efea, padding: 24, gap: 8)
  ├── Emoji icon (16px)
  ├── Value (IBM Plex Mono, 28px, 500 weight)
  ├── Label (DM Sans, 12px, #8a8880)
  └── Colored line (rectangle, 3px height, fill_container width)
```

### 4.5 Dictionary Word Item Pattern

Each word item: `horizontal layout, gap: 8, width: 310px`
- Emoji icon (`"✨"`, `#788c5d`)
- Word text (DM Sans, 14px, `#141413`)

Arranged in a 3-column grid with 20px gap, rows also 16px gap.

---

## 5. Step-by-Step Conversion Process

### 5.1 Pre-requisites

Based on the existing project (`package.json`):
- React 19.2.4 is installed
- Tailwind CSS 4.2.0 is installed (with `@tailwindcss/vite` plugin)
- Zustand 5.0.11 is available for state management

Additional fonts needed (load via `<link>` in HTML):
- **Instrument Serif** (Google Fonts)
- **DM Sans** (Google Fonts)
- **IBM Plex Mono** (Google Fonts)
- **Inter** (likely already available as system font or add explicitly)
- **Phosphor Icons** (font or `@phosphor-icons/react` package)

### 5.2 Step 1: Set Up CSS Variables and Fonts

Create a new `src/ui/styles/globals.css` with:

```css
@import "tailwindcss";

:root {
  /* Backgrounds */
  --bg-page: #faf9f5;
  --bg-sidebar: #f0efea;
  --bg-chrome: #f2f1ec;
  --bg-card: #f0efea;
  --bg-white: #ffffff;
  --bg-refer: #dfe9f3;
  --bg-affiliate: #f5e6df;
  --bg-settings: #e8e5d8;

  /* Text */
  --text-primary: #141413;
  --text-secondary: #8a8880;
  --text-tertiary: #b0aea5;

  /* Accents */
  --accent-orange: #d97757;
  --accent-blue: #6a9bcc;
  --accent-brown: #b8a88a;

  /* Borders */
  --border-light: #e8e6dc;
  --border-card: #f0ede4;
}

@layer base {
  html, body {
    height: 100%;
  }

  .font-heading {
    font-family: "Instrument Serif", serif;
  }

  .font-body {
    font-family: "DM Sans", sans-serif;
  }

  .font-mono {
    font-family: "IBM Plex Mono", monospace;
  }
}
```

### 5.3 Step 2: Read Each Page with MCP

For each page, the AI agent should:

```
1. batch_get(nodeIds: ["<page-id>"], readDepth: 10)
   - Gets the complete node tree

2. get_screenshot(nodeId: "<page-id>")
   - Gets visual reference for comparison

3. For any truncated children ("..."), do follow-up batch_get calls
```

### 5.4 Step 3: Map Design Nodes to React Elements

The mapping follows these rules from the guidelines:

| .pen Node Type | React Element | Tailwind Classes |
|---------------|--------------|-----------------|
| `frame` with `layout: "vertical"` | `<div className="flex flex-col">` | `gap-[Npx]`, `p-[Npx]` |
| `frame` with `layout: "horizontal"` (or default) | `<div className="flex">` | `gap-[Npx]`, `items-center` |
| `text` | `<span>` or `<p>` | `text-[Npx]`, `font-[weight]`, color classes |
| `rectangle` | `<div>` | sizing, color, radius |
| `icon_font` | `<span className="phosphor-icon">` | icon rendering |
| `frame` with `width: "fill_container"` | Add `flex-1` or `w-full` | depends on parent |
| `frame` with `height: "fill_container"` | Add `h-full` or `flex-1` | depends on parent |
| `frame` with `justifyContent: "center"` | `justify-center` | |
| `frame` with `alignItems: "center"` | `items-center` | |
| `frame` with `stroke` | `border` classes | `border-[color]` |

### 5.5 Step 4: Extract Shared Components First

Before building pages, extract these shared components:

1. **`<WindowChrome />`** - The macOS title bar
2. **`<Sidebar activePage={string} />`** - Navigation sidebar
3. **`<ProBadge />`** - The "Pro Trial" badge
4. **`<StatCard icon={string} value={string} label={string} lineColor={string} />`** - Dashboard stats
5. **`<NavItem icon={string} label={string} active={boolean} />`** - Sidebar nav items

### 5.6 Step 5: Build Pages Using Shared Components

Each page is assembled by combining shared components with page-specific content.

### 5.7 Step 6: Validate with Screenshots

After generating code, use `get_screenshot` on the design and visually compare against the rendered output in the Electron app.

---

## 6. Generated Code Structure

### 6.1 Expected Output Structure

```
src/ui/
├── App.tsx                     # Router/page switcher
├── styles/
│   └── globals.css             # Tailwind import + CSS variables + font utilities
├── components/
│   ├── WindowChrome.tsx        # macOS-style title bar (may be optional with native)
│   ├── Sidebar.tsx             # Shared sidebar navigation
│   ├── ProBadge.tsx            # "Pro Trial" badge
│   ├── NavItem.tsx             # Individual nav item
│   └── StatCard.tsx            # Stat display card
├── pages/
│   ├── LoginPage.tsx           # Login/onboarding page
│   ├── DashboardPage.tsx       # Home dashboard
│   ├── HistoryPage.tsx         # History page
│   └── DictionaryPage.tsx      # Dictionary page
└── stores/
    └── ui-store.ts             # Navigation state, etc.
```

### 6.2 CSS Approach

Based on the Tailwind v4 guidelines:
- `@import "tailwindcss"` (NOT the old `@tailwind` directives)
- CSS variables in `:root` for colors only (single values)
- Font families defined as utility classes in `@layer base` (NOT as CSS variables)
- All styling via Tailwind classes - NO inline styles
- Arbitrary values in brackets when standard Tailwind values don't match: `text-[14px]`, `gap-[20px]`, `rounded-[14px]`

### 6.3 Example: What Generated Sidebar Code Would Look Like

```tsx
// src/ui/components/Sidebar.tsx
interface SidebarProps {
  activePage: "home" | "history" | "dictionary";
  onNavigate: (page: string) => void;
}

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <div className="flex flex-col w-[240px] h-full bg-[var(--bg-sidebar)] p-[24px] gap-[24px]">
      {/* Logo Section */}
      <div className="flex items-center gap-[8px] h-[32px]">
        <span className="text-[20px]">🎙️</span>
        <span className="font-heading text-[20px] text-[var(--text-primary)]">Typeless</span>
        <ProBadge />
      </div>

      {/* Nav Section */}
      <div className="flex flex-col gap-[4px]">
        <NavItem icon="🏠" label="Home" active={activePage === "home"} onClick={() => onNavigate("home")} />
        <NavItem icon="🕐" label="History" active={activePage === "history"} onClick={() => onNavigate("history")} />
        <NavItem icon="📖" label="Dictionary" active={activePage === "dictionary"} onClick={() => onNavigate("dictionary")} />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Upgrade Section */}
      <div className="flex flex-col gap-[10px] p-[16px]">
        <div className="flex flex-col gap-[8px]">
          <span className="font-body text-[13px] font-medium text-[var(--text-primary)]">Pro Trial</span>
          <span className="font-body text-[13px] text-[var(--text-tertiary)]">22 of 30 days used</span>
          <div className="w-full h-[4px] bg-[var(--border-light)] rounded-[2px]">
            <div className="w-[140px] h-[4px] bg-[var(--accent-orange)] rounded-[2px]" />
          </div>
        </div>
        <p className="font-body text-[12px] text-[var(--text-tertiary)] leading-[1.5]">
          Upgrade to Typeless Pro before your trial ends
        </p>
        <button className="flex items-center justify-center w-full h-[48px] bg-[var(--accent-orange)] rounded-[10px]">
          <span className="font-body text-[15px] text-white tracking-[0.2px]">Upgrade</span>
        </button>
      </div>
    </div>
  );
}
```

### 6.4 Example: NavItem Component

```tsx
interface NavItemProps {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

export function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-[12px] w-full h-[44px] px-[12px] rounded-[8px] ${
        active ? "bg-[var(--border-light)]" : "bg-transparent hover:bg-[var(--border-light)]/50"
      }`}
    >
      <span className="text-[16px]">{icon}</span>
      <span className="font-body text-[14px] text-[var(--text-primary)]">{label}</span>
    </button>
  );
}
```

---

## 7. Per-Page Conversion Details

### 7.1 Login Page (Node ID: m7qTP)

**Layout**: Full-page centered content (no sidebar)

**Structure:**
```
Window Chrome (52px)
Body (fill_container, centered vertically)
  └── Container (520px width, 32px gap, vertical)
      ├── Logo Area (vertical, 12px gap)
      │   ├── Emoji logo (🎙️, 48px)
      │   ├── Title row ("Welcome to Typeless" + Pro badge)
      │   └── Subtitle text
      ├── Button Group (vertical, 12px gap)
      │   ├── Google button (with phosphor google-logo icon)
      │   ├── Email button (with phosphor envelope-simple icon)
      │   └── Apple button (with phosphor apple-logo icon)
      ├── Divider (1px line)
      ├── Features Grid (3 columns, 16px gap)
      │   ├── Feature Card 1 (Voice to Text)
      │   ├── Feature Card 2 (AI Personalization)
      │   └── Feature Card 3 (Save Time)
      └── Footer (terms + version)
```

**Auth buttons pattern**: All three buttons share identical styling:
- `cornerRadius: 12, height: 50, fill: #ffffff, border: 1px #e8e6dc`
- Contains: Phosphor icon (20x20) + text (DM Sans, 15px, weight 500)

**Feature cards pattern**:
- `cornerRadius: 16, fill: #ffffff, border: 1px #f0ede4, padding: 24, gap: 12, clip: true`
- Contains: colored icon background (48x48, cornerRadius 24) + title (Instrument Serif 18px) + description (DM Sans 13px, 80px fixed height)

**MCP commands to read this page:**
```
batch_get(nodeIds: ["m7qTP"], readDepth: 10)
```

### 7.2 Home Dashboard (Node ID: MaeiK)

**Layout**: Sidebar + Main Content

**Structure:**
```
Window Chrome (52px)
Body (horizontal, fill_container)
  ├── Sidebar (240px)
  └── Main Content (1200px width, 48px padding, 32px gap, vertical)
      ├── Header
      │   ├── Title (Instrument Serif, 32px)
      │   └── Subtitle with keyboard shortcut badge
      ├── Stats Grid (3 cards, 16px gap)
      │   ├── Personalization (7.6%, orange line)
      │   ├── Total dictation time (1 hr 57 min, blue line)
      │   └── Words dictated (15.2K, brown line)
      ├── Promo Cards Row (2 cards, 16px gap)
      │   ├── Refer Friends card (#dfe9f3 bg, blue button)
      │   └── Affiliate Program card (#f5e6df bg, orange button)
      ├── Feedback Section
      │   ├── Title
      │   └── Input row (text input + send button)
      ├── Spacer (fill_container)
      └── Footer (version + update link)
```

**Stats cards use IBM Plex Mono** for the big numbers - this is distinctive and must be preserved.

**Keyboard shortcut badge**: A small frame with `cornerRadius: 6, fill: #e8e6dc, padding: 4` containing "J" in IBM Plex Mono 13px.

**MCP commands:**
```
batch_get(nodeIds: ["MaeiK"], readDepth: 10)
# Then follow up on truncated nodes:
batch_get(nodeIds: ["c4w2V", "ed6wQ", "vjYfn", "ZAkOy", "iCPyr"], readDepth: 3)
```

### 7.3 History Page (Node ID: Q8lej)

**Layout**: Sidebar + Main Content

**Structure:**
```
Window Chrome (52px)
Body (horizontal, fill_container)
  ├── Sidebar (240px, History nav active)
  └── Main Content (1200px, 48px padding, 40px gap, vertical)
      ├── Header ("History" + "..." menu button)
      ├── Settings Section (vertical, 12px gap)
      │   ├── Keep History setting (beige card with dropdown)
      │   └── Privacy notice (beige card with lock icon)
      ├── Filter Tabs (horizontal, 8px gap)
      │   ├── "All" tab (active - black bg, white text, pill shape)
      │   ├── "Dictations" tab (inactive - #e8e6dc bg, pill shape)
      │   └── "Ask anything" tab (inactive)
      └── History List (vertical, 20px gap)
          ├── "Today" section label
          ├── History Item 1 (timestamp + message)
          ├── History Item 2
          └── History Item 3
```

**History items**: Horizontal layout with timestamp (IBM Plex Mono, 12px, `#b0aea5`) on left and message text (DM Sans, 14px, lineHeight 1.6) on right, 16px gap.

**Tab pills**: `cornerRadius: 100, padding: 10`. Active: `fill: #141413, text: #ffffff`. Inactive: `fill: #e8e6dc, text: #141413`.

**Settings cards**: `cornerRadius: 12, fill: #e8e5d8, padding: 16`

### 7.4 Dictionary Page (Node ID: 99vPS)

**Layout**: Sidebar + Main Content

**Structure:**
```
Window Chrome (52px)
Body (horizontal, fill_container)
  ├── Sidebar (240px, Dictionary nav active)
  └── Main Content (1200px, 48px padding, 32px gap, vertical)
      ├── Tagline text (small, Instrument Serif 14px)
      ├── Header Row ("Dictionary" title + "New word" button)
      ├── Filter Row (filter tab + search button)
      └── Words Grid (vertical, 16px gap)
          ├── Row 1 (3 words, 20px gap, each 310px wide)
          ├── Row 2
          ├── ... (8 rows total, 24 words)
          └── Row 8
```

**"New word" button**: `cornerRadius: 22, fill: #141413, height: 44, padding: 12`. White text (DM Sans, 14px).

**Word items**: Simple horizontal layout - emoji icon + word text. Width fixed at 310px. Grid is 3 columns.

**Search button**: Circular, `cornerRadius: 20, fill: #e8e6dc, width: 40, height: 40`, contains magnifying glass emoji.

---

## 8. Gotchas and Electron-Specific Considerations

### 8.1 Window Chrome Conflict

The design includes a macOS-style window chrome bar with traffic lights. In the actual Electron app with `titleBarStyle: 'hiddenInset'`, macOS provides REAL traffic lights. Options:

1. **Recommended**: Use `titleBarStyle: 'hiddenInset'` and `trafficLightPosition: { x: 16, y: 18 }`. Do NOT render the traffic light dots in React. Instead render only the chrome background bar and ensure proper `padding-left` to avoid overlapping the native buttons.
2. **Alternative**: Use `frame: false` and render everything custom, but this loses native macOS behavior.

The chrome bar height (52px) should be preserved as a drag region using `-webkit-app-region: drag`.

### 8.2 Separate Renderer for UI Window

As documented in the prior research (`research-electron-pencil.md`), the existing app has a transparent overlay window. The new UI pages MUST use a separate renderer entry point to avoid style conflicts. The overlay uses `background: transparent` and custom CSS, while the UI pages use Tailwind and a solid background.

### 8.3 Font Loading in Electron

Electron apps can load fonts via:
- `<link>` tags pointing to Google Fonts CDN (requires internet)
- Bundled font files with `@font-face` (works offline, recommended for desktop apps)

**Recommendation**: Bundle the fonts locally since this is a desktop app. Users may not have internet during first launch (e.g., login page should render correctly).

```html
<!-- ui.html -->
<link rel="stylesheet" href="./fonts/fonts.css" />
```

Or use `@font-face` in the CSS entry point.

### 8.4 No Design System Components = More Manual Work

Since the .pen file has NO reusable components (`reusable: true` search returned `[]`), the AI cannot automatically map component instances to React components. It must:

1. Visually identify repeating patterns (sidebar, nav items, stat cards, etc.)
2. Manually extract them as React components
3. Handle the slight naming differences across pages (e.g., `"homeNav"` vs `"homeNavHist"` vs `"dictHomeNav"`)

**Recommendation**: Consider creating reusable components in the .pen file before code generation for a cleaner workflow.

### 8.5 Emoji Icons vs Proper Icons

The design uses emoji characters (🎙️, 🏠, 🕐, 📖, ✨, etc.) as icons. Emojis render differently across operating systems. On macOS Electron, they will use Apple emoji, which should match the design. But:

- Emoji rendering is NOT consistent cross-platform
- If the app ever targets Windows/Linux, emojis will look different
- Consider replacing with a proper icon library (Lucide, Phosphor) for consistency

The Phosphor icon font IS used in some places (auth buttons, promo card illustrations), so the project already has a partial dependency on it.

### 8.6 Hardcoded Content

All text content in the design is hardcoded (stat values like "7.6%", "15.2K", messages in Chinese, etc.). When generating code:
- Static UI text (labels, titles) should remain hardcoded
- Dynamic data (stats, history items) should be props or come from state/API
- The AI should be instructed to make data-driven parts dynamic

### 8.7 Tailwind v4 Specifics

The project uses Tailwind v4.2.0. Key differences from v3:
- Import syntax: `@import "tailwindcss"` (not `@tailwind base/components/utilities`)
- No `tailwind.config.js` needed (configuration is CSS-native)
- Arbitrary values work the same: `text-[14px]`, `bg-[#faf9f5]`
- CSS variables are used via `var()`: `bg-[var(--accent-orange)]`

### 8.8 The 1440x900 Canvas vs Responsive Design

The design is fixed at 1440x900px. In Electron:
- The window size can be set to similar dimensions (the prior research suggests 900x640 with `minWidth: 720`)
- The sidebar should be fixed width (240px) and main content should flex
- The main content width of 1200px in the design is because `1440 - 240 = 1200`, so it naturally fills the remaining space
- Use `flex-1` for the main content area, not a fixed 1200px width

### 8.9 fill_container Height Chains

Multiple elements use `height: "fill_container"` in the design (sidebar, main content, body). In CSS, `h-full` only works if every parent in the chain also has a defined height. The Electron window has a known size, so this chain must be maintained:

```
html (h-full) -> body (h-full) -> #app (h-full) -> App (h-full) -> Page layout (h-full)
```

Missing any link in this chain will cause layout collapse.

### 8.10 Scrollable Content

Some pages may have more content than fits in 900px (especially History with many items, Dictionary with 24+ words). The main content area should use `overflow-y-auto` to enable scrolling while the sidebar remains fixed.

### 8.11 MCP Tool Call Sequence for Complete Code Generation

For each page, the exact sequence of MCP calls would be:

```
1. get_variables(filePath)              -- Get design tokens (empty in this case)
2. batch_get(patterns: [{reusable: true}]) -- Get reusable components (empty in this case)
3. batch_get(nodeIds: [pageId], readDepth: 10) -- Get full page tree
4. batch_get(nodeIds: [...truncatedIds], readDepth: 5) -- Get any truncated children
5. get_screenshot(nodeId: pageId)        -- Get visual reference
6. [AI generates code]
7. get_screenshot(nodeId: pageId)        -- Compare for validation
```

---

## Summary

Pencil MCP code generation is fundamentally an AI-driven translation process where the AI reads structured JSON node trees and converts them to React + Tailwind code. There is no magic "export" button - the quality depends on how well the AI interprets the design structure.

For this specific .pen file:
- **4 pages** to convert, **3 share a sidebar**
- **No reusable components** defined in the design (all raw frames)
- **No design variables** defined (all colors hardcoded in nodes)
- **4 font families** needed: Instrument Serif, DM Sans, IBM Plex Mono, Inter
- **Phosphor icons** needed for auth buttons and promo illustrations
- The AI must manually identify shared patterns and extract components
- Electron-specific considerations include font bundling, window chrome handling, separate renderer setup, and height chain management for `fill_container`
