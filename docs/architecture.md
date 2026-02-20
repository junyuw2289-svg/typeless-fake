# Typeless 复刻版 - 技术架构设计文档

## 1. 项目概述

复刻 Typeless 的核心功能：通过全局快捷键触发语音识别，将语音实时转录为文本并自动输入到当前活跃的应用程序中。

### 1.1 核心功能（按优先级）

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | 全局快捷键触发录音 | 按住 Fn 键开始录音，松开停止 |
| P0 | 语音转文字 | 将录音发送到 STT API 进行转录 |
| P0 | 自动输入文本 | 将转录结果自动输入到当前焦点应用 |
| P1 | 系统托盘常驻 | 后台运行，最小化到系统托盘 |
| P1 | 录音状态指示 | 浮动小窗口显示录音状态 |
| P2 | 去除填充词 | 自动去掉 "嗯"、"那个" 等口语填充词 |
| P2 | 多语言支持 | 支持中文、英文等多语言 |
| P3 | 个人词典 | 自定义专业术语和名称 |
| P3 | 语境感知格式化 | 根据应用类型调整输出格式 |

---

## 2. 技术栈选择

### 2.1 应用框架：Electron

**选择理由：**
- **跨平台能力**：一套代码支持 macOS、Windows、Linux
- **成熟稳定**：VS Code、Slack 等大型应用验证，生态完善
- **Web 技术栈**：React + TypeScript 开发效率高
- **原生 API 访问**：`globalShortcut`、`Tray`、`clipboard` 等模块直接可用
- **音频能力**：Chromium 内置 Web Audio API 和 MediaRecorder，无需额外依赖

**对比 Tauri 的考虑：**
Tauri 更轻量（<10MB vs >100MB），但 Electron 在音频处理和系统级 API 方面更成熟，且不需要学习 Rust。对于语音录制这种需要稳定 Web Audio 支持的场景，Electron 内置 Chromium 更可靠。

### 2.2 前端框架：React 18 + TypeScript

**选择理由：**
- 组件化开发，状态管理清晰
- TypeScript 提供类型安全
- 丰富的 React 生态（状态管理、UI 组件）
- 开发团队熟悉度高

### 2.3 语音识别方案：OpenAI Whisper API（主选）+ Deepgram（备选）

**主选方案 - OpenAI Whisper API：**
- `whisper-1` 模型，支持 100+ 种语言
- 价格：$0.006/分钟
- 支持流式响应（`stream=True`）
- 中文识别准确率高
- API 简单，集成成本低

**备选方案 - Deepgram Nova-3：**
- 原生实时流式转录，延迟更低（<1秒）
- 价格更低：$0.0043/分钟
- WER（词错误率）更低：5-7% vs ~10%
- 适合需要极低延迟的场景

**第一阶段采用 Whisper API 的理由：**
1. API 更简单，集成快
2. 中文支持成熟
3. 短句场景下延迟可接受（录完再发送）
4. 后期可平滑切换到 Deepgram 或本地模型

### 2.4 构建工具：Electron Forge + Vite

- **Electron Forge**：官方推荐的打包和分发工具
- **Vite**：快速的开发服务器和构建工具
- **electron-forge-plugin-vite**：集成 Vite 到 Electron Forge

### 2.5 关键依赖库

| 库 | 用途 | 说明 |
|----|------|------|
| `electron` | 桌面应用框架 | v28+ |
| `react` + `react-dom` | UI 框架 | v18 |
| `typescript` | 类型系统 | v5 |
| `openai` | OpenAI API 客户端 | 调用 Whisper API |
| `electron-store` | 持久化存储 | 配置、设置持久化 |
| `zustand` | 状态管理 | 轻量级，适合小型应用 |
| `tailwindcss` | CSS 工具类 | 快速 UI 开发 |

---

## 3. 系统架构

### 3.1 应用类型：桌面应用（Electron）

