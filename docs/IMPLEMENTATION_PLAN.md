# Typeless UI + Supabase 完整技术设计方案

> 总架构师 | 2026-02-21
> 原则：只增不改 — 所有新增模块不破坏现有 tray + overlay 录音核心功能
> 标准：团队成员拿到此方案后可直接执行，无需二次确认

---

## 目录

1. [总体架构](#1-总体架构)
2. [执行优先级与先后顺序](#2-执行优先级与先后顺序)
3. [Phase 0: Pencil 设计转 React 代码](#3-phase-0-pencil-设计转-react-代码)
4. [Phase 1: Electron 双窗口基础设施](#4-phase-1-electron-双窗口基础设施)
5. [Phase 2: 路由与布局骨架](#5-phase-2-路由与布局骨架)
6. [Phase 3: Supabase 基础设施与 Auth](#6-phase-3-supabase-基础设施与-auth)
7. [Phase 4: History 真实功能](#7-phase-4-history-真实功能)
8. [Phase 5: Fake 页面 (Dashboard + Dictionary)](#8-phase-5-fake-页面)
9. [Phase 6: 全链路整合](#9-phase-6-全链路整合)
10. [Phase 7: DMG 打包](#10-phase-7-dmg-打包)
11. [数据库完整设计](#11-数据库完整设计)
12. [API / IPC 接口完整定义](#12-api--ipc-接口完整定义)
13. [参考研究文档索引](#13-参考研究文档索引)

---

## 1. 总体架构

### 1.1 当前架构 vs 目标架构

```
当前:
  Electron Main Process
    ├── Overlay Window (透明浮窗, 录音状态)
    ├── ShortcutManager (F2 全局快捷键)
    ├── TrayManager (系统托盘)
    ├── TranscriptionService (OpenAI Whisper)
    └── TextInjector (剪贴板 + Cmd+V)

目标 (新增部分用 [NEW] 标记):
  Electron Main Process
    ├── Overlay Window (不动)
    ├── [NEW] Main Window (1080x720, macOS traffic lights, 4个UI页面)
    ├── ShortcutManager (不动)
    ├── TrayManager (新增 "Open Typeless" 菜单项)
    ├── TranscriptionService (不动)
    ├── TextInjector (不动)
    ├── [NEW] Supabase Client (Auth + Database, 使用 electron-store 持久化 session)
    ├── [NEW] AuthService (signUp/signIn/signOut/getSession)
    └── [NEW] HistoryService (saveTranscription/listHistory)
```

### 1.2 核心技术决策

| 决策项 | 选型 | 理由 |
|--------|------|------|
| 窗口架构 | 两个独立 Vite renderer entries | overlay 和 main window 需求完全不同（透明 vs 实体），避免 CSS 冲突和 bundle 膨胀 |
| Supabase Client 位置 | Main Process | 安全（safeStorage 加密 token）、生命周期持久（不随窗口显隐）、与现有 OpenAI 调用模式一致 |
| 路由方案 | HashRouter (react-router-dom v6) | Electron 使用 file:// 协议，BrowserRouter 不可用 |
| Auth 方式 | Email/Password（真实）+ Google/Apple（fake UI） | Electron 中 OAuth 需要 deep link + 外部浏览器，复杂度高，先做 Email 认证 |
| Session 持久化 | electron-store + Electron safeStorage | OS 级加密，比 localStorage 更安全 |
| 环境变量 | 硬编码 Supabase URL 和 anon key | anon key 设计上是公开的，安全靠 RLS；硬编码最简单 |

---

## 2. 执行优先级与先后顺序

### 2.1 总体执行流水线

```
┌─────────────────────────────────────────────────────────┐
│ Phase 0: Pencil → React 代码 (先做！不依赖任何东西)      │
│   输入: pencil-new.pen                                   │
│   输出: 4个页面的 .tsx 文件 + 共享组件                    │
│   工具: Pencil MCP get_guidelines("code") + batch_get    │
└───────────────────────────┬─────────────────────────────┘
                            │ 生成的 React 代码就位
                            v
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Electron 双窗口 (搭骨架)                         │
│   - 新增 Vite renderer entry for main window             │
│   - 创建 main-window.ts (BrowserWindow)                  │
│   - 修改 forge.config.ts                                 │
│   - Tray 添加 "Open Typeless"                            │
└───────────────────────────┬─────────────────────────────┘
                            │ Main Window 可以打开了
                            v
┌─────────────────────────────────────────────────────────┐
│ Phase 2: 路由 + 布局骨架                                  │
│   - 安装 react-router-dom                                │
│   - HashRouter + Routes 配置                             │
│   - AppLayout (Sidebar + Outlet)                         │
│   - AuthLayout (无 Sidebar, 用于 Login)                   │
│   - 把 Phase 0 生成的页面组件接入路由                      │
└───────────────────────────┬─────────────────────────────┘
                            │ 页面可以切换了（但全是静态）
                            v
         ┌──────────────────┴──────────────────┐
         │                                      │
         v                                      v
┌────────────────────┐              ┌────────────────────┐
│ Phase 3: Auth      │              │ Phase 5: Fake 页面  │
│ (Supabase 真实功能)│              │ (Dashboard/Dict)    │
│ - 安装 supabase-js │              │ - 接入 Phase 0 代码 │
│ - 数据库 + RLS      │              │ - 硬编码数据        │
│ - Login 页面接入    │              │ - 按钮 "Coming soon"│
│ - Auth Guard        │              └────────────────────┘
└─────────┬──────────┘                    可与 Phase 3 并行
          │ 用户可以登录了
          v
┌─────────────────────────────────────────────────────────┐
│ Phase 4: History (真实功能)                               │
│   - transcription_history 表                             │
│   - 转录成功后自动存入 Supabase                           │
│   - History 页面展示真实数据                               │
└───────────────────────────┬─────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────┐
│ Phase 6: 全链路整合                                       │
│   - 侧边栏导航串联                                       │
│   - Auth Guard 保护路由                                   │
│   - Logout 流程                                           │
│   - 样式统一 (字体、颜色)                                  │
└───────────────────────────┬─────────────────────────────┘
                            │
                            v
┌─────────────────────────────────────────────────────────┐
│ Phase 7: DMG 打包                                         │
│   - 禁用 notarization                                    │
│   - Ad-hoc signing (Apple Silicon 必须)                   │
│   - npm run make → Typeless.dmg                          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 为什么 Pencil 代码生成放在最前面

1. **零依赖** — 不需要 Supabase、不需要 react-router、不需要 Electron 改动
2. **阻塞后续所有 Phase** — Phase 2/5 直接需要页面组件代码
3. **最可独立验证** — 生成的 .tsx 可以单独跑 storybook 或浏览器预览
4. **耗时长** — AI 读取 .pen 树 + 转换 4 个页面 + 提取共享组件，需要时间

---

## 3. Phase 0: Pencil 设计转 React 代码

### 3.1 概述

Pencil MCP **没有** "导出代码"按钮。代码生成是 AI 驱动的：读取 .pen JSON 节点树 → 翻译为 React + Tailwind 代码。

### 3.2 Pencil 文件信息

- 文件路径: `/Users/junyu/coding/pencil-new.pen`
- 4 个页面设计:

| 页面 | Node ID | 尺寸 | 布局 |
|------|---------|------|------|
| Login | `m7qTP` | 1440x900 | 全屏居中, 无 Sidebar |
| Dashboard | `MaeiK` | 1440x900 | Sidebar (240px) + Main Content |
| History | `Q8lej` | 1440x900 | Sidebar (240px) + Main Content |
| Dictionary | `99vPS` | 1440x900 | Sidebar (240px) + Main Content |

### 3.3 共享组件 (从设计中提取)

| 组件 | 使用页面 | 关键属性 |
|------|---------|---------|
| `<Sidebar>` | Dashboard, History, Dictionary | 240px 宽, `activePage` prop 控制高亮 |
| `<NavItem>` | 在 Sidebar 中使用 | emoji icon + label, active 态 `bg: #e8e6dc` |
| `<ProBadge>` | Sidebar + Login | `cornerRadius: 4, fill: rgba(217,119,87,0.2)` |
| `<StatCard>` | Dashboard | IBM Plex Mono 数值 + emoji + 彩色线条 |
| `<WindowChrome>` | 不需要实现 | Electron `titleBarStyle: 'hiddenInset'` 提供原生 traffic lights |

### 3.4 所需字体

```
Instrument Serif — 标题 (headings)
DM Sans — 正文 (body text, buttons)
IBM Plex Mono — 数据 (stats, timestamps)
Inter — Emoji icons (已是系统字体)
Phosphor Icons — 部分图标 (auth buttons, promo cards)
```

**字体加载**: 桌面应用应该**本地打包字体**（不依赖 Google Fonts CDN），确保离线可用。

### 3.5 完整的 Pencil → React 代码生成 Prompt 模板

以下是给 AI agent 的完整 prompt，用于将每个 Pencil 页面转为 React 组件：

```
你的任务是将 Pencil 设计文件中的一个页面转换为 React + Tailwind v4 组件。

**准备工作 (每个页面都执行一次):**

1. 调用 `mcp__pencil__get_guidelines(topic="code")` 获取代码生成规范
2. 调用 `mcp__pencil__get_guidelines(topic="tailwind")` 获取 Tailwind v4 规范
3. 调用 `mcp__pencil__get_variables(filePath="/Users/junyu/coding/pencil-new.pen")`

**对于每个页面:**

4. 调用 `mcp__pencil__batch_get(filePath="/Users/junyu/coding/pencil-new.pen", nodeIds=["<PAGE_NODE_ID>"], readDepth=10)`
   - 如果有 children 显示 "..."，对截断的 nodeId 做后续 batch_get 调用
5. 调用 `mcp__pencil__get_screenshot(filePath="/Users/junyu/coding/pencil-new.pen", nodeId="<PAGE_NODE_ID>")`
6. 根据节点树生成 React + Tailwind 代码，遵循以下规则:
   - 使用 Tailwind v4: `@import "tailwindcss"` (不是旧的 @tailwind 指令)
   - 所有样式用 Tailwind classes, 不用 inline styles
   - 任意值用方括号: `text-[14px]`, `gap-[20px]`, `rounded-[14px]`
   - CSS 变量用于颜色: `bg-[var(--bg-page)]`
   - frame + layout:"vertical" → `<div className="flex flex-col">`
   - frame + no layout / layout:"horizontal" → `<div className="flex">`
   - width:"fill_container" → `flex-1` 或 `w-full` (看父容器)
   - height:"fill_container" → `h-full` 或 `flex-1`
7. 生成后再次截图对比验证

**页面 Node IDs:**
- Login: m7qTP
- Dashboard: MaeiK
- History: Q8lej
- Dictionary: 99vPS

**关键: Window Chrome 不需要在 React 中实现。** Electron 的 `titleBarStyle: 'hiddenInset'`
会提供原生 macOS traffic lights。只需在顶部留 52px 高的 drag region 区域。
```

### 3.6 代码生成顺序

```
Step 1: 先提取共享组件
  ├── Sidebar.tsx (从 Dashboard 页面的 K4HUV 节点提取)
  ├── NavItem.tsx
  ├── ProBadge.tsx
  └── StatCard.tsx (从 Dashboard 提取)

Step 2: 生成各页面 (以下顺序)
  ├── LoginPage.tsx (m7qTP) — 无 Sidebar, 独立布局
  ├── DashboardPage.tsx (MaeiK) — 使用 Sidebar + StatCard
  ├── HistoryPage.tsx (Q8lej) — 使用 Sidebar, 需要动态数据 props
  └── DictionaryPage.tsx (99vPS) — 使用 Sidebar, 静态数据
```

### 3.7 生成的文件放置位置

```
src/
  main-app/                         ← [NEW] 主窗口的所有代码
    App.tsx                          ← HashRouter + Routes
    main-renderer.ts                 ← React 挂载入口
    index.css                        ← Tailwind 导入 + CSS 变量
    components/
      Sidebar.tsx                    ← 共享 Sidebar
      NavItem.tsx                    ← Sidebar 导航项
      ProBadge.tsx                   ← Pro Trial 徽章
      StatCard.tsx                   ← 统计卡片
      AuthGuard.tsx                  ← 路由守卫
    layouts/
      AppLayout.tsx                  ← Sidebar + <Outlet>
      AuthLayout.tsx                 ← 无 Sidebar (Login)
    pages/
      LoginPage.tsx                  ← Pencil 设计 m7qTP
      DashboardPage.tsx              ← Pencil 设计 MaeiK
      HistoryPage.tsx                ← Pencil 设计 Q8lej
      DictionaryPage.tsx             ← Pencil 设计 99vPS
    stores/
      auth-store.ts                  ← Auth 状态 (Zustand)
    lib/
      supabase-config.ts             ← Supabase URL + anon key
```

### 3.8 CSS 变量定义

```css
/* src/main-app/index.css */
@import "tailwindcss";

@layer base {
  :root {
    --bg-page: #faf9f5;
    --bg-sidebar: #f0efea;
    --bg-chrome: #f2f1ec;
    --bg-card: #f0efea;
    --bg-white: #ffffff;
    --bg-refer: #dfe9f3;
    --bg-affiliate: #f5e6df;
    --bg-settings: #e8e5d8;
    --text-primary: #141413;
    --text-secondary: #8a8880;
    --text-tertiary: #b0aea5;
    --accent-orange: #d97757;
    --accent-blue: #6a9bcc;
    --accent-brown: #b8a88a;
    --border-light: #e8e6dc;
    --border-card: #f0ede4;
  }
  html, body, #app { height: 100%; margin: 0; }
}
```

---

## 4. Phase 1: Electron 双窗口基础设施

### 4.1 Forge Config 修改

```diff
# forge.config.ts 的 renderer 数组
renderer: [
  {
-   name: 'main_window',
+   name: 'overlay_window',      // 重命名: 现有 overlay
    config: 'vite.renderer.config.ts',
  },
+ {
+   name: 'main_window',          // 新增: 主窗口
+   config: 'vite.main-renderer.config.ts',
+ },
],
```

### 4.2 同步更新 overlay-window.ts

```diff
- declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
- declare const MAIN_WINDOW_VITE_NAME: string;
+ declare const OVERLAY_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
+ declare const OVERLAY_WINDOW_VITE_NAME: string;
```

### 4.3 新增 main-window.ts

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
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 18 },
    backgroundColor: '#faf9f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

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

### 4.4 新文件列表

| 文件 | 内容 |
|------|------|
| `main.html` | 主窗口 HTML 入口 (不透明背景, 加载字体) |
| `src/main-app/main-renderer.ts` | React 挂载 `<MainApp />` |
| `vite.main-renderer.config.ts` | 空 `defineConfig({})` |
| `src/main/main-window.ts` | BrowserWindow 创建 |

### 4.5 窗口生命周期

- **创建时机**: 用户首次点击 Tray "Open Typeless" 时懒创建
- **关闭行为**: 点红色 traffic light → **隐藏**（不销毁），再次点击 Tray 重新显示
- **退出行为**: `app.before-quit` 时才真正销毁

---

## 5. Phase 2: 路由与布局骨架

### 5.1 安装依赖

```bash
npm install react-router-dom
```

### 5.2 路由结构

```tsx
// src/main-app/App.tsx
<HashRouter>
  <Routes>
    {/* 公开路由 (无 Sidebar) */}
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<LoginPage />} />
    </Route>

    {/* 受保护路由 (有 Sidebar) */}
    <Route element={<AuthGuard />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/dictionary" element={<DictionaryPage />} />
      </Route>
    </Route>

    {/* 默认重定向 */}
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
</HashRouter>
```

### 5.3 布局组件

**AppLayout** (Dashboard/History/Dictionary):
```
┌──────────────────────────────────────────────┐
│  -webkit-app-region: drag (52px)             │ ← macOS traffic lights 区域
├──────────┬───────────────────────────────────┤
│ Sidebar  │  <Outlet />                       │
│ (240px)  │  (页面内容)                        │
│ fixed    │  overflow-y: auto                  │
│          │                                    │
└──────────┴───────────────────────────────────┘
```

**AuthLayout** (Login):
```
┌──────────────────────────────────────────────┐
│  -webkit-app-region: drag (52px)             │
├──────────────────────────────────────────────┤
│              <Outlet />                       │
│         (Login 全屏居中)                      │
└──────────────────────────────────────────────┘
```

### 5.4 Sidebar 导航 (使用 NavLink)

```tsx
<NavLink to="/dashboard" className={({ isActive }) =>
  `nav-item ${isActive ? 'bg-[var(--border-light)]' : 'bg-transparent'}`
}>
  🏠 Home
</NavLink>
```

---

## 6. Phase 3: Supabase 基础设施与 Auth

### 6.1 安装依赖

```bash
npm install @supabase/supabase-js
```

### 6.2 Supabase Client 初始化 (Main Process)

```typescript
// src/main/supabase-client.ts
import { createClient } from '@supabase/supabase-js'
import Store from 'electron-store'
import { safeStorage } from 'electron'

const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...'

// 自定义 storage adapter: 使用 electron-store + safeStorage 加密
const sessionStore = new Store({ name: 'supabase-session' })

const customStorage = {
  getItem: (key: string): string | null => {
    const encrypted = sessionStore.get(key) as string | undefined
    if (!encrypted) return null
    try {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    } catch { return null }
  },
  setItem: (key: string, value: string): void => {
    const encrypted = safeStorage.encryptString(value).toString('base64')
    sessionStore.set(key, encrypted)
  },
  removeItem: (key: string): void => {
    sessionStore.delete(key)
  },
}

let client: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,  // Electron 不需要 URL 检测
      },
    })
  }
  return client
}
```

### 6.3 Auth Service (Main Process)

```typescript
// src/main/auth-service.ts
import { getSupabaseClient } from './supabase-client'

export class AuthService {
  async signUp(email: string, password: string, displayName: string) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } }
    })
    if (error) return { success: false, error: this.getErrorMessage(error) }
    return { success: true, user: { id: data.user!.id, email, displayName } }
  }

  async signIn(email: string, password: string) {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: this.getErrorMessage(error) }
    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email!,
        displayName: data.user.user_metadata?.display_name || ''
      }
    }
  }

  async signOut() {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signOut()
    return { success: !error, error: error?.message }
  }

  async getSession() {
    const supabase = getSupabaseClient()
    const { data } = await supabase.auth.getSession()
    if (!data.session) return { isAuthenticated: false }
    return {
      isAuthenticated: true,
      user: {
        id: data.session.user.id,
        email: data.session.user.email!,
        displayName: data.session.user.user_metadata?.display_name || ''
      }
    }
  }

  private getErrorMessage(error: any): string {
    switch (error.code) {
      case 'invalid_credentials': return '邮箱或密码错误'
      case 'email_not_confirmed': return '请先验证邮箱地址'
      case 'user_already_exists': return '该邮箱已注册'
      case 'weak_password': return '密码太弱，至少需要6个字符'
      default: break
    }
    if (error.message?.includes('Invalid login credentials')) return '邮箱或密码错误'
    if (error.status === 429) return '尝试次数过多，请稍后再试'
    return error.message || '发生未知错误'
  }
}
```

### 6.4 Login 页面集成

Login 页面的 UI 来自 Phase 0 (Pencil 生成的 `LoginPage.tsx`)。功能集成:
- "Continue with email" 按钮点击 → 展开 email/password 表单
- 表单提交 → `window.electronAPI.authSignIn(email, password)`
- 成功 → `navigate('/dashboard')`
- 失败 → 显示错误信息
- "Continue with Google" / "Continue with Apple" → Toast "Coming soon"

### 6.5 Supabase Dashboard 配置清单

1. 创建新项目
2. Authentication > Providers > Email: 启用
3. Authentication > Email Templates: 保持默认 (或关闭 Confirm Email 便于开发)
4. 运行 Section 11 的全部 SQL
5. 记录 Project URL 和 anon key

---

## 7. Phase 4: History 真实功能

### 7.1 转录管道集成 (在现有 IPC handler 中追加)

```
现有流程:
  audio → transcribe → inject text → show result in overlay

新增 (fire-and-forget, 不阻塞主流程):
  audio → transcribe → inject text → show result in overlay
                                   └→ [NEW] historyService.save(record).catch(console.error)
```

**关键**: `save()` 使用 `.catch()` 兜底，绝不影响主流程。如果用户未登录，`save()` 直接 return。

### 7.2 History Service

```typescript
// src/main/history-service.ts
export class HistoryService {
  async save(record: {
    original_text: string
    optimized_text: string | null
    app_context: string | null
    duration_seconds: number | null
  }) {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return  // 未登录, 不保存

    await supabase.from('transcription_history').insert({
      user_id: session.user.id,
      ...record
    })
  }

  async list(page: number, pageSize: number) {
    const supabase = getSupabaseClient()
    const from = page * pageSize
    const to = from + pageSize - 1

    const { data, count } = await supabase
      .from('transcription_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    return { data: data || [], total: count || 0 }
  }

  async delete(id: string) {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from('transcription_history').delete().eq('id', id)
    return { success: !error, error: error?.message }
  }
}
```

### 7.3 History 页面数据流

```
HistoryPage mount
  → window.electronAPI.historyList(0, 50)
  → Main Process: historyService.list(0, 50)
  → Supabase: SELECT * FROM transcription_history WHERE user_id = auth.uid() ORDER BY created_at DESC
  → 返回 { data: [...], total: N }
  → UI 按日期分组 (Today / Yesterday / Earlier)
  → 每条: 时间戳 (IBM Plex Mono) + optimized_text 预览 (DM Sans)
```

---

## 8. Phase 5: Fake 页面

### 8.1 Dashboard (静态)

- 统计卡片: 硬编码 `7.6%`, `1 hr 57 min`, `15.2K`
- Refer friends / Affiliate: 静态展示
- Feedback input: 可输入但提交后 toast "Coming soon"
- 所有按钮点击 → toast "Coming soon"

### 8.2 Dictionary (静态)

- 词汇网格: 硬编码 24 个示例词
- "New word" 按钮 → toast "Coming soon"
- 搜索 / 筛选 → 不可用
- Filter tabs (All / My Words): 切换无效果

---

## 9. Phase 6: 全链路整合

### 9.1 检查清单

- [ ] 侧边栏 NavLink active 状态正确
- [ ] 未登录 → 自动跳转 /login
- [ ] 已登录 → 自动跳转 /dashboard
- [ ] Sign Out → 清除 session → 跳转 /login
- [ ] Tray "Open Typeless" → 显示/隐藏 Main Window
- [ ] 关闭 Main Window (红色 traffic light) → 隐藏而非销毁
- [ ] Overlay 录音功能完全不受影响
- [ ] 转录成功 → 自动存入 History (如果已登录)
- [ ] History 页面显示真实数据
- [ ] 字体一致: Instrument Serif (标题), DM Sans (正文), IBM Plex Mono (数据)
- [ ] 颜色一致: 所有 CSS 变量与 Pencil 设计一致

---

## 10. Phase 7: DMG 打包

### 10.1 forge.config.ts 修改

```typescript
// 条件化 signing/notarization
const shouldSign = !!process.env.APPLE_ID;

packagerConfig: {
  asar: true,
  appBundleId: 'com.junyuwang.typeless',
  ...(shouldSign ? {
    osxSign: { identity: 'Developer ID Application', ... },
    osxNotarize: { ... },
  } : {
    osxSign: { identity: '-' },  // Ad-hoc signing (Apple Silicon 必须)
  }),
}
```

### 10.2 构建命令

```bash
# 无签名构建 (开发/测试)
unset APPLE_ID && rm -rf out/ && npm run make

# 输出: out/make/Typeless-0.1.0-arm64.dmg
```

### 10.3 安装说明 (给用户)

```
1. 下载 Typeless.dmg
2. 双击打开 DMG
3. 拖动 Typeless 到 Applications
4. 打开 Terminal, 运行: xattr -r -d com.apple.quarantine /Applications/Typeless.app
5. 打开 Typeless
```

---

## 11. 数据库完整设计

### 11.1 ER 关系图

```
auth.users (Supabase 内置)
    │
    ├── 1:1 ── user_profiles
    │             id (FK → auth.users.id)
    │             display_name
    │             email
    │             trial_ends_at
    │
    ├── 1:N ── transcription_history
    │             id (PK, UUID)
    │             user_id (FK → auth.users.id)
    │             original_text
    │             optimized_text
    │             app_context
    │             created_at
    │
    └── 1:N ── user_dictionary (未来)
                  id (PK, UUID)
                  user_id (FK → auth.users.id)
                  term
                  replacement
                  category
```

### 11.2 完整 SQL

```sql
-- ============================================================
-- 1. user_profiles: 用户扩展信息
-- ============================================================
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days') NOT NULL
);

-- 自动创建 profile (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- 2. transcription_history: 转录历史
-- ============================================================
CREATE TABLE public.transcription_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  optimized_text TEXT,
  app_context TEXT,           -- 录音时活跃的应用名称
  language TEXT,              -- 检测到的语言
  duration_seconds REAL,      -- 录音时长 (秒)
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 索引
CREATE INDEX idx_history_user_created ON public.transcription_history(user_id, created_at DESC);
CREATE INDEX idx_history_text_search ON public.transcription_history
  USING gin(to_tsvector('simple', coalesce(original_text, '') || ' ' || coalesce(optimized_text, '')));

-- RLS
ALTER TABLE public.transcription_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own history" ON public.transcription_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own history" ON public.transcription_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own history" ON public.transcription_history
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 3. user_dictionary (未来, 先建表不用)
-- ============================================================
CREATE TABLE public.user_dictionary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  replacement TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_dictionary_user ON public.user_dictionary(user_id);
CREATE UNIQUE INDEX idx_dictionary_unique_term ON public.user_dictionary(user_id, lower(term));

ALTER TABLE public.user_dictionary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own dictionary" ON public.user_dictionary
  FOR ALL USING (auth.uid() = user_id);
```

---

## 12. API / IPC 接口完整定义

### 12.1 IPC Channel 总览

所有新增 channel 定义在 `src/shared/constants.ts`:

```typescript
export const IPC_CHANNELS = {
  // ... 现有 channels 不变 ...

  // Auth (renderer → main, invoke)
  AUTH_SIGN_UP: 'auth:sign-up',
  AUTH_SIGN_IN: 'auth:sign-in',
  AUTH_SIGN_OUT: 'auth:sign-out',
  AUTH_GET_SESSION: 'auth:get-session',

  // Auth (main → renderer, send/push)
  AUTH_STATE_CHANGED: 'auth:state-changed',

  // History (renderer → main, invoke)
  HISTORY_LIST: 'history:list',
  HISTORY_DELETE: 'history:delete',

  // Profile (renderer → main, invoke)
  PROFILE_GET: 'profile:get',
  PROFILE_UPDATE: 'profile:update',
} as const;
```

### 12.2 接口定义 (Request / Response)

#### AUTH_SIGN_UP
```
Direction: renderer → main (ipcRenderer.invoke)
Request:  { email: string, password: string, displayName: string }
Response: { success: true, user: { id, email, displayName } }
        | { success: false, error: string }
```

#### AUTH_SIGN_IN
```
Direction: renderer → main (ipcRenderer.invoke)
Request:  { email: string, password: string }
Response: { success: true, user: { id, email, displayName } }
        | { success: false, error: string }
```

#### AUTH_SIGN_OUT
```
Direction: renderer → main (ipcRenderer.invoke)
Request:  (no params)
Response: { success: boolean, error?: string }
```

#### AUTH_GET_SESSION
```
Direction: renderer → main (ipcRenderer.invoke)
Request:  (no params)
Response: { isAuthenticated: false }
        | { isAuthenticated: true, user: { id, email, displayName } }
```

#### AUTH_STATE_CHANGED
```
Direction: main → renderer (webContents.send, push)
Payload: { user: { id, email, displayName } | null }
```

#### HISTORY_LIST
```
Direction: renderer → main (ipcRenderer.invoke)
Request:  { page: number, pageSize: number }
Response: {
  data: Array<{
    id: string
    original_text: string
    optimized_text: string | null
    app_context: string | null
    created_at: string  // ISO 8601
  }>,
  total: number
}
```

#### HISTORY_DELETE
```
Direction: renderer → main (ipcRenderer.invoke)
Request:  { id: string }
Response: { success: boolean, error?: string }
```

#### PROFILE_GET
```
Direction: renderer → main (ipcRenderer.invoke)
Request:  (no params)
Response: {
  displayName: string
  email: string
  trialEndsAt: string  // ISO 8601
} | null
```

#### PROFILE_UPDATE
```
Direction: renderer → main (ipcRenderer.invoke)
Request:  { displayName: string }
Response: { success: boolean, error?: string }
```

### 12.3 Preload Bridge 扩展

在 `src/preload.ts` 中新增:

```typescript
// Auth
authSignUp: (email, password, displayName) =>
  ipcRenderer.invoke(IPC_CHANNELS.AUTH_SIGN_UP, { email, password, displayName }),
authSignIn: (email, password) =>
  ipcRenderer.invoke(IPC_CHANNELS.AUTH_SIGN_IN, { email, password }),
authSignOut: () =>
  ipcRenderer.invoke(IPC_CHANNELS.AUTH_SIGN_OUT),
authGetSession: () =>
  ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_SESSION),
onAuthStateChanged: (callback) => {
  const handler = (_event, data) => callback(data.user);
  ipcRenderer.on(IPC_CHANNELS.AUTH_STATE_CHANGED, handler);
  return () => ipcRenderer.removeListener(IPC_CHANNELS.AUTH_STATE_CHANGED, handler);
},

// History
historyList: (page, pageSize) =>
  ipcRenderer.invoke(IPC_CHANNELS.HISTORY_LIST, { page, pageSize }),
historyDelete: (id) =>
  ipcRenderer.invoke(IPC_CHANNELS.HISTORY_DELETE, { id }),

// Profile
profileGet: () =>
  ipcRenderer.invoke(IPC_CHANNELS.PROFILE_GET),
profileUpdate: (data) =>
  ipcRenderer.invoke(IPC_CHANNELS.PROFILE_UPDATE, data),
```

---

## 13. 参考研究文档索引

所有详细研究报告已保存在 `docs/` 目录:

| 文件 | 内容 | 关键发现 |
|------|------|---------|
| `research-pencil-codegen.md` | Pencil → React 代码生成完整指南 | 4个页面完整节点树分析、字体/颜色/间距 token、共享组件提取、Electron 注意事项 |
| `research-supabase-detailed.md` | Supabase 集成完整技术设计 | DB schema SQL、Auth flow 详细时序、IPC channel 设计、Session 加密存储、Google OAuth 未来方案 |
| `research-electron-multiwindow.md` | Electron 双窗口架构设计 | 两个 renderer entry 方案、forge.config.ts diff、HashRouter 选型、窗口生命周期、Tray 集成 |
| `research-dmg-packaging.md` | DMG 打包与环境变量 | 条件化 signing、VITE_ 变量工作机制、FusesPlugin 兼容性、macOS Sequoia 注意事项 |
| `research-supabase-integration.md` | 早期 Supabase 调研 (已有) | 方案对比、基础代码示例 |

---

## Agent Team 任务分配

| Agent | 职责 | Phases | 预计工作量 |
|-------|------|--------|-----------|
| **pencil-codegen** | 用 Pencil MCP 生成 4 个页面 React 代码 + 共享组件 | Phase 0 | 大 (需要多轮 MCP 调用) |
| **electron-infra** | 双窗口基础设施 + forge config + Tray 集成 | Phase 1, 部分 Phase 6 | 中 |
| **frontend-router** | react-router 路由 + 布局组件 + 页面接入 | Phase 2, Phase 5 | 中 |
| **supabase-backend** | Supabase client + Auth + History service + IPC handlers | Phase 3, Phase 4 | 大 |
| **integration-qa** | 全链路整合 + 样式统一 + 打包 | Phase 6, Phase 7 | 中 |

**并行策略:**
- `pencil-codegen` 和 `electron-infra` 可同时启动
- `frontend-router` 等待 Phase 0 + Phase 1 完成
- `supabase-backend` 可在 Phase 0 完成前开始 (建表、写 service、IPC handler)
- `integration-qa` 等待所有 Phase 完成
