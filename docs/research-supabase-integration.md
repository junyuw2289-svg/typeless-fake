# Supabase 集成技术调研报告

> 调研日期：2026-02-20
> 项目：Typeless（macOS 桌面语音转录应用）
> 技术栈：Electron 40 + React 19 + TypeScript + Vite

---

## 1. Supabase 概述

### 1.1 什么是 Supabase

Supabase 是一个开源的 Firebase 替代方案，提供以下核心服务：

| 服务 | 说明 | 本项目用途 |
|------|------|-----------|
| **Auth** | 用户认证（Email/Password、OAuth、Magic Link） | 用户登录注册 |
| **Database** | PostgreSQL 数据库 + RESTful API | 存储转录历史记录 |
| **Row Level Security** | 行级安全策略 | 数据隔离（用户只能访问自己的数据） |
| **Realtime** | 实时数据订阅 | 暂不需要 |
| **Storage** | 文件存储 | 未来可能存储音频文件 |
| **Edge Functions** | 无服务器函数 | 可选的服务端逻辑 |

### 1.2 为什么选择 Supabase

- **PostgreSQL 原生**：强大的关系型数据库，支持复杂查询和索引
- **RLS 内置**：行级安全策略确保数据隔离，无需额外中间层
- **客户端 SDK 成熟**：`@supabase/supabase-js` 支持非浏览器环境
- **免费额度充足**：Free Plan 提供 500MB 数据库、50,000 月活用户
- **开源可自托管**：必要时可迁移到自托管方案

---

## 2. Electron 环境下的认证方案

### 2.1 方案对比

| 方案 | 复杂度 | 安全性 | 用户体验 | 推荐度 |
|------|--------|--------|----------|--------|
| **Email/Password（推荐）** | 低 | 高 | 好（应用内完成） | ★★★★★ |
| Magic Link | 中 | 高 | 中（需切换到邮箱） | ★★★☆☆ |
| OAuth（Google/GitHub） | 高 | 高 | 好（但流程复杂） | ★★☆☆☆ |

### 2.2 推荐方案：Email/Password 认证

**理由：**
- Typeless 是一个工具型应用，用户群体固定，不需要社交登录降低注册门槛
- Email/Password 在 Electron 中无需处理外部浏览器重定向、custom protocol 等复杂问题
- 所有认证流程可在应用内完成，用户体验一致
- 实现复杂度最低，维护成本小

**核心代码：**

```typescript
import { createClient } from '@supabase/supabase-js'

// 注册
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
})

// 登录
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
})

// 登出
await supabase.auth.signOut()
```

### 2.3 OAuth 方案（参考，不推荐作为首选）

在 Electron 中实现 OAuth 需要处理以下挑战（社区讨论表明这仍是一个未完全解决的问题）：

**流程：**
1. 通过 `shell.openExternal()` 打开系统默认浏览器进行 OAuth 认证
2. 在 Supabase Dashboard 配置 redirect URL 为 custom protocol（如 `typeless://auth/callback`）
3. Electron 注册 custom protocol 监听回调
4. 解析回调 URL 中的 token，使用 `verifyOtp()` 创建本地 session

**Electron 注册 custom protocol（macOS）：**

```typescript
// main.ts
import { app } from 'electron'

// 注册协议（需要在 app.ready 之前）
if (process.defaultApp) {
  app.setAsDefaultProtocolClient('typeless', process.execPath, [path.resolve(process.argv[1])])
} else {
  app.setAsDefaultProtocolClient('typeless')
}

// 监听 deep link（macOS）
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleAuthCallback(url) // 解析 typeless://auth/callback?...
})
```

**服务端生成 magic link（需要 Edge Function）：**

