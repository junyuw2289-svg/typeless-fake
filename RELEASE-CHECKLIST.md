# Typeless 发布清单（策略 A：公证分发）

基于 2026 年最新的 Apple 公证流程研究整理。

---

## 📋 **你只需要 1 种证书**

✅ **Developer ID Application** - 用于签名应用和 DMG
❌ **Developer ID Installer** - ❌ 不需要（因为使用 DMG 而非 PKG）
❌ **Mac App Distribution** - ❌ 不需要（不上架 App Store）

---

## 🚀 **完整步骤清单**

### **阶段 1：一次性准备工作（首次发布）**

#### 步骤 1：获取 Developer ID Application 证书

**1.1 创建证书签名请求（CSR）**

```bash
# 打开钥匙串访问（Keychain Access）
open "/System/Library/CoreServices/Applications/Keychain Access.app"
```

然后：
1. 菜单：钥匙串访问 > 证书助理 > 从证书颁发机构请求证书
2. 填写信息：
   - 用户电子邮件：`junyuw2289@gmail.com`（你的 Apple Developer 账号）
   - 常用名称：`Jun Yu`（你的名字）
   - CA 电子邮件：留空
3. 选择：**存储到磁盘**
4. 保存 CSR 文件到桌面

⚠️ **重要**：不要关闭钥匙串访问，私钥会自动生成并保存

**1.2 在 Apple Developer 网站申请证书**

1. 访问 https://developer.apple.com/account/resources/certificates/list
2. 点击 "+" 创建新证书
3. 选择 **"Developer ID Application"**（不是 Mac App Distribution）
4. 上传刚才保存的 CSR 文件
5. 下载生成的证书（`.cer` 文件）

**1.3 安装证书**

```bash
# 双击下载的证书文件
open ~/Downloads/developerID_application.cer

# 验证证书已安装
security find-identity -v -p codesigning
```

应该看到类似：
```
1) ABC1234DEF "Developer ID Application: Jun Yu (ABC1234DEF)"
```

---

#### 步骤 2：获取 Team ID 和 App-Specific Password

**2.1 获取 Team ID**

1. 访问 https://developer.apple.com/account
2. 点击 "Membership"
3. 找到并复制 **Team ID**（10 位字符，如 `ABC1234DEF`）

**2.2 创建 App-Specific Password**

1. 访问 https://appleid.apple.com
2. 登录后进入 **"登录和安全"**
3. 选择 **"App-Specific Passwords"**（App 专用密码）
4. 点击 "+" 生成新密码
5. 输入名称：`Typeless Notarization`
6. 复制密码（格式：`xxxx-xxxx-xxxx-xxxx`）

⚠️ **重要**：这个密码只显示一次，请立即保存！

---

#### 步骤 3：配置项目环境变量

```bash
# 进入项目目录
cd /Users/junyu/coding/typeless-fake

# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
nano .env
```

填入真实值：
```bash
APPLE_ID=junyuw2289@gmail.com
APPLE_ID_PASSWORD=xxxx-xxxx-xxxx-xxxx  # 刚才生成的 App-Specific Password
APPLE_TEAM_ID=ABC1234DEF  # 你的 Team ID
```

保存并退出（Ctrl+O，Enter，Ctrl+X）

**验证配置**：
```bash
# 确保 .env 不会被提交到 Git
cat .gitignore | grep .env
# 应该显示：.env
```

---

#### 步骤 4：（可选）创建应用图标

如果你有应用图标（1024x1024 PNG）：

```bash
# 创建 assets 目录
mkdir -p assets

# 将图标转换为 .icns 格式
# 方式 1：使用在线工具 https://cloudconvert.com/png-to-icns
# 方式 2：使用命令行工具（需要先准备 iconset）
```

如果暂时没有图标，可以跳过此步骤，但需要：

```typescript
// 在 forge.config.ts 中注释掉 icon 配置
// icon: './assets/icon.icns',  // 暂时注释
```

---

### **阶段 2：构建和验证**

#### 步骤 5：本地测试（可选但推荐）

```bash
# 安装依赖（首次）
npm install

# 开发模式测试应用功能
npm start

# 测试通过后按 Ctrl+C 退出
```

---

#### 步骤 6：构建并公证

```bash
# 确保环境变量已加载
source .env

# 执行完整构建（签名 + 公证）
npm run make
```

**预期输出**：
```
✔ Checking your system
✔ Preparing to Package Application
✔ Running packaging hooks
✔ Packaging Application
✔ Running preMake hooks
✔ Making distributables
  ✔ Making a dmg distributable for darwin/arm64
  ✔ Making a zip distributable for darwin/arm64
```

⏱️ **注意**：公证过程通常需要 **5-15 分钟**，请耐心等待

---

#### 步骤 7：验证签名和公证

构建完成后，运行以下验证命令：

```bash
# 1. 验证应用签名
codesign -vvv --deep --strict "out/Typeless-darwin-arm64/Typeless.app"
# 预期输出：Typeless.app: valid on disk

# 2. 检查 hardened runtime
codesign -dvv "out/Typeless-darwin-arm64/Typeless.app" | grep flags
# 应包含：flags=0x10000(runtime)

# 3. Gatekeeper 评估（最重要！）
spctl --assess --type execute -vv "out/Typeless-darwin-arm64/Typeless.app"
# 预期输出：
# Typeless.app: accepted
# source=Notarized Developer ID

# 4. 验证公证票据
xcrun stapler validate "out/Typeless-darwin-arm64/Typeless.app"
# 预期输出：The validate action worked!
```