```
┌──────────────────────────────────────────────────┐
│                  Electron App                     │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │              Main Process                    │  │
│  │                                              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │  │
│  │  │ Global   │ │ System   │ │ Config      │  │  │
│  │  │ Shortcut │ │ Tray     │ │ Store       │  │  │
│  │  │ Manager  │ │ Manager  │ │             │  │  │
│  │  └────┬─────┘ └──────────┘ └─────────────┘  │  │
│  │       │                                      │  │
│  │  ┌────▼─────────────────────────────────┐    │  │
│  │  │        IPC Bridge (ipcMain)          │    │  │
│  │  └────┬─────────────────────────────────┘    │  │
│  │       │                                      │  │
│  │  ┌────▼─────┐ ┌──────────┐ ┌─────────────┐  │  │
│  │  │ Audio    │ │ Whisper  │ │ Text        │  │  │
│  │  │ Recorder │ │ API      │ │ Injector    │  │  │
│  │  │ Service  │ │ Client   │ │ (Clipboard  │  │  │
│  │  │          │ │          │ │  + Paste)   │  │  │
│  │  └──────────┘ └──────────┘ └─────────────┘  │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │           Renderer Process                   │  │
│  │                                              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │  │
│  │  │ Overlay  │ │ Settings │ │ State       │  │  │
│  │  │ Window   │ │ Panel    │ │ Management  │  │  │
│  │  │ (Status) │ │          │ │ (Zustand)   │  │  │
│  │  └──────────┘ └──────────┘ └─────────────┘  │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 3.2 模块划分

#### 主进程模块 (Main Process)

| 模块 | 职责 |
|------|------|
| **ShortcutManager** | 注册/注销全局快捷键，监听按下/松开事件 |
| **AudioService** | 控制麦克风录音的开始/停止，音频数据管理 |
| **TranscriptionService** | 调用 Whisper API 将音频转为文本 |
| **TextInjector** | 将转录文本写入剪贴板并模拟粘贴到目标应用 |
| **TrayManager** | 系统托盘图标管理，右键菜单 |
| **ConfigStore** | 用户设置的持久化存储（快捷键、API Key 等） |
| **IPCHandler** | 主进程与渲染进程之间的通信桥梁 |

#### 渲染进程模块 (Renderer Process)

| 模块 | 职责 |
|------|------|
| **OverlayWindow** | 浮动状态指示窗口（录音中/转录中/完成） |
| **SettingsPanel** | 设置界面（快捷键、API Key、语言选择） |
| **AppStore** | 全局状态管理（Zustand） |

### 3.3 数据流设计

```
用户按住快捷键 (Fn)
        │
        ▼
┌─────────────────┐
│ ShortcutManager  │──── globalShortcut.register()
│ (Main Process)   │
└────────┬────────┘
         │ IPC: 'recording:start'
         ▼
┌─────────────────┐     ┌──────────────┐
│ AudioService     │────▶│ OverlayWindow│
│ (Main Process)   │     │ 显示"录音中"  │
│ - MediaRecorder  │     └──────────────┘
│ - WAV/WebM 格式  │
└────────┬────────┘
         │ 用户松开快捷键
         │ IPC: 'recording:stop'
         ▼
┌─────────────────┐
│ AudioService     │
│ - 停止录音       │
│ - 生成音频 Blob  │
└────────┬────────┘
         │ audioBuffer
         ▼
┌─────────────────┐     ┌──────────────┐
│ Transcription    │────▶│ OverlayWindow│
│ Service          │     │ 显示"转录中"  │
│ - POST /v1/audio │     └──────────────┘
│   /transcriptions│
└────────┬────────┘
         │ transcribed text
         ▼
┌─────────────────┐     ┌──────────────┐
│ TextInjector     │────▶│ OverlayWindow│
│ - clipboard.     │     │ 显示"完成 ✓"  │
│   writeText()   │     │ 1秒后隐藏     │
│ - robot.keyTap  │     └──────────────┘
│   ('v', 'cmd')  │
└─────────────────┘
```

### 3.4 快捷键监听架构

Electron 的 `globalShortcut` 只支持按下事件，不支持按住/松开。为实现 "按住录音、松开停止" 的体验，需要特殊处理：

**方案 A：双击触发（推荐第一阶段使用）**
- 第一次按快捷键：开始录音
- 第二次按快捷键：停止录音并转录
- 实现简单，`globalShortcut` 直接支持

**方案 B：使用 `uiohook-napi` 监听原始键盘事件**
- 可以监听 keydown/keyup 事件
- 支持 Fn 键等特殊键
- 需要额外的原生依赖

**第一阶段采用方案 A**，后续迭代切换到方案 B 以匹配 Typeless 的原版体验。

---

## 4. 第一阶段实现方案：快捷键 + 语音转录

### 4.1 实现步骤

#### Step 1：项目初始化
```bash
npm init electron-app@latest typeless-fake -- --template=vite-typescript
cd typeless-fake
npm install react react-dom @types/react @types/react-dom
npm install openai electron-store zustand
npm install -D tailwindcss postcss autoprefixer
```

#### Step 2：主进程 - 快捷键管理
```typescript
// src/main/shortcut-manager.ts
import { globalShortcut, BrowserWindow } from 'electron';