```typescript
// Supabase Edge Function
const { data } = await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email: user.email,
})
const hashedToken = data.properties.hashed_token

// 重定向到 Electron app
return Response.redirect(`typeless://auth?hashed_token=${hashedToken}`)
```

**Electron 端验证：**

```typescript
const { data, error } = await supabase.auth.verifyOtp({
  token_hash: hashedToken,
  type: 'email',
})
```

> **注意**：OAuth 方案需要一个 Web 服务作为中间层（用于生成 magic link），增加了部署和维护成本。除非有明确的社交登录需求，否则不建议采用。

### 2.4 Session 管理与持久化

Electron 环境下没有浏览器的 `localStorage`，需要自定义 storage adapter：

```typescript
import Store from 'electron-store'

// 创建专用的 session store
const sessionStore = new Store<{ supabase_session: string }>({
  name: 'supabase-session',
  encryptionKey: 'your-encryption-key', // electron-store 支持加密
})

// 自定义 Storage Adapter（兼容 Supabase Auth 要求的接口）
const electronStorage = {
  getItem: (key: string): string | null => {
    return sessionStore.get(key as any) ?? null
  },
  setItem: (key: string, value: string): void => {
    sessionStore.set(key as any, value)
  },
  removeItem: (key: string): void => {
    sessionStore.delete(key as any)
  },
}

// 初始化 Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: electronStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Electron 中不需要检测 URL 中的 session
  },
})
```

**Session 生命周期：**
- Access Token（JWT）：默认 1 小时过期
- Refresh Token：一次性使用，无过期时间
- `autoRefreshToken: true` 会自动在 access token 过期前刷新
- Session 持久化到 electron-store，应用重启后自动恢复

---

## 3. Database 设计建议

### 3.1 表结构

#### `profiles` 表（用户扩展信息）

Supabase Auth 自动管理 `auth.users` 表，我们通过 `profiles` 表存储应用特有的用户信息：

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 自动创建 profile（当用户注册时）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
```

#### `transcription_history` 表（转录历史记录）

```sql
CREATE TABLE public.transcription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 转录内容
  original_text TEXT NOT NULL,          -- 原始转录文本（Whisper 直出）
  polished_text TEXT,                   -- AI 润色后文本（gpt-4o-mini）

  -- 元数据
  language TEXT,                        -- 检测到的语言
  duration_seconds REAL,                -- 录音时长（秒）
  model_used TEXT DEFAULT 'gpt-4o-transcribe', -- 使用的模型

  -- 时间戳
  recorded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,  -- 录音时间
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,   -- 记录创建时间

  -- 性能指标（可选，用于分析）
  transcription_ms INTEGER,             -- 转录耗时（毫秒）
  polish_ms INTEGER                     -- 润色耗时（毫秒）
);

-- 索引
CREATE INDEX idx_history_user_id ON public.transcription_history(user_id);
CREATE INDEX idx_history_recorded_at ON public.transcription_history(recorded_at DESC);
CREATE INDEX idx_history_user_recorded ON public.transcription_history(user_id, recorded_at DESC);
```

### 3.2 Row Level Security (RLS) 策略

```sql
-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcription_history ENABLE ROW LEVEL SECURITY;

-- profiles 策略
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- transcription_history 策略
CREATE POLICY "Users can view own history"
  ON public.transcription_history FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own history"
  ON public.transcription_history FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own history"
  ON public.transcription_history FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 注意：不允许 UPDATE（转录记录应为不可变的，如需修改应删除后重新创建）
```

### 3.3 索引说明

| 索引 | 用途 | 说明 |
|------|------|------|
| `idx_history_user_id` | RLS 策略查询 | 所有 RLS 策略都基于 `user_id` 筛选，必须索引 |
| `idx_history_recorded_at` | 时间排序查询 | 用户按时间浏览历史记录 |
| `idx_history_user_recorded` | 复合索引 | 同时过滤用户和排序时间，覆盖最常见的查询模式 |

---

## 4. 安全性最佳实践

### 4.1 Supabase Key 的安全性