**✅ 全部通过 = 可以发布！**

---

#### 步骤 8：测试 DMG 安装流程

```bash
# 找到生成的 DMG
ls -lh out/make/

# 挂载 DMG
hdiutil attach "out/make/Typeless.dmg"

# 验证 DMG 中的应用
spctl --assess --type execute -vv "/Volumes/Typeless/Typeless.app"

# 测试通过后卸载
hdiutil detach /Volumes/Typeless
```

---

### **阶段 3：发布和分发**

#### 步骤 9：准备发布文件

```bash
# 重命名 DMG（添加版本号）
mv out/make/Typeless.dmg out/make/Typeless-v0.1.0-macOS.dmg

# 计算 SHA-256 校验和
shasum -a 256 out/make/Typeless-v0.1.0-macOS.dmg > checksum.txt

# 查看文件大小
ls -lh out/make/Typeless-v0.1.0-macOS.dmg
```

---

#### 步骤 10：上传到 GitHub Releases

```bash
# 创建 Git 标签
git tag v0.1.0
git push origin v0.1.0

# 方式 1：通过网页上传
# 访问 https://github.com/junyuw2289-svg/typeless-fake/releases/new
# 上传 Typeless-v0.1.0-macOS.dmg 和 checksum.txt

# 方式 2：使用 gh CLI（如果已安装）
gh release create v0.1.0 \
  out/make/Typeless-v0.1.0-macOS.dmg \
  checksum.txt \
  --title "Typeless v0.1.0" \
  --notes "首次发布：语音转文字工具"
```

---

#### 步骤 11：为用户提供安装说明

在 GitHub Release 页面添加以下说明：

```markdown
## 安装 Typeless

### macOS（Apple Silicon）

1. 下载 [Typeless-v0.1.0-macOS.dmg](下载链接)
2. 双击打开 DMG 文件
3. 将 Typeless 拖拽到"应用程序"文件夹
4. 首次运行：
   - 右键点击应用 → 选择"打开"
   - 或在"系统设置 > 隐私与安全性"中允许
5. 授予权限：
   - 麦克风权限（用于录音）
   - 辅助功能权限（用于快捷键和文本注入）

### 安全说明

此应用已通过 Apple 公证，确保安全无恶意代码。

验证签名：
```bash
codesign -dvv /Applications/Typeless.app
spctl --assess --type execute -vv /Applications/Typeless.app
```

### 卸载

直接将应用拖入废纸篓即可。
```

---

## 🐛 **常见问题排查**

### 问题 1：构建时找不到证书

```bash
Error: No identity found for signing
```

**解决方案**：
```bash
# 检查证书是否安装
security find-identity -v -p codesigning

# 如果没有显示证书，重新下载并双击安装
```

---

### 问题 2：公证失败

```bash
Error: Notarization failed
```

**解决方案**：
```bash
# 查看公证日志
xcrun notarytool history \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"

# 查看最近一次提交的详细日志
xcrun notarytool log SUBMISSION_ID \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```

常见原因：
- ❌ 使用了 Apple ID 密码（应使用 App-Specific Password）
- ❌ Team ID 错误
- ❌ 缺少必需的 entitlements（已在配置中修复）

---

### 问题 3：用户打开应用提示"已损坏"

**原因**：应用未公证或公证票据未装订

**临时解决方案**（仅用于测试）：
```bash
xattr -cr /Applications/Typeless.app
```

**正式解决方案**：确保完成公证并通过步骤 7 的验证

---

### 问题 4：无法注入文本到其他应用

**原因**：缺少辅助功能权限

**解决方案**：
1. 系统设置 → 隐私与安全性 → 辅助功能
2. 点击 "+" 添加 Typeless
3. 勾选 Typeless 旁边的复选框

---

## 📊 **完整命令速查表**

```bash
# ========== 证书管理 ==========
# 查看已安装的签名证书
security find-identity -v -p codesigning

# ========== 签名验证 ==========
# 基础验证
codesign -vvv --deep --strict YourApp.app

# 查看签名详情
codesign -dvv YourApp.app

# 查看 entitlements
codesign -d --entitlements :- YourApp.app

# Gatekeeper 评估（最重要）
spctl --assess --type execute -vv YourApp.app

# ========== 公证 ==========
# 查看公证历史
xcrun notarytool history \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"

# 查看公证日志
xcrun notarytool log SUBMISSION_ID \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"

# 手动装订票据
xcrun stapler staple YourApp.app

# 验证票据
xcrun stapler validate YourApp.app

# ========== Electron Forge ==========
# 开发模式
npm start

# 打包（不签名，快速测试）
npm run package

# 完整构建（签名 + 公证）
npm run make
```

---

## 📚 **参考资料**

详细技术文档请查看：
- 📖 [docs/DISTRIBUTION.md](./docs/DISTRIBUTION.md) - 完整的发布指南
- 🔗 [Apple Developer - Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- 🔗 [Electron Forge - Code Signing](https://www.electronforge.io/guides/code-signing/code-signing-macos)

---

**准备好了吗？开始从步骤 1 配置吧！** 🚀

有任何问题随时查看这份清单或询问。
