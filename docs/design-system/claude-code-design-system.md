# Anthropic Claude Code 设计系统深度调研报告

基于对 Anthropic Claude Code 官方资源、品牌指南和设计文档的深入调研，以下是完整的设计系统总结。

## 一、核心设计哲学

### 1.1 设计原则

Claude Code 的设计系统强调**避免通用 AI 生成的美学（"AI Slop" Aesthetic）**，追求：

- **大胆的美学方向**：鼓励极端化的设计选择，而非中庸的"安全"设计
- **有意图的设计**：每个视觉决策都应有明确的概念方向
- **人本价值观**：技术精致且富有人文关怀的双重特质
- **意外性与记忆点**：创造让人难忘的、非预期的视觉体验

### 1.2 设计思维框架

在实施设计前，需明确：

1. **目的**（Purpose）：界面解决什么问题？谁使用它？
2. **基调**（Tone）：选择极端美学方向
3. **约束**（Constraints）：技术要求、性能、可访问性
4. **差异化**（Differentiation）：什么让这个设计令人难忘？

---

## 二、颜色系统

### 2.1 Anthropic 官方品牌色

| 颜色名称 | Hex 值 | 用途 |
|---------|--------|------|
| **Dark** | `#141413` | 主要深色背景、文本 |
| **Light** | `#faf9f5` | 主要浅色背景 |
| **Mid Gray** | `#b0aea5` | 次要文本、边框 |
| **Light Gray** | `#e8e6dc` | 分隔线、禁用状态 |
| **Orange (Accent)** | `#d97757` | 主要交互色、CTA 按钮 |
| **Orange Hover** | `#c4684a` | 橙色悬停状态 |
| **Orange Light** | `#f5e6df` | 橙色焦点光晕 |
| **Blue** | `#6a9bcc` | 辅助信息色 |
| **Green** | `#788c5d` | 成功状态、积极反馈 |
| **Canvas** | `#0e0e0d` | 深色画布背景 |

### 2.2 扩展色板

- **Crail** `#C15F3C` - Claude 主要品牌色
- **Antique Brass** `#CC785C` - 温暖辅助色
- **Friar Gray** `#828179` - 中性灰
- **Cararra** `#F0EFEA` - 次要浅色背景
- **Pampas** `#F4F3EE` - 柔和背景色

### 2.3 CSS 变量定义

```css
:root {
  /* 主色调 */
  --dark: #141413;
  --light: #faf9f5;
  --mid-gray: #b0aea5;
  --light-gray: #e8e6dc;
  --orange: #d97757;
  --orange-hover: #c4684a;
  --orange-light: #f5e6df;
  --blue: #6a9bcc;
  --green: #788c5d;
  --red: #e05252;
}
```

---

## 三、字体系统

### 3.1 Anthropic 官方字体

| 字体家族 | 用途 | 特点 |
|---------|------|------|
| **Instrument Serif** | 标题、品牌名 | 优雅的衬线字体 |
| **DM Sans** | UI 元素、表单 | 现代无衬线字体 |
| **IBM Plex Mono** | 数据、代码 | 现代等宽字体 |

### 3.2 字体大小层级

```css
:root {
  /* 字体大小 */
  --font-size-xs: 10px;   /* 极小标签 */
  --font-size-sm: 11px;   /* 徽章 */
  --font-size-base: 12px; /* 小文本 */
  --font-size-md: 13px;   /* 标准 UI */
  --font-size-lg: 14px;   /* 正文 */
  --font-size-xl: 15px;   /* 按钮 */
  --font-size-2xl: 16px;  /* Logo */
  --font-size-3xl: 20px;  /* 小标题 */
  --font-size-4xl: 24px;  /* 页面标题 */
  --font-size-5xl: 28px;  /* 品牌名 */
  --font-size-6xl: 30px;  /* 大标题 */
  --font-size-7xl: 32px;  /* 指标数值 */
  --font-size-8xl: 42px;  /* Canvas 主标题 */
  --font-size-9xl: 48px;  /* 超大标题 */

  /* 字重 */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* 行高 */
  --line-height-tight: 1.4;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.6;

  /* 字间距 */
  --letter-spacing-tight: -1px;    /* 大标题 */
  --letter-spacing-snug: -0.5px;   /* 中标题 */
  --letter-spacing-normal: 0;      /* 默认 */
  --letter-spacing-wide: 0.2px;    /* 按钮 */
}
```

### 3.3 字体使用规则