| Key 类型 | 用途 | 能否在客户端使用 | 安全措施 |
|----------|------|------------------|----------|
| **anon key** | 客户端 API 请求 | **可以** | 配合 RLS 使用，限制数据访问范围 |
| **service_role key** | 服务端管理操作 | **绝对不行** | 绕过 RLS，拥有完全访问权限 |

**anon key 在 Electron 中的安全性：**

Supabase anon key 被设计为可以公开暴露（类似于 Firebase 的 API key）。安全性不依赖于 key 的保密，而是依赖于：

1. **RLS 策略**：即使有人获取了 anon key，RLS 确保他们只能访问自己被授权的数据
2. **JWT 验证**：所有请求都需要有效的 JWT token（由 Auth 系统签发）
3. **数据库权限**：anon role 的权限受到严格限制

### 4.2 配置管理方案

```typescript
// src/main/supabase-config.ts

// 方案 A：硬编码（推荐用于 anon key，简单直接）
// anon key 设计上就是公开的，无需额外保护
const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...'

// 方案 B：通过 electron-store 存储（适合支持多环境）
import { getConfig } from './config-store'

const config = getConfig()
const SUPABASE_URL = config.supabaseUrl
const SUPABASE_ANON_KEY = config.supabaseAnonKey
```

**推荐做法：**
- `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 直接硬编码在代码中（它们是公开的）
- 绝不在客户端包含 `service_role` key
- Session token 使用 `electron-store` 加密存储
- OpenAI API key 保持现有的 `electron-store` 存储方式

### 4.3 安全检查清单

- [ ] 所有表都启用了 RLS
- [ ] RLS 策略经过测试（确认用户无法访问他人数据）
- [ ] anon key 没有被赋予额外权限
- [ ] service_role key 绝不出现在客户端代码中
- [ ] Session token 使用加密存储
- [ ] 定期检查 Supabase Dashboard 的 Auth 设置

---

## 5. 集成实施建议

### 5.1 架构变化

```
现有架构（本地优先）:
┌─────────────────────────────────────┐
│  Electron App                       │
│  ├─ Main Process                    │
│  │  ├─ electron-store (设置)        │
│  │  └─ OpenAI API (转录)           │
│  └─ Renderer Process                │
│     └─ React UI                     │
└─────────────────────────────────────┘

集成后架构（本地 + 云端）:
┌─────────────────────────────────────┐
│  Electron App                       │
│  ├─ Main Process                    │
│  │  ├─ electron-store (设置)        │
│  │  ├─ OpenAI API (转录)           │
│  │  └─ Supabase Client ← 新增      │
│  │     ├─ Auth (用户认证)           │
│  │     └─ Database (历史记录)       │
│  └─ Renderer Process                │
│     └─ React UI                     │
│        ├─ 登录/注册界面 ← 新增      │
│        └─ 历史记录页面 ← 新增       │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Supabase Cloud                     │
│  ├─ Auth (用户管理)                 │
│  ├─ PostgreSQL (数据存储)           │
│  │  ├─ profiles                     │
│  │  └─ transcription_history        │
│  └─ RLS (数据隔离)                  │
└─────────────────────────────────────┘
```

### 5.2 实施步骤

**Phase 1：基础集成（Auth + Database）**

1. 创建 Supabase 项目，配置数据库表和 RLS
2. 安装 `@supabase/supabase-js`
3. 创建 Supabase 客户端（Main Process 中）
4. 实现自定义 storage adapter（基于 electron-store）
5. 添加登录/注册 IPC handlers
6. 创建简单的登录 UI

**Phase 2：历史记录功能**

1. 修改转录流程，在转录完成后自动保存到 Supabase
2. 添加历史记录查询 IPC handlers
3. 创建历史记录浏览 UI
4. 实现分页和搜索功能

**Phase 3：离线支持**

1. 实现本地队列（转录完成时如果离线，先存本地）
2. 网络恢复后自动同步
3. 冲突处理策略（以时间戳为准）

### 5.3 与现有系统的协同

**转录完成后自动保存流程：**

```
用户按 F2 → 录音 → 停止录音
  → TranscriptionService.transcribe()
    → OpenAI Whisper (原始转录)
    → GPT-4o-mini (润色)
  → TextInjector.inject() (粘贴文本)
  → SupabaseService.saveHistory() ← 新增（异步，不阻塞主流程）
