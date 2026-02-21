# Electron + Pencil 集成技术调研报告

## 1. Pencil MCP 概述

### 1.1 什么是 Pencil

Pencil (Pencil.dev) 是一个 AI 原生的前端设计工具，直接嵌入 IDE（VS Code / Cursor）中使用。它通过 **Model Context Protocol (MCP)** 让 AI 代理（如 Claude Code）读取设计文件中的精确坐标、Token 和结构信息，生成像素级精确的 React 代码。

核心价值：**Vector-to-Code**（而非 Image-to-Code），AI 直接读取矢量节点信息（如 `padding-left: 1rem`）生成对应代码（如 `p-4`），而非从截图猜测。

### 1.2 .pen 文件格式

- **基于 JSON 的开放格式**，轻量且可版本控制
- 文件存储在代码仓库中，可随代码一起 commit、branch、merge
- 存储内容：图层层级、坐标/间距值、Auto Layout 约束、设计 Token 引用

### 1.3 MCP Server 架构

Pencil MCP Server **本地运行**，无云端依赖。设计文件保持在本地。

提供的 MCP 工具：

| 工具 | 功能 |
|------|------|
| `batch_design` | 创建、修改、操作元素（插入、复制、更新、替换、移动、删除） |
| `batch_get` | 读取设计组件、层级检查、模式匹配元素搜索 |
| `get_screenshot` | 渲染预览、对比修改前后视觉效果 |
| `snapshot_layout` | 分析结构、检测定位问题、识别重叠元素 |
| `get_editor_state` | 获取当前上下文、选中信息、活跃文件 |
| `get_variables / set_variables` | 读取设计 Token、更新主题值、同步 CSS |

### 1.4 运行时依赖

- Pencil 应用实例（桌面应用或 IDE 扩展）
- 支持 MCP 的 AI 助手（Claude Code、Cursor、Codex 等）
- **不需要额外的 JS 框架或构建工具**——集成到现有项目中

---

## 2. 代码生成机制

### 2.1 生成流程

```
设计 (.pen 文件) → AI 读取 MCP 工具 → 分析矢量结构 → 生成 React 组件 (.tsx)
```

1. **设计阶段**：在 .pen 文件中创建设计（无限画布、8px 网格对齐），可从 Figma 复制粘贴导入
2. **提示阶段**：向 AI 发出结构化提示，如 "读取 dashboard.pen 中选中的 frame，生成使用 Tailwind CSS 的 React 组件"
3. **生成阶段**：AI 通过 MCP 读取精确的坐标、Token、结构，输出匹配设计规范的代码
4. **迭代阶段**：在 Pencil 中调整视觉，然后指示 AI 更新代码（单向流：设计 → 代码）

### 2.2 生成代码特征

- **框架**：React (.tsx 组件)
- **样式**：Tailwind CSS（强推荐）、HTML/CSS
- **特点**：
  - 使用 CSS 变量（`bg-primary`）而非硬编码颜色值
  - 间距对齐到标准 Tailwind 类（`p-4`, `text-lg`）
  - 支持 Shadcn UI、Lucide React Icons 等组件库
  - 生成响应式代码（`flex-col` → `flex-row`）

### 2.3 生成代码的依赖

生成的代码通常依赖：
- `react` / `react-dom`（项目已有）
- `tailwindcss`（项目已有 v4.2）
- 可选：`lucide-react`（图标库）、`@shadcn/ui`（组件库）

**结论：生成代码不需要任何 Pencil 运行时库，是纯标准 React + Tailwind 代码。**

### 2.4 Design Token 管理

推荐创建 `tokens.md` 文件定义设计系统规则：
- 颜色变量
- 字体大小规范
- 间距规范

在提示中引用：*"所有生成代码必须严格遵循 `@tokens.md` 中定义的设计 Token。不使用任意像素值。"*

---

## 3. Electron 多窗口架构方案

### 3.1 当前项目架构分析