export class ShortcutManager {
  private isRecording = false;
  private window: BrowserWindow;
  private hotkey = 'F2'; // 默认快捷键，可配置

  register() {
    globalShortcut.register(this.hotkey, () => {
      this.isRecording = !this.isRecording;
      if (this.isRecording) {
        this.window.webContents.send('recording:start');
      } else {
        this.window.webContents.send('recording:stop');
      }
    });
  }
}
```

#### Step 3：渲染进程 - 音频录制
```typescript
// src/renderer/services/audio-recorder.ts
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => this.chunks.push(e.data);
    this.mediaRecorder.start();
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        resolve(new Blob(this.chunks, { type: 'audio/webm' }));
      };
      this.mediaRecorder!.stop();
    });
  }
}
```

#### Step 4：主进程 - Whisper API 调用
```typescript
// src/main/transcription-service.ts
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class TranscriptionService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    // 将 buffer 写入临时文件
    const tempPath = path.join(app.getPath('temp'), 'recording.webm');
    fs.writeFileSync(tempPath, audioBuffer);

    const transcription = await this.client.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      language: 'zh', // 可配置
    });

    fs.unlinkSync(tempPath); // 清理临时文件
    return transcription.text;
  }
}
```

#### Step 5：主进程 - 文本注入
```typescript
// src/main/text-injector.ts
import { clipboard } from 'electron';
import { exec } from 'child_process';

export class TextInjector {
  async inject(text: string): Promise<void> {
    // 保存当前剪贴板内容
    const previousClipboard = clipboard.readText();

    // 写入转录文本
    clipboard.writeText(text);

    // 模拟 Cmd+V 粘贴（macOS）
    // 使用 osascript 更可靠
    await this.simulatePaste();

    // 恢复剪贴板
    setTimeout(() => {
      clipboard.writeText(previousClipboard);
    }, 200);
  }

  private simulatePaste(): Promise<void> {
    return new Promise((resolve, reject) => {
      // macOS: 使用 AppleScript 模拟粘贴
      exec(
        'osascript -e \'tell application "System Events" to keystroke "v" using command down\'',
        (error) => {
          if (error) reject(error);
          else resolve();
        }
      );
    });
  }
}
```

#### Step 6：浮动状态窗口
```typescript
// src/main/overlay-window.ts
import { BrowserWindow } from 'electron';