```css
/* 标题和品牌 */
.heading, .brand-name {
  font-family: 'Instrument Serif', Georgia, serif;
  font-weight: 400; /* 避免使用 bold */
  letter-spacing: -0.5px;
}

/* UI 元素 */
.button, .label, .nav-item {
  font-family: 'DM Sans', -apple-system, sans-serif;
  font-weight: 500;
}

/* 数据和代码 */
.metric-value, .code {
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 500;
  letter-spacing: -1px; /* 大数值 */
}
```

---

## 四、组件设计规范

### 4.1 按钮系统

#### 主要按钮（Primary Button）

```css
.btn--primary {
  height: 48px;
  background: var(--orange);
  color: #fff;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.2px;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(217, 119, 87, 0.25);
  transition: all 0.2s ease;
}

.btn--primary:hover {
  background: var(--orange-hover);
  box-shadow: 0 4px 16px rgba(217, 119, 87, 0.35);
  transform: translateY(-1px);
}

.btn--primary:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(217, 119, 87, 0.2);
}
```

#### 次级按钮（Secondary Button）

```css
.btn--secondary {
  height: 46px;
  background: #fff;
  border: 1.5px solid var(--light-gray);
  color: var(--dark);
  font-size: 14px;
  font-weight: 500;
  padding: 0 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.btn--secondary:hover {
  border-color: var(--mid-gray);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
```

#### Ghost 按钮

```css
.btn--ghost {
  background: none;
  border: none;
  color: var(--mid-gray);
  font-size: 13px;
  font-weight: 400;
  height: auto;
}

.btn--ghost:hover {
  color: var(--dark);
}
```

### 4.2 输入框系统

```css
.form-input {
  height: 46px;
  border: 1.5px solid var(--light-gray);
  border-radius: 10px;
  padding: 0 16px;
  font-size: 14px;
  font-family: 'DM Sans', sans-serif;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input::placeholder {
  color: var(--mid-gray);
}

.form-input:focus {
  outline: none;
  border-color: var(--orange);
  box-shadow: 0 0 0 3px var(--orange-light);
}

.form-input:hover:not(:focus) {
  border-color: var(--mid-gray);
}
```

### 4.3 卡片系统

```css
.card {
  padding: 18px;
  border-radius: 14px;
  border: 1.5px solid var(--light-gray);
  background: #fff;
  transition: all 0.2s;
}

.card:hover {
  border-color: var(--orange);
  background: #fffcfa; /* Warm tint */
}

.card--metric {
  padding: 28px;
  border-radius: 20px;
}
```

### 4.4 徽章系统

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 11px;
  font-weight: 500;
  font-family: 'DM Sans', sans-serif;
}

.badge--success {
  background: rgba(120, 140, 93, 0.15);
  color: var(--green);
}

.badge--warning {
  background: rgba(217, 119, 87, 0.15);
  color: var(--orange);
}

.badge--error {
  background: rgba(224, 82, 82, 0.15);
  color: var(--red);
}

.badge--pro {
  background: rgba(217, 119, 87, 0.2);
  color: var(--orange);
  font-size: 10px;
  font-weight: 600;
  padding: 3px 6px;
  border-radius: 4px;
}
```

---

## 五、间距与布局系统

### 5.1 圆角系统

```css
:root {
  --radius-sm: 10px;  /* 输入框、小按钮 */
  --radius-md: 14px;  /* 卡片 */
  --radius-lg: 20px;  /* 大容器 */
  --radius-xl: 24px;  /* 窗口、模态框 */
  --radius-pill: 100px; /* 药丸形状 */
}
```

### 5.2 阴影系统

```css
:root {
  --shadow-input: 0 1px 3px rgba(0, 0, 0, 0.04);
  --shadow-btn: 0 2px 8px rgba(217, 119, 87, 0.25);
  --shadow-card: 0 4px 16px rgba(20, 20, 19, 0.06);
  --shadow-elevated: 0 12px 40px rgba(20, 20, 19, 0.08);
  --shadow-modal: 0 24px 80px rgba(20, 20, 19, 0.12);
  --shadow-window: 0 25px 60px rgba(0, 0, 0, 0.35), 0 8px 20px rgba(0, 0, 0, 0.2);
}
```

### 5.3 间距规范（8px 基数）

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 18px;
  --space-6: 20px;
  --space-7: 24px;
  --space-8: 28px;
  --space-9: 32px;
  --space-10: 40px;
  --space-11: 48px;
  --space-12: 80px;
}
```