```
typeless-fake/
├── src/
│   ├── main.ts                          # Electron 主进程入口
│   ├── preload.ts                       # 预加载脚本（contextBridge）
│   ├── renderer.ts                      # 渲染进程入口
│   ├── index.css                        # 全局样式（overlay 专用）
│   ├── main/                            # 主进程模块
│   │   ├── overlay-window.ts            # overlay 窗口创建
│   │   ├── ipc-handlers.ts              # IPC 消息处理
│   │   ├── shortcut-manager.ts          # 快捷键管理
│   │   ├── transcription-service.ts     # 转录服务
│   │   ├── text-injector.ts             # 文本注入
│   │   ├── tray-manager.ts              # 系统托盘
│   │   └── config-store.ts              # 配置存储
│   ├── renderer/                        # 渲染进程（React）
│   │   ├── App.tsx                      # 仅渲染 <Overlay/>
│   │   ├── components/
│   │   │   ├── Overlay.tsx              # 录音状态浮窗
│   │   │   └── WaveformAnimation.tsx    # 波形动画
│   │   ├── services/
│   │   │   ├── audio-recorder.ts        # 录音服务
│   │   │   └── sound-effects.ts         # 音效
│   │   └── stores/
│   │       └── app-store.ts             # Zustand 状态管理
│   └── shared/                          # 共享类型和常量
│       ├── constants.ts
│       └── types.ts
├── index.html                           # 渲染进程入口 HTML
├── forge.config.ts                      # Electron Forge 配置
├── vite.renderer.config.ts              # Vite 渲染进程配置（目前为空）
├── vite.main.config.ts                  # Vite 主进程配置
└── vite.preload.config.ts               # Vite 预加载配置
```

**关键发现**：

1. **单窗口应用**：目前只有一个 `overlayWindow`，是一个透明的浮窗
2. **托盘驱动**：`window-all-closed` 事件不退出应用，是典型的系统托盘应用
3. **Electron Forge + Vite**：使用 `@electron-forge/plugin-vite` 构建
4. **单一 renderer**：`forge.config.ts` 只配置了一个 `main_window` renderer
5. **overlay 窗口特性**：`transparent: true`, `frame: false`, `alwaysOnTop: true`, `focusable: false`
6. **现有 IPC 通道**：录音控制、转录结果、状态更新、设置管理

### 3.2 多窗口方案设计

#### 方案 A：多 renderer 入口（推荐）

为不同窗口创建独立的 HTML 入口和 renderer，通过 Electron Forge Vite 插件的多 renderer 配置实现。

```
修改 forge.config.ts：
renderer: [
  {
    name: 'main_window',           // 现有 overlay
    config: 'vite.renderer.config.ts',
  },
  {
    name: 'ui_window',             // 新增 UI 窗口
    config: 'vite.ui.config.ts',
  },
]
```

**目录结构变化**：
```
src/
├── renderer.ts              # overlay renderer 入口（不变）
├── ui-renderer.ts           # 新的 UI renderer 入口
├── index.html               # overlay HTML（不变）
├── ui.html                  # UI 窗口 HTML
├── renderer/                # overlay 组件（不变）
└── ui/                      # UI 窗口组件（新增）
    ├── App.tsx              # UI 应用根组件
    ├── pages/
    │   ├── Login.tsx        # 登录页
    │   ├── Dashboard.tsx    # 主面板
    │   └── History.tsx      # 历史记录
    ├── components/          # UI 共享组件
    └── stores/              # UI 状态管理
```

**优势**：
- overlay 窗口完全不受影响
- 独立的样式体系（overlay 用纯 CSS，UI 用 Tailwind）
- 独立的打包和优化
- 符合 Electron Forge Vite 插件的原生多 renderer 支持

**劣势**：
- 需要新增 Vite 配置文件和 HTML 入口
- 两个 renderer 之间不能直接共享 React 状态

#### 方案 B：单 renderer + React Router

在现有 renderer 中加入 React Router，根据 URL hash 或 query parameter 渲染不同页面。

```tsx
// App.tsx
const App = () => {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') || 'overlay';

  switch (view) {
    case 'overlay': return <Overlay />;
    case 'login': return <Login />;
    case 'dashboard': return <Dashboard />;
    default: return <Overlay />;
  }
};
```