```

关键原则：
- **保存操作是异步的**，不会影响现有的转录 → 粘贴流程
- 如果保存失败（网络问题等），不应影响用户体验
- 失败的保存操作进入本地重试队列

### 5.4 离线场景处理

```typescript
// 离线队列方案
interface PendingRecord {
  id: string
  data: TranscriptionRecord
  retryCount: number
  createdAt: number
}

class OfflineQueue {
  private store: Store<{ pending: PendingRecord[] }>

  async save(record: TranscriptionRecord): Promise<void> {
    try {
      await supabase.from('transcription_history').insert(record)
    } catch (error) {
      // 网络错误时加入离线队列
      this.addToQueue(record)
    }
  }

  async flush(): Promise<void> {
    const pending = this.store.get('pending', [])
    for (const item of pending) {
      try {
        await supabase.from('transcription_history').insert(item.data)
        this.removeFromQueue(item.id)
      } catch {
        item.retryCount++
        if (item.retryCount > 10) {
          this.removeFromQueue(item.id) // 放弃过多重试的记录
        }
      }
    }
  }
}
```

---

## 6. 代码示例

### 6.1 Supabase 客户端初始化（Electron Main Process）

```typescript
// src/main/supabase-client.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Store from 'electron-store'

const SUPABASE_URL = 'https://your-project.supabase.co'
const SUPABASE_ANON_KEY = 'your-anon-key'

// 使用 electron-store 作为 session 持久化后端
const sessionStore = new Store({
  name: 'supabase-auth',
  encryptionKey: 'typeless-session-encryption-key',
})

const storage = {
  getItem: (key: string): string | null => {
    return (sessionStore.get(key) as string) ?? null
  },
  setItem: (key: string, value: string): void => {
    sessionStore.set(key, value)
  },
  removeItem: (key: string): void => {
    sessionStore.delete(key)
  },
}

let supabase: SupabaseClient

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  }
  return supabase
}
```

### 6.2 认证服务

```typescript
// src/main/auth-service.ts
import { getSupabaseClient } from './supabase-client'

export class AuthService {
  private supabase = getSupabaseClient()

  async signUp(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut()
    if (error) throw error
  }

  async getUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser()
    if (error) throw error
    return user
  }

  async getSession() {
    const { data: { session }, error } = await this.supabase.auth.getSession()
    if (error) throw error
    return session
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return this.supabase.auth.onAuthStateChange(callback)
  }
}
```

### 6.3 历史记录服务

```typescript
// src/main/history-service.ts
import { getSupabaseClient } from './supabase-client'

interface TranscriptionRecord {
  original_text: string
  polished_text?: string
  language?: string
  duration_seconds?: number
  model_used?: string
  transcription_ms?: number
  polish_ms?: number
}

export class HistoryService {
  private supabase = getSupabaseClient()

  async saveTranscription(record: TranscriptionRecord) {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) return // 未登录时不保存

    const { error } = await this.supabase
      .from('transcription_history')
      .insert({
        user_id: user.id,
        ...record,
      })

