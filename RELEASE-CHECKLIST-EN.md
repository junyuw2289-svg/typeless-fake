# Typeless Release Checklist (Strategy A: Notarized Distribution)

Based on the latest Apple notarization workflow research for 2026.

---

## 📋 **You Only Need 1 Certificate**

✅ **Developer ID Application** - For signing app and DMG
❌ **Developer ID Installer** - ❌ Not needed (using DMG, not PKG)
❌ **Mac App Distribution** - ❌ Not needed (not distributing via App Store)

---

## 🚀 **Complete Step-by-Step Checklist**

### **Phase 1: One-Time Setup (First Release)**

#### Step 1: Obtain Developer ID Application Certificate

**1.1 Create Certificate Signing Request (CSR)**

```bash
# Open Keychain Access
open "/System/Library/CoreServices/Applications/Keychain Access.app"
```

Then:
1. Menu: **Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority**
2. Fill in the information:
   - **User Email Address**: `junyuw2289@gmail.com` (your Apple Developer account)
   - **Common Name**: `Jun Yu` (your name)
   - **CA Email Address**: Leave blank
   - **Request is**: Select **"Saved to disk"**
3. Optional: Check **"Let me specify key pair information"**
   - Key Size: 2048 bits (recommended) or 4096 bits
   - Algorithm: RSA
4. Click **Continue** and save the CSR file to Desktop

⚠️ **Important**: Don't close Keychain Access. The private key is automatically generated and saved.

**1.2 Request Certificate from Apple Developer Website**

1. Visit https://developer.apple.com/account/resources/certificates/list
2. Click **"+"** to create a new certificate
3. Select **"Developer ID Application"** (NOT Mac App Distribution)
4. Upload the CSR file you just saved
5. Download the generated certificate (`.cer` file)

**1.3 Install Certificate**

```bash
# Double-click the downloaded certificate file
open ~/Downloads/developerID_application.cer

# Verify certificate is installed
security find-identity -v -p codesigning
```

You should see something like:
```
1) ABC1234DEF "Developer ID Application: Jun Yu (ABC1234DEF)"
```

---

#### Step 2: Get Team ID and App-Specific Password

**2.1 Get Team ID**

1. Visit https://developer.apple.com/account
2. Click **"Membership"**
3. Find and copy your **Team ID** (10 characters, e.g., `ABC1234DEF`)

**2.2 Create App-Specific Password**

1. Visit https://appleid.apple.com
2. After login, go to **"Sign-In and Security"**
3. Select **"App-Specific Passwords"**
4. Click **"+"** to generate a new password
5. Enter label: `Typeless Notarization`
6. Copy the password (format: `xxxx-xxxx-xxxx-xxxx`)

⚠️ **Important**: This password is shown only once. Save it immediately!

---

#### Step 3: Configure Project Environment Variables

```bash
# Navigate to project directory
cd /Users/junyu/coding/typeless-fake

# Copy environment variables template
cp .env.example .env

# Edit .env file
nano .env
```

Fill in the real values:
```bash
APPLE_ID=junyuw2289@gmail.com
APPLE_ID_PASSWORD=xxxx-xxxx-xxxx-xxxx  # App-Specific Password you just generated
APPLE_TEAM_ID=ABC1234DEF  # Your Team ID
```

Save and exit (Ctrl+O, Enter, Ctrl+X)

**Verify configuration**:
```bash
# Ensure .env won't be committed to Git
cat .gitignore | grep .env
# Should display: .env
```

---

#### Step 4: (Optional) Create App Icon

If you have an app icon (1024x1024 PNG):

```bash
# Create assets directory
mkdir -p assets

# Convert icon to .icns format
# Option 1: Use online tool https://cloudconvert.com/png-to-icns
# Option 2: Use command line tool (need to prepare iconset first)
```

If you don't have an icon yet, skip this step but you need to:

```typescript
// Comment out icon config in forge.config.ts
// icon: './assets/icon.icns',  // Temporarily commented
```

---

### **Phase 2: Build and Verify**

#### Step 5: Local Testing (Optional but Recommended)

```bash
# Install dependencies (first time)
npm install

# Test app functionality in development mode
npm start

# Press Ctrl+C to exit after testing
```

---

#### Step 6: Build and Notarize

```bash
# Ensure environment variables are loaded
source .env

# Execute full build (sign + notarize)
npm run make
```

**Expected output**:
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

⏱️ **Note**: Notarization process usually takes **5-15 minutes**. Please be patient.

---

#### Step 7: Verify Signature and Notarization

After build completes, run the following verification commands:

```bash
# 1. Verify app signature
codesign -vvv --deep --strict "out/Typeless-darwin-arm64/Typeless.app"
# Expected output: Typeless.app: valid on disk

# 2. Check hardened runtime
codesign -dvv "out/Typeless-darwin-arm64/Typeless.app" | grep flags
# Should include: flags=0x10000(runtime)

# 3. Gatekeeper assessment (Most Important!)
spctl --assess --type execute -vv "out/Typeless-darwin-arm64/Typeless.app"
# Expected output:
# Typeless.app: accepted
# source=Notarized Developer ID

# 4. Verify notarization ticket
xcrun stapler validate "out/Typeless-darwin-arm64/Typeless.app"
# Expected output: The validate action worked!
```