```ts
// 主进程加载不同视图
overlayWindow.loadURL(`${devServerUrl}?view=overlay`);
uiWindow.loadURL(`${devServerUrl}?view=dashboard`);
```

**优势**：
- 配置简单，无需修改 Forge/Vite 配置
- 可共享组件和状态逻辑

**劣势**：
- overlay 的全局样式会影响 UI 窗口
- 打包体积增加（每个窗口都加载完整代码）
- overlay 的 `transparent` 背景和特殊 CSS 会与 UI 窗口冲突

#### 推荐：方案 A（多 renderer 入口）

理由：
1. overlay 窗口有特殊需求（透明、无框、always-on-top、不可聚焦），与标准 UI 窗口差异极大
2. 样式隔离是硬需求：overlay 用 `background: transparent`，UI 窗口需要正常背景
3. Pencil 生成的 Tailwind 代码可以直接放入 `src/ui/` 目录，不会影响 overlay

### 3.3 窗口管理器设计

```ts
// src/main/window-manager.ts
import { BrowserWindow } from 'electron';

class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();

  create(name: string, options: Electron.BrowserWindowConstructorOptions): BrowserWindow {
    const existing = this.windows.get(name);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return existing;
    }

    const win = new BrowserWindow(options);
    this.windows.set(name, win);

    win.on('closed', () => {
      this.windows.delete(name);
    });

    return win;
  }

  get(name: string): BrowserWindow | null {
    const win = this.windows.get(name);
    return (win && !win.isDestroyed()) ? win : null;
  }

  closeAll(): void {
    for (const [, win] of this.windows) {
      if (!win.isDestroyed()) win.close();
    }
  }
}

export const windowManager = new WindowManager();
```

### 3.4 窗口间通信机制

**推荐方案：Main 进程中转 + IPC**

```
UI Window ──IPC──> Main Process ──IPC──> Overlay Window
                      │
                      └──> 业务逻辑处理
```

1. **UI → Main**：使用 `ipcRenderer.invoke()` / `ipcRenderer.send()`
2. **Main → Overlay**：使用 `overlayWindow.webContents.send()`
3. **Main → UI**：使用 `uiWindow.webContents.send()`

**补充方案：Broadcast Channel API**

如果 UI 窗口和 overlay 在同一域下，可以使用 Broadcast Channel 进行直接通信：

```ts
// 任意 renderer
const channel = new BroadcastChannel('typeless');
channel.postMessage({ type: 'settings-updated', data: newSettings });

// 另一个 renderer
const channel = new BroadcastChannel('typeless');
channel.onmessage = (event) => {
  if (event.data.type === 'settings-updated') {
    // 更新本地状态
  }
};
```

### 3.5 登录流程与窗口生命周期

```
App 启动
  │
  ├─ 检查登录状态
  │   ├─ 未登录 → 显示 Login Window
  │   │            │
  │   │            └─ 登录成功 → 关闭 Login → 显示 Dashboard
  │   │
  │   └─ 已登录 → 显示 Dashboard + 初始化 Overlay
  │
  └─ 始终初始化：Tray + Overlay（隐藏状态）

Dashboard Window
  ├─ 显示用户信息、使用统计
  ├─ 管理设置
  ├─ 查看历史记录
  └─ 关闭时 → 隐藏到托盘（不退出应用）

Overlay Window
  ├─ 始终存在（hidden 状态）
  ├─ 快捷键触发时显示
  └─ 完成录音/转录后自动隐藏
```

---

## 4. 集成方案建议

### 4.1 Pencil 设计到 Electron UI 的完整工作流

```
1. 在 Pencil 中设计 UI
   └── 创建 login.pen, dashboard.pen, history.pen

2. 使用 AI 生成 React 组件
   └── Claude Code 读取 .pen → 生成 .tsx + Tailwind CSS

3. 将生成代码集成到项目
   └── 放入 src/ui/pages/ 和 src/ui/components/

4. Electron 多窗口加载
   └── UI Window 加载 ui.html → 渲染 Pencil 生成的 React 组件
```

### 4.2 Vite 配置调整

#### 新增 UI renderer 配置