常用间距：
- **表单组间距**：18px
- **标签与输入框**：7px
- **按钮间距**：12px
- **卡片间距**：12px（垂直堆叠）/ 20px（网格）
- **卡片内边距**：18px（标准）/ 28px（指标卡片）
- **页面边距**：32-48px

---

## 六、macOS 窗口设计

### 6.1 窗口框架

```css
.window {
  background: var(--light);
  border-radius: 12px;
  box-shadow: var(--shadow-window);
  overflow: hidden;
}

.window-chrome {
  height: 52px;
  background: linear-gradient(180deg, #f2f1ec 0%, #eeede8 100%);
  border-bottom: 1px solid var(--light-gray);
  -webkit-app-region: drag; /* 可拖拽 */
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.window-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--mid-gray);
  font-family: 'DM Sans', sans-serif;
  text-align: center;
  flex: 1;
}
```

### 6.2 交通灯按钮

```css
.traffic-lights {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.traffic-light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: inset 0 -1px 1px rgba(0, 0, 0, 0.1);
}

.traffic-light--close {
  background: #ff5f57;
}

.traffic-light--minimize {
  background: #febc2e;
}

.traffic-light--maximize {
  background: #28c840;
}
```

---

## 七、动画与过渡

### 7.1 标准过渡

```css
/* 通用过渡 */
.transition-standard {
  transition: all 0.2s ease;
}

/* 悬停效果 */
.interactive:hover {
  transform: translateY(-1px);
}

.interactive:active {
  transform: translateY(0);
}
```

### 7.2 波形动画（Waveform）

```css
@keyframes wave {
  0%, 100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(0.4);
  }
}

.wave-bar {
  width: 6px;
  border-radius: 3px;
  background: var(--orange);
  animation: wave 1.2s ease-in-out infinite;
}

/* 添加不同延迟创造波浪效果 */
.wave-bar:nth-child(1) { animation-delay: 0s; }
.wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave-bar:nth-child(3) { animation-delay: 0.2s; }
/* ... */
```

### 7.3 脉冲环动画

```css
@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 0.4;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}

.pulse-ring {
  border: 2px dashed var(--orange);
  border-radius: 50%;
  animation: pulse-ring 2s ease-out infinite;
}
```

### 7.4 加载旋转动画

```css
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: var(--orange);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
```

---

## 八、图标系统

### 8.1 图标库

推荐使用：**Lucide Icons**（线性图标）

### 8.2 图标尺寸

```css
:root {
  --icon-xs: 14px;  /* 趋势箭头 */
  --icon-sm: 16px;  /* 按钮图标 */
  --icon-md: 18px;  /* 导航图标 */
  --icon-lg: 20px;  /* 卡片图标 */
  --icon-xl: 24px;  /* 主要图标 */
  --icon-2xl: 32px; /* 装饰图标 */
}
```

### 8.3 图标颜色状态

```css
.icon--active {
  color: var(--orange);
}

.icon--primary {
  color: var(--dark);
}

.icon--secondary {
  color: var(--mid-gray);
}

.icon--on-dark {
  color: #ffffff;
}

.icon--success {
  color: var(--green);
}

.icon--error {
  color: var(--red);
}
```

---

## 九、深色侧边栏设计

### 9.1 侧边栏容器

```css
.sidebar {
  width: 240px;
  background: var(--dark);
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
```

### 9.2 导航项

```css
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 44px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 14px;
  font-family: 'DM Sans', sans-serif;
  transition: background 0.2s;
}

/* 默认状态 */
.nav-item {
  color: rgba(255, 255, 255, 0.5);
  font-weight: 400;
}

/* 激活状态 */
.nav-item--active {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-weight: 500;
}

/* 悬停状态 */
.nav-item:hover:not(.nav-item--active) {
  background: rgba(255, 255, 255, 0.05);
}
```

---

## 十、状态浮动窗口

### 10.1 录音中状态