**✅ All checks passed = Ready to release!**

---

#### Step 8: Test DMG Installation Flow

```bash
# Find the generated DMG
ls -lh out/make/

# Mount DMG
hdiutil attach "out/make/Typeless.dmg"

# Verify app in DMG
spctl --assess --type execute -vv "/Volumes/Typeless/Typeless.app"

# Unmount after testing
hdiutil detach /Volumes/Typeless
```

---

### **Phase 3: Release and Distribution**

#### Step 9: Prepare Release Files

```bash
# Rename DMG (add version number)
mv out/make/Typeless.dmg out/make/Typeless-v0.1.0-macOS.dmg

# Calculate SHA-256 checksum
shasum -a 256 out/make/Typeless-v0.1.0-macOS.dmg > checksum.txt

# Check file size
ls -lh out/make/Typeless-v0.1.0-macOS.dmg
```

---

#### Step 10: Upload to GitHub Releases

```bash
# Create Git tag
git tag v0.1.0
git push origin v0.1.0

# Option 1: Upload via web
# Visit https://github.com/junyuw2289-svg/typeless-fake/releases/new
# Upload Typeless-v0.1.0-macOS.dmg and checksum.txt

# Option 2: Use gh CLI (if installed)
gh release create v0.1.0 \
  out/make/Typeless-v0.1.0-macOS.dmg \
  checksum.txt \
  --title "Typeless v0.1.0" \
  --notes "Initial release: Voice-to-text transcription tool"
```

---

#### Step 11: Provide Installation Instructions for Users

Add the following instructions on GitHub Release page:

```markdown
## Installing Typeless

### macOS (Apple Silicon)

1. Download [Typeless-v0.1.0-macOS.dmg](download-link)
2. Double-click to open the DMG file
3. Drag Typeless to the "Applications" folder
4. First run:
   - Right-click the app → Select "Open"
   - Or allow in "System Settings > Privacy & Security"
5. Grant permissions:
   - Microphone access (for recording)
   - Accessibility access (for shortcuts and text injection)

### Security Notice

This app is notarized by Apple, ensuring it's safe and malware-free.

Verify signature:
```bash
codesign -dvv /Applications/Typeless.app
spctl --assess --type execute -vv /Applications/Typeless.app
```

### Uninstall

Simply drag the app to Trash.
```

---

## 🐛 **Troubleshooting**

### Issue 1: Certificate Not Found During Build

```bash
Error: No identity found for signing
```

**Solution**:
```bash
# Check if certificate is installed
security find-identity -v -p codesigning

# If no certificate shown, re-download and double-click to install
```

---

### Issue 2: Notarization Failed

```bash
Error: Notarization failed
```

**Solution**:
```bash
# View notarization log
xcrun notarytool history \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"

# View detailed log for the latest submission
xcrun notarytool log SUBMISSION_ID \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```

Common causes:
- ❌ Used Apple ID password (should use App-Specific Password)
- ❌ Wrong Team ID
- ❌ Missing required entitlements (already fixed in config)

---

### Issue 3: User Gets "App is Damaged" Alert

**Cause**: App not notarized or notarization ticket not stapled

**Temporary solution** (for testing only):
```bash
xattr -cr /Applications/Typeless.app
```

**Proper solution**: Ensure notarization is complete and passes Step 7 verification

---

### Issue 4: Cannot Inject Text into Other Apps

**Cause**: Missing Accessibility permission

**Solution**:
1. System Settings → Privacy & Security → Accessibility
2. Click **"+"** to add Typeless
3. Check the box next to Typeless

---

## 📊 **Quick Reference Commands**

```bash
# ========== Certificate Management ==========
# View installed signing certificates
security find-identity -v -p codesigning

# ========== Signature Verification ==========
# Basic verification
codesign -vvv --deep --strict YourApp.app

# View signature details
codesign -dvv YourApp.app

# View entitlements
codesign -d --entitlements :- YourApp.app

# Gatekeeper assessment (Most Important)
spctl --assess --type execute -vv YourApp.app

# ========== Notarization ==========
# View notarization history
xcrun notarytool history \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"

# View notarization log
xcrun notarytool log SUBMISSION_ID \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_ID_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"

# Manually staple ticket
xcrun stapler staple YourApp.app

# Verify ticket
xcrun stapler validate YourApp.app

# ========== Electron Forge ==========
# Development mode
npm start

# Package (no signing, quick test)
npm run package

# Full build (sign + notarize)
npm run make
```

---

## 📚 **Reference Documentation**

For detailed technical documentation, see:
- 📖 [docs/DISTRIBUTION.md](./docs/DISTRIBUTION.md) - Complete distribution guide
- 🔗 [Apple Developer - Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- 🔗 [Electron Forge - Code Signing](https://www.electronforge.io/guides/code-signing/code-signing-macos)

---

**Ready to start? Begin with Step 1!** 🚀

If you have any questions, refer to this checklist or ask for help.