```ts
// vite.ui.config.ts
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  // Pencil 生成的代码使用 Tailwind，在这里启用
});
```

#### 修改 Forge 配置

```ts
// forge.config.ts - VitePlugin 部分
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
      name: 'main_window',      // overlay - 保持不变
      config: 'vite.renderer.config.ts',
    },
    {
      name: 'ui_window',        // 新增 UI 窗口
      config: 'vite.ui.config.ts',
    },
  ],
}),
```

#### 新增 UI 入口文件

```html
<!-- ui.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Typeless</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/ui-renderer.ts"></script>
</body>
</html>
```

```ts
// src/ui-renderer.ts
import './ui/styles/index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';

const root = document.getElementById('app');
if (root) {
  createRoot(root).render(React.createElement(App));
}
```

### 4.3 UI 窗口创建

```ts
// src/main/ui-window.ts
import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

declare const UI_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const UI_WINDOW_VITE_NAME: string;

export function createUIWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 720,
    minHeight: 500,
    x: Math.round((width - 900) / 2),
    y: Math.round((height - 640) / 2),
    titleBarStyle: 'hiddenInset',   // macOS 原生标题栏
    trafficLightPosition: { x: 16, y: 18 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 可以创建独立的 preload 或复用现有的（取决于 UI 窗口的 IPC 需求）
  if (UI_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(UI_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(
      path.join(__dirname, `../renderer/${UI_WINDOW_VITE_NAME}/index.html`)
    );
  }

  win.once('ready-to-show', () => win.show());

  return win;
}
```

### 4.4 Preload 脚本策略

**推荐：创建独立的 UI preload 脚本**

```ts
// src/ui-preload.ts
import { contextBridge, ipcRenderer } from 'electron';

const uiAPI = {
  // 认证相关
  login: (credentials: { email: string; password: string }) =>
    ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getSession: () => ipcRenderer.invoke('auth:get-session'),

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.send('settings:set', settings),

  // 历史记录
  getHistory: () => ipcRenderer.invoke('history:get'),

  // 窗口控制
  closeWindow: () => ipcRenderer.send('window:close'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
};

contextBridge.exposeInMainWorld('uiAPI', uiAPI);
```

在 `forge.config.ts` 中添加：
```ts
build: [
  // ... 现有的
  {
    entry: 'src/ui-preload.ts',
    config: 'vite.preload.config.ts',
    target: 'preload',
  },
],
```

### 4.5 Pencil 生成代码的放置位置

```
src/ui/
├── App.tsx                    # UI 应用根组件 + 路由
├── styles/
│   └── index.css              # Tailwind 入口 + 全局 UI 样式
├── pages/                     # Pencil 生成的页面组件
│   ├── Login.tsx              # ← 从 login.pen 生成
│   ├── Dashboard.tsx          # ← 从 dashboard.pen 生成
│   └── History.tsx            # ← 从 history.pen 生成
├── components/                # Pencil 生成的共享组件
│   ├── Sidebar.tsx
│   ├── StatsCard.tsx
│   └── ...
└── stores/                    # UI 状态管理
    └── ui-store.ts
```

### 4.6 路由方案

**推荐：简单的 hash-based 路由（无需 react-router）**

UI 窗口内的页面切换可以使用 Zustand store 管理，避免引入额外依赖：

```tsx
// src/ui/App.tsx
import { useUIStore } from './stores/ui-store';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import History from './pages/History';

const pages = {
  login: Login,
  dashboard: Dashboard,
  history: History,
} as const;

export default function App() {
  const currentPage = useUIStore(s => s.currentPage);
  const Page = pages[currentPage];
  return <Page />;
}
```

如果后续页面复杂度增加，可以考虑引入 `react-router-dom`。

---

## 5. 潜在风险和注意事项

### 5.1 内存开销

| 风险 | 说明 | 缓解策略 |
|------|------|----------|
| 多窗口内存占用 | 每个 BrowserWindow 增加 ~150-250MB 内存 | Login 完成后关闭（非隐藏）；UI 窗口关闭时真正关闭 |
| 隐藏窗口泄露 | `browserWindow.hide()` 可能导致内存泄露 | 对 overlay 已有此问题；UI 窗口优先使用 close + recreate 模式 |