```css
.status-recording {
  background: rgba(20, 20, 19, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 0 16px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.recording-dot {
  width: 8px;
  height: 8px;
  background: var(--red);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

### 10.2 成功状态

```css
.status-success {
  background: rgba(120, 140, 93, 0.9);
  color: #ffffff;
  /* 其他样式同上 */
}
```

### 10.3 监听药丸形状

```css
.listening-pill {
  background: var(--dark);
  border-radius: 100px;
  height: 44px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.note-bars {
  display: flex;
  gap: 3px;
  align-items: flex-end;
  height: 20px;
}

.note-bar {
  width: 3px;
  background: var(--orange);
  border-radius: 1.5px;
  animation: note-jump 1s ease-in-out infinite;
}

@keyframes note-jump {
  0%, 100% { height: 8px; }
  50% { height: 16px; }
}
```

---

## 十一、设计原则总结

### ✅ 推荐做法

1. **颜色使用**：
   - 使用 CSS 变量保持一致性
   - 主导橙色系，避免冷色调
   - 温暖的中性色（cream, taupe）

2. **字体选择**：
   - Instrument Serif 用于标题和品牌
   - DM Sans 用于 UI 和表单
   - IBM Plex Mono 用于数据和代码

3. **圆角设计**：
   - 柔和的圆角（10-24px）
   - 避免锐利的直角

4. **动画效果**：
   - 聚焦高影响力时刻
   - 0.2s 标准过渡时间
   - 使用 ease 缓动函数

5. **间距系统**：
   - 遵循 8px 基数
   - 保持一致的垂直节奏

### ❌ 避免做法

1. **颜色**：
   - ❌ 纯白背景（#FFFFFF）
   - ❌ 冷灰色调
   - ❌ 紫色渐变

2. **字体**：
   - ❌ Arial, Inter, Roboto（过度使用）
   - ❌ 系统默认字体

3. **设计**：
   - ❌ 锐利的直角
   - ❌ 重阴影效果
   - ❌ 过度动画

4. **布局**：
   - ❌ 可预测的模板化设计
   - ❌ 缺乏呼吸空间

---

## 十二、完整 CSS 变量库

```css
:root {
  /* === 颜色系统 === */
  /* 主色调 */
  --dark: #141413;
  --light: #faf9f5;
  --mid-gray: #b0aea5;
  --light-gray: #e8e6dc;

  /* 强调色 */
  --orange: #d97757;
  --orange-hover: #c4684a;
  --orange-light: #f5e6df;

  /* 辅助色 */
  --blue: #6a9bcc;
  --green: #788c5d;
  --red: #e05252;

  /* === 字体系统 === */
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-ui: 'DM Sans', -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;

  /* === 圆角系统 === */
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 24px;
  --radius-pill: 100px;

  /* === 阴影系统 === */
  --shadow-input: 0 1px 3px rgba(0, 0, 0, 0.04);
  --shadow-btn: 0 2px 8px rgba(217, 119, 87, 0.25);
  --shadow-card: 0 4px 16px rgba(20, 20, 19, 0.06);
  --shadow-elevated: 0 12px 40px rgba(20, 20, 19, 0.08);
  --shadow-modal: 0 24px 80px rgba(20, 20, 19, 0.12);
  --shadow-window: 0 25px 60px rgba(0, 0, 0, 0.35), 0 8px 20px rgba(0, 0, 0, 0.2);

  /* === 间距系统 === */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 18px;
  --space-6: 20px;
  --space-7: 24px;
  --space-8: 28px;
  --space-9: 32px;
  --space-10: 40px;
  --space-11: 48px;
  --space-12: 80px;

  /* === 过渡系统 === */
  --transition-fast: 0.15s ease;
  --transition-base: 0.2s ease;
  --transition-slow: 0.3s ease;
}
```

---

## 十三、Pencil 设计系统变量

在 Pencil 中使用时的变量定义：

```json
{
  "orange": {"type": "color", "value": "#d97757"},
  "orange-hover": {"type": "color", "value": "#c4684a"},
  "orange-light": {"type": "color", "value": "#f5e6df"},
  "dark": {"type": "color", "value": "#141413"},
  "light": {"type": "color", "value": "#faf9f5"},
  "mid-gray": {"type": "color", "value": "#b0aea5"},
  "light-gray": {"type": "color", "value": "#e8e6dc"},
  "blue": {"type": "color", "value": "#6a9bcc"},
  "green": {"type": "color", "value": "#788c5d"},
  "red": {"type": "color", "value": "#e05252"},
  "radius-sm": {"type": "number", "value": 10},
  "radius-md": {"type": "number", "value": 14},
  "radius-lg": {"type": "number", "value": 20},
  "radius-xl": {"type": "number", "value": 24}
}
```

---

## 参考资料

- [Claude Code Frontend Design Skill](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md)
- [Prompting for Frontend Aesthetics](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)
- [Anthropic Brand by Geist](https://geist.co/work/anthropic)
- [Claude Brand Color Palette](https://mobbin.com/colors/brand/claude)
- [Claude Code Product Page](https://claude.com/product/claude-code)

---

**最后更新**：2026-02-20
**版本**：1.0
**作者**：Claude Code Design Research Agent