    if (error) {
      console.error('Failed to save transcription history:', error)
      // 加入离线队列
    }
  }

  async getHistory(page = 1, pageSize = 20) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await this.supabase
      .from('transcription_history')
      .select('*', { count: 'exact' })
      .order('recorded_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    return { data, total: count }
  }

  async deleteRecord(id: string) {
    const { error } = await this.supabase
      .from('transcription_history')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  async searchHistory(query: string) {
    const { data, error } = await this.supabase
      .from('transcription_history')
      .select('*')
      .or(`original_text.ilike.%${query}%,polished_text.ilike.%${query}%`)
      .order('recorded_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return data
  }
}
```

### 6.4 与现有转录流程的集成

```typescript
// 在 ipc-handlers.ts 中修改
import { HistoryService } from './history-service'

const historyService = new HistoryService()

// 在转录完成后添加保存逻辑
async function handleTranscriptionComplete(result: TranscriptionResult) {
  // 现有逻辑：粘贴文本
  textInjector.inject(result.text)

  // 新增：异步保存到 Supabase（不阻塞主流程）
  historyService.saveTranscription({
    original_text: result.originalText,
    polished_text: result.polishedText,
    language: result.language,
    duration_seconds: result.durationSeconds,
    model_used: result.modelUsed,
    transcription_ms: result.transcriptionMs,
    polish_ms: result.polishMs,
  }).catch(err => {
    console.error('Background save failed:', err)
  })
}
```

### 6.5 IPC Handlers（认证 + 历史记录）

```typescript
// src/main/ipc-handlers.ts（新增的 handlers）
import { ipcMain } from 'electron'
import { AuthService } from './auth-service'
import { HistoryService } from './history-service'

const authService = new AuthService()
const historyService = new HistoryService()

// Auth handlers
ipcMain.handle('auth:sign-up', async (_, email: string, password: string) => {
  return authService.signUp(email, password)
})

ipcMain.handle('auth:sign-in', async (_, email: string, password: string) => {
  return authService.signIn(email, password)
})

ipcMain.handle('auth:sign-out', async () => {
  return authService.signOut()
})

ipcMain.handle('auth:get-user', async () => {
  return authService.getUser()
})

ipcMain.handle('auth:get-session', async () => {
  return authService.getSession()
})

// History handlers
ipcMain.handle('history:list', async (_, page: number, pageSize: number) => {
  return historyService.getHistory(page, pageSize)
})

ipcMain.handle('history:delete', async (_, id: string) => {
  return historyService.deleteRecord(id)
})

ipcMain.handle('history:search', async (_, query: string) => {
  return historyService.searchHistory(query)
})
```

---

## 7. 参考资料

### 官方文档
- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)
- [Supabase JavaScript 客户端初始化](https://supabase.com/docs/reference/javascript/initializing)
- [Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Session 管理](https://supabase.com/docs/guides/auth/sessions)
- [Redirect URLs 配置](https://supabase.com/docs/guides/auth/redirect-urls)
- [API Key 安全性](https://supabase.com/docs/guides/api/api-keys)
- [Deep Linking 指南](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)

### 社区讨论
- [Supabase + Electron OAuth 集成讨论](https://github.com/orgs/supabase/discussions/17722)
- [Electron deep link auth session 生成](https://github.com/orgs/supabase/discussions/27181)
- [通过默认浏览器认证 Electron 用户](https://github.com/orgs/supabase/discussions/22270)
- [Supabase 离线使用讨论](https://github.com/orgs/supabase/discussions/357)

### 安全性指南
- [Supabase Security Best Practices 2026](https://supaexplorer.com/guides/supabase-security-best-practices)
- [RLS 完整指南](https://designrevision.com/blog/supabase-row-level-security)
- [Supabase 最佳实践](https://www.leanware.co/insights/supabase-best-practices)

---

## 附录：关键决策总结

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 认证方式 | Email/Password | 简单可靠，无需外部浏览器重定向 |
| Session 存储 | electron-store（加密） | 复用现有依赖，支持加密 |
| Supabase Client 位置 | Main Process | 安全性更高，避免 Renderer 直接访问 |
| 历史记录保存 | 异步后台保存 | 不影响现有转录 → 粘贴流程 |
| 离线处理 | 本地队列 + 自动重试 | 保证数据不丢失 |
| anon key 存储 | 硬编码 | 官方建议，设计上可公开 |
| RLS 策略 | 严格的用户隔离 | 每个用户只能访问自己的数据 |