### 5.2 样式隔离

| 风险 | 说明 | 缓解策略 |
|------|------|----------|
| overlay 样式污染 | overlay 使用 `background: transparent` 和自定义 CSS | 使用多 renderer 方案天然隔离 |
| Tailwind 类冲突 | Pencil 生成的 Tailwind 类可能与 overlay 冲突 | 多 renderer 方案下各自独立的 CSS 入口 |
| 字体渲染差异 | 浏览器引擎与 Pencil 画布的字体渲染不完全一致 | 使用标准化字号（text-sm, text-lg 等） |

### 5.3 Pencil 相关

| 风险 | 说明 | 缓解策略 |
|------|------|----------|
| LLM 锁定 | Pencil 目前主要优化 Claude Code | 项目已使用 Claude Code，无影响 |
| Auto Layout 复杂性 | 复杂 Auto Layout 转换可能有小 Bug | 生成后人工检查关键布局 |
| 颜色转换误差 | RGB/HSL 转换可能导致颜色偏差 | 使用 CSS 变量统一管理，不使用硬编码色值 |
| 图标模糊 | PNG 导入可能导致模糊 | 使用 SVG 或 lucide-react 图标库 |

### 5.4 开发体验

| 风险 | 说明 | 缓解策略 |
|------|------|----------|
| HMR 多窗口 | 多 renderer 的 HMR 可能不稳定 | Electron Forge Vite 插件原生支持，但需测试 |
| 调试复杂度 | 多个 DevTools 窗口 | 为每个窗口配置独立 DevTools；使用 `win.webContents.openDevTools()` |
| Preload 多版本 | 不同窗口可能需要不同 preload | 初期可以复用同一 preload，后续按需拆分 |

### 5.5 构建与分发

| 风险 | 说明 | 缓解策略 |
|------|------|----------|
| 包体积增长 | 新增 renderer 增加 ASAR 体积 | React 和 Tailwind 已是共享依赖，增量较小 |
| 代码签名 | 已有签名配置，新增窗口不影响 | 验证多 renderer 打包后签名正常 |

### 5.6 IPC 安全

| 风险 | 说明 | 缓解策略 |
|------|------|----------|
| IPC 通道冲突 | 新增通道可能与现有通道命名冲突 | 使用 namespace 前缀（如 `ui:`, `auth:`, `overlay:`） |
| 窗口越权通信 | UI 窗口不应控制 overlay 的录音逻辑 | 在 preload 中严格限制暴露的 API |

---

## 6. 参考资料

### Pencil MCP
- [Pencil AI Integration - 官方文档](https://docs.pencil.dev/getting-started/ai-integration)
- [Pencil Installation - 官方文档](https://docs.pencil.dev/getting-started/installation)
- [Pencil.dev Review: The Complete Guide to AI Vibe Coding for 2026](https://invernessdesignstudio.com/pencil-dev-review-the-complete-guide-to-ai-vibe-coding-for-2026)
- [Pencil.dev: Bridging the Design-to-Code Gap in Modern Development (Medium)](https://medium.com/@tentenco/pencil-dev-bridging-the-design-to-code-gap-in-modern-development-fede236fa551)

### Electron 多窗口
- [Multiple Windows in Electron apps - bloomca.me](https://blog.bloomca.me/2025/07/21/multi-window-in-electron.html)
- [Creating multi-window Electron apps using React portals](https://pietrasiak.com/creating-multi-window-electron-apps-using-react-portals)
- [Streamlining Electron IPC with Scoped Window Managers (Medium)](https://medium.com/@ydeshayes/streamlining-electron-ipc-with-scoped-window-managers-fbf1e9636eb2)
- [Electron Process Model - 官方文档](https://www.electronjs.org/docs/latest/tutorial/process-model)

### Electron Forge + Vite
- [open multiple Renderer windows - electron-vite/vite-plugin-electron #17](https://github.com/electron-vite/vite-plugin-electron/issues/17)
- [electron-vite Development Guide](https://electron-vite.org/guide/dev)