export function createOverlayWindow(): BrowserWindow {
  const overlay = new BrowserWindow({
    width: 200,
    height: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  overlay.setIgnoreMouseEvents(true);
  overlay.setVisibleOnAllWorkspaces(true);
  return overlay;
}
```

### 4.2 关键技术点

#### 4.2.1 全局快捷键与窗口焦点
- Electron `globalShortcut` 在应用失去焦点时仍然生效
- 录音/转录/粘贴过程中不能抢占用户当前的窗口焦点
- Overlay 窗口必须设置 `focusable: false` 和 `setIgnoreMouseEvents(true)`

#### 4.2.2 音频录制流程
- 渲染进程使用 `navigator.mediaDevices.getUserMedia` 获取麦克风权限
- `MediaRecorder` 录制为 WebM/Opus 格式（Whisper API 支持）
- 通过 IPC 将音频 `ArrayBuffer` 传送到主进程

#### 4.2.3 文本注入策略
- 使用 clipboard + 模拟粘贴的方式，兼容所有应用
- macOS 使用 `osascript` 模拟 Cmd+V
- Windows 使用 `powershell` 或 `nircmd` 模拟 Ctrl+V
- 注入后恢复原始剪贴板内容

#### 4.2.4 权限管理
- macOS 需要 **辅助功能权限**（Accessibility）来模拟按键
- macOS 需要 **麦克风权限**
- 在 `Info.plist` 中声明权限描述
- 首次启动时引导用户授权

### 4.3 潜在难点和解决方案

| 难点 | 说明 | 解决方案 |
|------|------|----------|
| **Fn 键监听** | `globalShortcut` 不支持 Fn 键 | 第一阶段使用 F2 等功能键；后续用 `uiohook-napi` |
| **焦点抢夺** | 录音窗口可能抢夺焦点 | 使用 `focusable: false` 的透明窗口 |
| **剪贴板冲突** | 粘贴操作会覆盖用户剪贴板 | 保存→写入→粘贴→恢复的四步流程 |
| **权限提示** | macOS 权限系统严格 | 首次运行引导 + 检测权限状态 |
| **网络延迟** | Whisper API 调用需要网络 | 显示加载状态；后续可切换本地模型 |
| **大音频文件** | 长时间录音文件较大 | 限制单次录音时长（如 60s）；分段发送 |
| **IPC 传输** | 音频 Buffer 通过 IPC 传输 | 使用 `SharedArrayBuffer` 或写临时文件 |
| **macOS 公证** | App 需要签名和公证 | 配置 `electron-forge` 签名流程 |

---

## 5. 文件结构规划

```
typeless-fake/
├── docs/
│   ├── architecture.md          # 本文档
│   └── typeless-research.md     # 调研报告
│
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 主进程入口
│   │   ├── preload.ts           # preload 脚本（IPC 桥接）
│   │   ├── shortcut-manager.ts  # 全局快捷键管理
│   │   ├── audio-service.ts     # 音频录制服务（主进程侧）
│   │   ├── transcription-service.ts  # Whisper API 调用
│   │   ├── text-injector.ts     # 文本注入（剪贴板 + 模拟粘贴）
│   │   ├── tray-manager.ts      # 系统托盘管理
│   │   ├── config-store.ts      # 配置持久化
│   │   ├── ipc-handlers.ts      # IPC 事件处理器
│   │   └── overlay-window.ts    # 浮动状态窗口管理
│   │
│   ├── renderer/                # Electron 渲染进程
│   │   ├── index.html           # HTML 入口
│   │   ├── main.tsx             # React 入口
│   │   ├── App.tsx              # 根组件
│   │   ├── components/
│   │   │   ├── Overlay.tsx      # 录音状态浮窗 UI
│   │   │   ├── Settings.tsx     # 设置面板
│   │   │   ├── ApiKeyInput.tsx  # API Key 输入
│   │   │   └── HotkeyConfig.tsx # 快捷键配置
│   │   ├── stores/
│   │   │   └── app-store.ts     # Zustand 全局状态
│   │   ├── services/
│   │   │   └── audio-recorder.ts # 音频录制（Web API）
│   │   ├── hooks/
│   │   │   ├── useRecording.ts  # 录音状态 Hook
│   │   │   └── useSettings.ts   # 设置 Hook
│   │   └── styles/
│   │       └── globals.css      # Tailwind + 全局样式
│   │
│   └── shared/                  # 主进程/渲染进程共享
│       ├── types.ts             # TypeScript 类型定义
│       └── constants.ts         # 常量定义（IPC 通道名等）
│
├── assets/
│   ├── icon.png                 # 应用图标
│   ├── tray-icon.png            # 托盘图标
│   ├── tray-icon-recording.png  # 托盘图标（录音中）
│   └── sounds/
│       ├── start.wav            # 录音开始提示音
│       └── stop.wav             # 录音结束提示音
│
├── forge.config.ts              # Electron Forge 配置
├── vite.main.config.ts          # Vite 主进程配置
├── vite.renderer.config.ts      # Vite 渲染进程配置
├── vite.preload.config.ts       # Vite preload 配置
├── tsconfig.json                # TypeScript 配置
├── tailwind.config.js           # Tailwind CSS 配置
├── postcss.config.js            # PostCSS 配置
├── package.json
└── README.md
```

---

## 6. IPC 通信协议

### 6.1 通道定义

```typescript
// src/shared/constants.ts
export const IPC_CHANNELS = {
  // 录音控制
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_AUDIO_DATA: 'recording:audio-data',

  // 转录
  TRANSCRIPTION_START: 'transcription:start',
  TRANSCRIPTION_RESULT: 'transcription:result',
  TRANSCRIPTION_ERROR: 'transcription:error',

  // 状态
  STATUS_UPDATE: 'status:update',

  // 设置
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_UPDATED: 'settings:updated',
} as const;
```

### 6.2 数据流 IPC 序列

```
Main Process                          Renderer Process
     │                                       │
     │  globalShortcut 触发                   │
     │──── RECORDING_START ─────────────────▶│
     │                                       │  开始 MediaRecorder
     │                                       │  更新 UI: "录音中"
     │                                       │
     │  globalShortcut 再次触发               │
     │──── RECORDING_STOP ──────────────────▶│
     │                                       │  停止 MediaRecorder
     │◀──── RECORDING_AUDIO_DATA ───────────│  发送音频 Buffer
     │                                       │
     │  调用 Whisper API                      │
     │──── STATUS_UPDATE("转录中") ─────────▶│  更新 UI: "转录中"
     │                                       │
     │  收到转录结果                           │
     │  执行文本注入                           │
     │──── TRANSCRIPTION_RESULT ────────────▶│  更新 UI: "完成"
     │                                       │
```

---

## 7. 状态管理设计

```typescript
// src/renderer/stores/app-store.ts
import { create } from 'zustand';

type AppStatus = 'idle' | 'recording' | 'transcribing' | 'injecting' | 'error';

interface AppState {
  status: AppStatus;
  lastTranscription: string;
  error: string | null;
  settings: {
    hotkey: string;
    apiKey: string;
    language: string;
  };

  setStatus: (status: AppStatus) => void;
  setLastTranscription: (text: string) => void;
  setError: (error: string | null) => void;
  updateSettings: (settings: Partial<AppState['settings']>) => void;
}
```

---

## 8. 安全考虑

1. **API Key 存储**：使用 `electron-store` 加密存储，不明文保存
2. **音频数据**：录音完成后立即删除临时文件，不持久化音频
3. **网络通信**：仅与 OpenAI API 通信，使用 HTTPS
4. **权限最小化**：只请求必要的系统权限（麦克风、辅助功能）
5. **preload 隔离**：通过 `contextBridge` 暴露最小化 API，不暴露 Node.js

---

## 9. 后续迭代方向

| 阶段 | 功能 | 技术要点 |
|------|------|----------|
| v0.2 | 按住录音/松开停止 | 引入 `uiohook-napi` 监听 keydown/keyup |
| v0.3 | 实时流式转录 | 切换到 Deepgram 或 OpenAI Realtime API |
| v0.4 | AI 后处理 | GPT-4o-mini 去除填充词、格式化文本 |
| v0.5 | 多语言自动检测 | Whisper 自动语言检测 |
| v0.6 | 本地模型支持 | Whisper.cpp / whisper-node 本地推理 |
| v0.7 | 个人词典 | 自定义提示词 + 后处理替换 |
| v1.0 | Windows 支持 | 适配 Windows 键盘模拟和权限 |

---

## 10. 开发计划（第一阶段）

### Week 1: 基础框架
- [ ] 使用 Electron Forge + Vite + React + TypeScript 初始化项目
- [ ] 配置 Tailwind CSS
- [ ] 实现全局快捷键注册（F2 触发）
- [ ] 实现基本的 IPC 通信

### Week 2: 核心功能
- [ ] 实现麦克风录音（MediaRecorder）
- [ ] 集成 Whisper API 转录
- [ ] 实现文本注入（剪贴板 + 粘贴模拟）
- [ ] 实现浮动状态窗口

### Week 3: 完善体验
- [ ] 系统托盘集成
- [ ] 设置面板（API Key、快捷键、语言）
- [ ] 错误处理和状态反馈
- [ ] macOS 权限引导

### Week 4: 打包发布
- [ ] 应用图标和品牌设计
- [ ] Electron Forge 打包配置
- [ ] macOS DMG 打包
- [ ] 基础测试
