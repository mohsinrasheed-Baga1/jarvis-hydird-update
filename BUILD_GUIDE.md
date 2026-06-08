# 🚀 JARVIS Hybrid - Windows Build Guide

**Version:** 2.0.0 | **Platform:** Windows 10/11 | **Date:** June 5, 2026

---

## Prerequisites for Building

### Required Software
- **Node.js 18+** — [Download](https://nodejs.org)
- **Python 3.11+** — [Download](https://python.org)
- **Git** — [Download](https://git-scm.com)
- **Visual Studio Build Tools** (optional, for native modules)

### Verify Installation

```bash
node --version    # Should be v18.x or higher
python --version  # Should be 3.11 or higher
npm --version     # Should be 9.x or higher
```

---

## Build Steps

### 1. Clone Repository

```bash
git clone https://github.com/mohsinrasheed-Baga1/JARVIS-HYBRID.git
cd JARVIS-HYBRID
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies (root - cloud backend)
npm install

# Install Node.js dependencies (desktop app)
cd desktop-app
npm install
cd ..

# Install Python dependencies
python -m venv .venv
.venv\Scripts\activate
pip install -r desktop/requirements.txt
```

### 3. Build Cloud Backend

```bash
npm run build
```

This creates `.next/` folder with the production build.

### 4. Build Desktop App

```bash
cd desktop-app
npm run build:win
```

This creates:
- `release/JARVIS-Hybrid-Setup-2.0.0-x64.exe` — Installer
- `release/JARVIS-Hybrid-Portable-2.0.0.exe` — Portable version

---

## Build Options

### Full Installer (Recommended)

```bash
cd desktop-app
npm run build:win
```

Creates NSIS installer with:
- All dependencies bundled
- Desktop shortcut creation
- Start menu entry
- Uninstaller

### Portable EXE

```bash
cd desktop-app
npm run build:win-portable
```

Creates standalone executable:
- No installation needed
- Can run from USB drive
- Settings stored locally

### Development Build

```bash
cd desktop-app
npm run build
```

Creates unpacked version in `release/win-unpacked/`

---

## Build Configuration

### package.json Build Settings

```json
{
  "build": {
    "appId": "com.jarvis.hybrid",
    "productName": "JARVIS Hybrid",
    "directories": {
      "output": "release"
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "assets/icon.png"
    },
    "nsis": {
      "oneClick": false,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

### Customize Build

Edit `desktop-app/package.json` to modify:
- App ID and name
- Output directory
- Windows target formats
- NSIS installer options

---

## Include External Resources

### Bundle Python Desktop Agent

The build automatically includes the `desktop/` folder.

To include Python virtual environment:

```json
{
  "build": {
    "extraResources": [
      {
        "from": "../.venv",
        "to": ".venv",
        "filter": ["**/*"]
      }
    ]
  }
}
```

### Bundle Additional Files

```json
{
  "build": {
    "extraResources": [
      {
        "from": "assets",
        "to": "assets"
      },
      {
        "from": "../desktop",
        "to": "desktop"
      }
    ]
  }
}
```

---

## Code Signing (Optional)

### Requirements
- Code signing certificate (from DigiCert, Sectigo, etc.)
- SignTool (part of Windows SDK)

### Configure Signing

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/certificate.pfx",
      "certificatePassword": "your-password",
      "signingHashAlgorithms": ["sha256"],
      "sign": "./scripts/sign.js"
    }
  }
}
```

### Sign Script

Create `desktop-app/scripts/sign.js`:

```javascript
const { execSync } = require('child_process');
const path = require('path');

module.exports = async function(configuration) {
  const signTool = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe';
  const certPath = path.join(__dirname, '../certificate.pfx');
  
  execSync(`"${signTool}" sign /f "${certPath}" /p ${process.env.CERT_PASSWORD} /tr http://timestamp.digicert.com /td sha256 /fd sha256 "${configuration.path}"`);
};
```

---

## Auto-Update Setup

### GitHub Releases

1. Push code to GitHub
2. Create release on GitHub
3. Upload built EXE as asset
4. Auto-updater will detect new version

### Configure Publisher

```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "mohsinrasheed-Baga1",
      "repo": "JARVIS-HYBRID",
      "releaseType": "release"
    }
  }
}
```

### Publish Build

```bash
cd desktop-app
npm run build:win-publish
```

This automatically uploads to GitHub Releases.

---

## Testing the Build

### Test Installer

1. Run `JARVIS-Hybrid-Setup-2.0.0-x64.exe`
2. Complete installation
3. Launch from desktop shortcut
4. Verify all features work

### Test Portable

1. Run `JARVIS-Hybrid-Portable-2.0.0.exe`
2. Verify app starts
3. Check logs for errors
4. Test chat, voice, automation

---

## Build Troubleshooting

### "electron-builder not found"

```bash
npm install --save-dev electron-builder
```

### "Python not found in PATH"

Ensure Python is installed and in PATH:
```bash
# Add to PATH (Windows)
setx PATH "%PATH%;C:\Python311;C:\Python311\Scripts"
```

### "Node modules missing"

```bash
rm -rf node_modules
npm install
```

### "Build fails with native module error"

```bash
# Rebuild native modules
npm run postinstall
```

### "NSIS installer creation failed"

1. Check icon file exists: `desktop-app/assets/icon.png`
2. Verify NSIS plugin configuration
3. Run build with verbose logging:
   ```bash
   npm run build:win -- --verbose
   ```

---

## Build Output

### File Structure

```
desktop-app/release/
├── JARVIS-Hybrid-Setup-2.0.0-x64.exe    # Installer
├── JARVIS-Hybrid-Portable-2.0.0.exe       # Portable
├── win-unpacked/                          # Unpacked files
│   ├── JARVIS Hybrid.exe
│   ├── resources/
│   │   ├── app.asar
│   │   ├── desktop/
│   │   └── assets/
│   └── ...
└── builder-effective-config.yaml
```

### Sizes (Approximate)

| Build Type | Size |
|------------|------|
| Installer | ~150 MB |
| Portable | ~150 MB |
| Unpacked | ~200 MB |

---

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/build.yml`:

```yaml
name: Build JARVIS

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install Dependencies
      run: |
        npm install
        cd desktop-app && npm install
        pip install -r desktop/requirements.txt
    
    - name: Build
      run: |
        cd desktop-app
        npm run build:win
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Distribution

### Upload to GitHub Releases

```bash
# Using gh CLI
gh release create v2.0.0 \
  ./desktop-app/release/JARVIS-Hybrid-Setup-2.0.0-x64.exe \
  ./desktop-app/release/JARVIS-Hybrid-Portable-2.0.0.exe \
  --title "JARVIS Hybrid v2.0.0" \
  --notes "Release notes here"
```

### Manual Upload

1. Go to GitHub → Releases → Draft new release
2. Tag version: `v2.0.0`
3. Upload built EXE files
4. Publish release

---

## Next Steps

After building:
1. Test on clean Windows machine
2. Verify auto-update works
3. Check all features
4. Distribute via GitHub Releases

---

**Build complete!** 🎉

For user installation, see `INSTALL.md`
