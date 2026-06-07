const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, dialog, shell, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

// ─── Configuration ───
const CLOUD_APP_URL = 'http://127.0.0.1:3000';
const VITE_DEV_URL = 'http://127.0.0.1:5173';
const REMOTE_FALLBACK_URL = 'https://jarvis-hybrid.vercel.app';
const APP_VERSION = '2.0.0';
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000;
const SKIP_SERVICE_LAUNCH = process.env.JARVIS_SKIP_SERVICE_LAUNCH === '1';
const LOAD_DIST_UI = process.env.JARVIS_LOAD_DIST === '1';

function isPipeClosedError(err) {
  return err && (err.code === 'EPIPE' || String(err.message || '').includes('EPIPE'));
}

function ignoreClosedPipe(err) {
  if (!isPipeClosedError(err)) {
    try { fs.appendFileSync(path.join(app.getPath('userData'), 'jarvis-main.log'), `[pipe-error] ${err.message || err}\n`); } catch {}
  }
}

try { process.stdout?.on?.('error', ignoreClosedPipe); } catch {}
try { process.stderr?.on?.('error', ignoreClosedPipe); } catch {}

// ─── Subprocess Management ───
let cloudProcess = null;
let pythonProcess = null;
let cloudReady = false;
let pythonReady = false;
let cloudError = '';
let pythonError = '';
const MAX_STARTUP_WAIT = 30000; // 30 seconds

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', data => { stdout += data.toString(); });
    child.stderr?.on('data', data => { stderr += data.toString(); });
    child.on('error', err => resolve({ success: false, error: err.message, stdout, stderr }));
    child.on('close', code => resolve({ success: code === 0, code, stdout, stderr, error: code === 0 ? '' : (stderr || `Exit code ${code}`) }));
  });
}

function ps(script) {
  return runCommand('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { timeout: 15000 });
}

function sendVolumeKey(keyCode, count = 1) {
  const safeCount = Math.max(1, Math.min(20, Number(count) || 1));
  return ps(`$wsh = New-Object -ComObject WScript.Shell; 1..${safeCount} | ForEach-Object { $wsh.SendKeys([char]${keyCode}); Start-Sleep -Milliseconds 35 }`);
}

function normalizeAppName(name = '') {
  const value = String(name).toLowerCase().trim();
  const apps = {
    notepad: 'notepad.exe',
    chrome: 'chrome.exe',
    calculator: 'calc.exe',
    calc: 'calc.exe',
    paint: 'mspaint.exe',
    wordpad: 'write.exe',
    cmd: 'cmd.exe',
    powershell: 'powershell.exe',
  };
  return apps[value] || name;
}

async function executeDesktopAction(action = {}) {
  const type = action.type || action.action;
  if (type === 'open-url' || type === 'open_url') {
    await shell.openExternal(action.url);
    return { success: true, message: 'Opened URL' };
  }
  if (type === 'search-google' || type === 'google_search') {
    await shell.openExternal('https://www.google.com/search?q=' + encodeURIComponent(action.query || ''));
    return { success: true, message: 'Google search opened' };
  }
  if (type === 'open-youtube' || type === 'play-youtube' || type === 'search-youtube' || type === 'youtube_search') {
    const query = action.query || '';
    const url = query
      ? 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query)
      : 'https://www.youtube.com';
    await shell.openExternal(url);
    return { success: true, message: query ? 'YouTube search opened' : 'YouTube opened' };
  }
  if (type === 'open-app' || type === 'open_app') {
    exec(process.platform === 'win32' ? `start "" "${normalizeAppName(action.app || action.name)}"` : `open -a "${action.app || action.name}"`);
    return { success: true, message: `Opened ${action.app || action.name}` };
  }
  if (type === 'volume-up' || type === 'volume_up') {
    if (process.platform === 'win32') return { ...(await sendVolumeKey(175, action.steps || 5)), message: 'Volume increased' };
  }
  if (type === 'volume-down' || type === 'volume_down') {
    if (process.platform === 'win32') return { ...(await sendVolumeKey(174, action.steps || 5)), message: 'Volume decreased' };
  }
  if (type === 'mute-toggle' || type === 'mute_toggle' || type === 'mute' || type === 'unmute') {
    if (process.platform === 'win32') return { ...(await sendVolumeKey(173, 1)), message: 'Mute toggled' };
  }
  if (type === 'screenshot') {
    const file = action.path || path.join(app.getPath('pictures'), `jarvis-screenshot-${Date.now()}.png`);
    const escaped = file.replace(/'/g, "''");
    const result = await ps(`Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $bmp.Save('${escaped}', [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose(); Write-Output '${escaped}'`);
    return { success: result.success, message: `Screenshot saved: ${file}`, path: file, error: result.error };
  }
  if (type === 'system-command') {
    const allowed = new Set(['lock']);
    if (!allowed.has(action.command)) return { success: false, message: 'Command not allowed from UI' };
    if (process.platform === 'win32') exec('rundll32.exe user32.dll,LockWorkStation');
    return { success: true, message: 'Command sent' };
  }
  return { success: false, message: 'Unknown desktop action' };
}

async function listenWithWindowsSpeech(language = 'en-US') {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Windows Speech API is only available on Windows' };
  }
  const culture = String(language).startsWith('ur') ? 'ur-PK' : 'en-US';
  const script = `
Add-Type -AssemblyName System.Speech
$culture = New-Object System.Globalization.CultureInfo('${culture}')
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
$recognizer.SetInputToDefaultAudioDevice()
$dictation = New-Object System.Speech.Recognition.DictationGrammar
$recognizer.LoadGrammar($dictation)
$result = $recognizer.Recognize([TimeSpan]::FromSeconds(8))
if ($result -and $result.Text) { Write-Output $result.Text }
$recognizer.Dispose()
`;
  const result = await ps(script);
  const text = (result.stdout || '').trim();
  return text ? { success: true, text, method: 'windows-speech' } : { success: false, error: result.error || 'No speech recognized' };
}

// ─── Logging Setup ───
const logDir = path.join(app.getPath('userData'), 'logs');
try { fs.mkdirSync(logDir, { recursive: true }); } catch {}
const logFile = path.join(logDir, 'jarvis-main.log');
function writeConsoleLog(level, args) {
  try {
    fs.appendFileSync(logFile, `[console:${level}] ${args.map(formatLogArg).join(' ')}\n`);
  } catch {}
}

console.log = (...args) => writeConsoleLog('log', args);
console.warn = (...args) => writeConsoleLog('warn', args);
console.error = (...args) => writeConsoleLog('error', args);

function formatLogArg(arg) {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack || arg.message;
  try { return JSON.stringify(arg); } catch { return String(arg); }
}

function safeConsole(method, message) {
  writeConsoleLog(method, [message]);
}

function log(level, ...args) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] [${level}] ${args.map(formatLogArg).join(' ')}\n`;
  try { fs.appendFileSync(logFile, msg); } catch {}
  safeConsole(level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log', msg.trimEnd());
}

process.on('uncaughtException', (err) => {
  if (isPipeClosedError(err)) {
    log('WARN', 'Ignored closed pipe from detached launcher');
    return;
  }
  log('ERROR', 'Uncaught exception:', err);
  try { dialog.showErrorBox('JARVIS Error', err.message || String(err)); } catch {}
});

function attachProcessLogging(child, name, onStdout, onStderr) {
  const attach = (stream, level, handler) => {
    if (!stream || stream.destroyed || stream.readableEnded) return;
    stream.on('data', (data) => {
      try {
        handler(data.toString());
      } catch (err) {
        if (!isPipeClosedError(err)) log('WARN', `[${name}] Stream handler failed:`, err.message);
      }
    });
    stream.on('error', (err) => {
      if (!isPipeClosedError(err)) log(level, `[${name}] Stream error:`, err.message);
    });
  };
  attach(child?.stdout, 'WARN', onStdout);
  attach(child?.stderr, 'WARN', onStderr);
}
log('INFO', '═══════════════════════════════════════');
log('INFO', 'JARVIS Hybrid Desktop v' + APP_VERSION + ' starting...');
log('INFO', 'Platform:', process.platform, 'Arch:', process.arch);

// ─── Path Resolution ───
function getProjectRoot() {
  // In development: electron/main.js is inside desktop-app/
  // In production: we're inside resources/app.asar
  const devRoot = path.join(__dirname, '..', '..');
  const prodRoot = path.join(process.resourcesPath, 'app');

  if (fs.existsSync(path.join(devRoot, 'package.json'))) {
    return devRoot;
  }
  return prodRoot;
}

function getPythonPath() {
  const root = getProjectRoot();
  const venvPython = path.join(root, '.venv', 'Scripts', 'python.exe');
  const systemPython = 'python';

  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return systemPython;
}

// ─── Subprocess Launchers ───
async function launchCloudBackend() {
  return new Promise(async (resolve, reject) => {
    log('INFO', '[Launcher] Starting cloud backend...');

    const root = getProjectRoot();
    const isWindows = process.platform === 'win32';

    // Check if npm is available
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';

    try {
      if (await checkCloudHealth()) {
        cloudReady = true;
        cloudError = '';
        log('INFO', '[Launcher] Existing cloud backend detected');
        resolve(true);
        return;
      }

      cloudProcess = spawn(npmCmd, ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3000'], {
        cwd: root,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      attachProcessLogging(cloudProcess, 'Cloud', (output) => {
        log('INFO', '[Cloud]', output.trim());

        // Check for ready signal
        if (output.includes('ready') || output.includes('started server') || output.includes('Local:')) {
          waitForCloud().then((ready) => {
            cloudReady = ready;
            cloudError = ready ? '' : 'Next.js started, but /api/health did not answer on http://127.0.0.1:3000';
            log(ready ? 'INFO' : 'WARN', '[Launcher]', ready ? 'Cloud backend ready' : cloudError);
            resolve(ready);
          });
        }
      }, (output) => {
        output = output.trim();
        if (output) cloudError = output.split(/\r?\n/).slice(-1)[0];
        log('WARN', '[Cloud]', output);
      });

      cloudProcess.on('error', (err) => {
        cloudError = err.message;
        log('ERROR', '[Cloud] Process error:', err.message);
        reject(err);
      });

      cloudProcess.on('close', (code) => {
        log('INFO', '[Cloud] Process exited with code:', code);
        cloudReady = false;
        if (code !== 0 && code !== null) cloudError = `Next.js process exited with code ${code}`;
      });

      // Timeout fallback
      setTimeout(() => {
        if (!cloudReady) {
          cloudError = cloudError || 'Next.js startup timed out on http://127.0.0.1:3000';
          log('WARN', '[Launcher]', cloudError);
          resolve(false);
        }
      }, MAX_STARTUP_WAIT);

    } catch (err) {
      cloudError = err.message;
      log('ERROR', '[Launcher] Failed to start cloud:', err.message);
      reject(err);
    }
  });
}

async function launchPythonAgent() {
  return new Promise((resolve, reject) => {
    log('INFO', '[Launcher] Starting Python desktop agent...');

    const root = getProjectRoot();
    const pythonPath = getPythonPath();
    const desktopPath = path.join(root, 'desktop');

    try {
      const args = [
        '-m', 'jarvis.main',
        '--cloud-url', CLOUD_APP_URL,
        '--no-voice',
        '--background',
      ];

      pythonProcess = spawn(pythonPath, args, {
        cwd: desktopPath,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      attachProcessLogging(pythonProcess, 'Python', (output) => {
        log('INFO', '[Python]', output.trim());

        // Check for ready signal
        if (output.includes('Ready') || output.includes('started') || output.includes('Online')) {
          pythonReady = true;
          log('INFO', '[Launcher] ✅ Python agent ready');
          resolve(true);
        }
      }, (output) => {
        output = output.trim();
        if (output) pythonError = output.split(/\r?\n/).slice(-1)[0];
        log('WARN', '[Python]', output);
      });

      pythonProcess.on('error', (err) => {
        pythonError = err.message;
        log('ERROR', '[Python] Process error:', err.message);
        reject(err);
      });

      pythonProcess.on('close', (code) => {
        log('INFO', '[Python] Process exited with code:', code);
        pythonReady = false;
        if (code !== 0 && code !== null) pythonError = `Python agent exited with code ${code}`;
      });

      // Timeout fallback
      setTimeout(() => {
        if (!pythonReady) {
          pythonError = pythonError || 'Python agent startup timed out';
          log('WARN', '[Launcher]', pythonError);
          resolve(false);
        }
      }, MAX_STARTUP_WAIT);

    } catch (err) {
      pythonError = err.message;
      log('ERROR', '[Launcher] Failed to start Python:', err.message);
      reject(err);
    }
  });
}

async function checkCloudHealth() {
  return new Promise((resolve) => {
  const request = net.request(CLOUD_APP_URL + '/api/health');
    request.on('response', (response) => {
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.end();
  });
}

async function waitForCloud() {
  log('INFO', '[Launcher] Waiting for cloud to be ready...');

  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const healthy = await checkCloudHealth();
    if (healthy) {
      log('INFO', '[Launcher] ✅ Cloud health check passed');
      return true;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  log('WARN', '[Launcher] Cloud health check timed out');
  return false;
}

function cleanupProcesses() {
  log('INFO', '[Launcher] Cleaning up subprocesses...');

  if (cloudProcess) {
    try {
      cloudProcess.kill();
      log('INFO', '[Launcher] Cloud process killed');
    } catch (err) {
      log('WARN', '[Launcher] Failed to kill cloud:', err.message);
    }
  }

  if (pythonProcess) {
    try {
      pythonProcess.kill();
      log('INFO', '[Launcher] Python process killed');
    } catch (err) {
      log('WARN', '[Launcher] Failed to kill Python:', err.message);
    }
  }
}

// ─── Auto-Updater ───
let autoUpdater = null;
try {
  const { autoUpdater: au } = require('electron-updater');
  autoUpdater = au;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = {
    info: (...a) => log('INFO', '[Updater]', ...a),
    error: (...a) => log('ERROR', '[Updater]', ...a),
    warn: (...a) => log('WARN', '[Updater]', ...a),
  };
  log('INFO', 'electron-updater loaded');
} catch (err) {
  log('WARN', 'electron-updater not available:', err.message);
}

// ─── State ───
let mainWindow = null;
let tray = null;
let isQuitting = false;
let trayCreated = false;
let loadFailed = false;
let lastWebVersion = null;
let updateDownloaded = false;

// ─── Icon Path Resolution ───
function getIconPath() {
  const candidates = [
    path.join(process.resourcesPath, 'app.asar', 'assets', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.png'),
    path.join(__dirname, 'assets', 'icon.png'),
    path.join(process.resourcesPath, 'assets', 'icon.png'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) { log('INFO', 'Icon found:', p); return p; } } catch {}
  }
  log('WARN', 'No icon.png found');
  return undefined;
}

function isOnline() { return net.isOnline(); }

async function clearBrowserCache() {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const ses = mainWindow.webContents.session;
      await ses.clearCache();
      await ses.clearStorageData({ storages: ['cache', 'serviceworker', 'shadercache'] });
      log('INFO', 'Browser cache cleared');
    }
  } catch (err) { log('WARN', 'Failed to clear cache:', err.message); }
}

// ─── Create Window ───
function createWindow() {
  log('INFO', 'Creating main window...');
  const iconPath = getIconPath();
  const windowOptions = {
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    backgroundColor: '#0a0a0f', show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      webSecurity: true,
      partition: 'persist:jarvis',
    },
  };
  if (iconPath) windowOptions.icon = iconPath;

  if (process.platform === 'win32') {
    try {
      const winVer = parseFloat(require('os').release());
      if (winVer >= 10) {
        windowOptions.frame = true;
        windowOptions.titleBarStyle = 'hidden';
        windowOptions.titleBarOverlay = { color: '#0a0a0f', symbolColor: '#a29bfe', height: 36 };
      } else { windowOptions.frame = false; }
    } catch { windowOptions.frame = false; }
  } else if (process.platform === 'darwin') {
    windowOptions.titleBarStyle = 'hiddenInset'; windowOptions.frame = true;
  } else { windowOptions.frame = false; }

  try { mainWindow = new BrowserWindow(windowOptions); } catch (err) {
    log('ERROR', 'Failed to create BrowserWindow:', err.message);
    try {
      mainWindow = new BrowserWindow({ width: 1200, height: 800, show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') } });
    } catch (err2) { dialog.showErrorBox('JARVIS Error', 'Could not create window: ' + err2.message); app.quit(); return; }
  }

  // Grant microphone permission
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'clipboard-read', 'clipboard-write', 'display-capture'];
    callback(allowed.includes(permission));
  });
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    return ['media', 'clipboard-read', 'clipboard-write', 'display-capture'].includes(permission);
  });

  loadWebApp();

  mainWindow.once('ready-to-show', () => { mainWindow.show(); mainWindow.focus(); });
  setTimeout(() => { if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) { mainWindow.show(); mainWindow.focus(); } }, 5000);

  mainWindow.webContents.on('did-finish-load', () => {
    log('INFO', 'Page loaded successfully');
    loadFailed = false;
    mainWindow.webContents.executeJavaScript(`
      if (window.electronAPI) {
        window.__JARVIS_DESKTOP__ = true;
        window.__JARVIS_VERSION__ = '${APP_VERSION}';
        window.__JARVIS_PLATFORM__ = '${process.platform}';
      }
    `).catch(() => {});
  });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
    log('ERROR', 'Failed to load:', errorCode, errorDesc);
    loadFailed = true;
    showOfflinePage(errorDesc);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'r') { event.preventDefault(); hardRefresh(); }
    if (input.control && input.shift && input.key.toLowerCase() === 'd') { event.preventDefault(); mainWindow.webContents.toggleDevTools(); }
    if (input.control && input.shift && input.key.toLowerCase() === 'u') { event.preventDefault(); checkForUpdates(); }
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); if (trayCreated) mainWindow.hide(); else mainWindow.minimize(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function loadWebApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const appUrl = app.isPackaged || LOAD_DIST_UI
    ? 'file://' + path.join(__dirname, '..', 'dist', 'index.html')
    : VITE_DEV_URL;
  log('INFO', 'Loading UI:', appUrl);

  if (app.isPackaged || isOnline()) {
    mainWindow.loadURL(appUrl, {
      userAgent: 'JARVIS-Hybrid-Desktop/' + APP_VERSION + ' (' + process.platform + ')',
      extraHeaders: 'Cache-Control: no-cache\nPragma: no-cache\n',
    }).catch(err => {
      log('ERROR', 'Failed to load modern UI:', err.message);
      if (isOnline()) {
        mainWindow.loadURL(REMOTE_FALLBACK_URL).catch(() => showOfflinePage('Connection failed'));
      } else {
        showOfflinePage('Connection failed');
      }
    });
  } else { showOfflinePage('No internet connection'); }
}

async function hardRefresh() {
  await clearBrowserCache();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reloadIgnoringCache();
}

function showOfflinePage(reason) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>JARVIS - Offline</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0f;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh}
  .c{text-align:center;max-width:500px;padding:40px}.logo{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#6c5ce7,#00cec9);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:36px;box-shadow:0 0 30px rgba(108,92,231,0.4)}
  h1{font-size:28px;margin-bottom:12px;color:#a29bfe}p{color:#8a8a9a;font-size:16px;margin-bottom:24px}
  .btn{background:linear-gradient(135deg,#6c5ce7,#a29bfe);color:#fff;border:none;padding:14px 32px;border-radius:12px;font-size:16px;cursor:pointer;font-weight:600}
  .btn:hover{transform:translateY(-2px)}</style></head>
  <body><div class="c"><div class="logo">🤖</div><h1>JARVIS Hybrid</h1>
  <p>انٹرنیٹ کنکشن نہیں ملا</p>${reason ? '<p style="color:#ff6b6b;font-size:13px">' + reason + '</p>' : ''}
  <button class="btn" onclick="window.electronAPI?.retryLoad()">🔄 دوبارہ کوشش</button>
  <p style="margin-top:20px;font-size:12px;color:#555">JARVIS Hybrid Desktop v${APP_VERSION}</p></div></body></html>`;
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch(() => {});
}

function createTray() {
  try {
    const iconPath = getIconPath();
    if (!iconPath) { log('WARN', 'No icon for tray'); return; }
    tray = new Tray(iconPath);
    trayCreated = true;
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'JARVIS v' + APP_VERSION, enabled: false },
      { type: 'separator' },
      { label: 'Open', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); } },
      { label: 'Hard Refresh', click: () => hardRefresh() },
      { type: 'separator' },
      { label: 'Check Updates', click: () => checkForUpdates() },
      { type: 'separator' },
      { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
    ]));
    tray.setToolTip('JARVIS Hybrid v' + APP_VERSION);
    tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else createWindow(); });
  } catch (err) { log('WARN', 'Failed to create tray:', err.message); trayCreated = false; }
}

// ─── Auto-Update ───
function checkForUpdates() {
  if (!app.isPackaged) {
    log('INFO', 'Skipping update check (dev mode)');
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'dev-mode' });
    return;
  }
  if (!autoUpdater) {
    log('WARN', 'Auto-updater not available');
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'not-available' });
    return;
  }
  log('INFO', 'Checking for updates...');
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'checking' });
  autoUpdater.checkForUpdates().catch(err => {
    log('ERROR', 'Update check failed:', err.message);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'error', message: err.message });
  });
}

if (autoUpdater) {
  autoUpdater.on('update-available', (info) => {
    log('INFO', 'Update available:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'available', version: info.version });
  });
  autoUpdater.on('download-progress', (p) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'downloading', percent: Math.round(p.percent), speed: Math.round(p.bytesPerSecond / 1024) + ' KB/s' });
  });
  autoUpdater.on('update-downloaded', (info) => {
    log('INFO', 'Update downloaded:', info.version);
    updateDownloaded = true;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'downloaded', version: info.version });
    try {
      if (Notification.isSupported()) {
        const n = new Notification({ title: 'JARVIS Update Ready', body: `v${info.version} downloaded. Restart to install.`, icon: getIconPath() });
        n.show(); n.on('click', () => { isQuitting = true; autoUpdater.quitAndInstall(false, true); });
      }
    } catch {}
  });
  autoUpdater.on('update-not-available', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'up-to-date', version: APP_VERSION });
  });
  autoUpdater.on('error', (err) => {
    log('ERROR', 'Auto-updater error:', err.message);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', { status: 'error', message: err.message });
  });
}

// ─── IPC Handlers ───
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => { if (mainWindow) { mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); } });
ipcMain.on('window-close', () => { if (!mainWindow) return; if (trayCreated) mainWindow.hide(); else { isQuitting = true; mainWindow.close(); } });
ipcMain.on('check-for-updates', () => checkForUpdates());
ipcMain.on('install-update', () => { if (autoUpdater && updateDownloaded) { isQuitting = true; autoUpdater.quitAndInstall(false, true); } });
ipcMain.on('retry-load', () => loadWebApp());
ipcMain.on('reload-page', () => { if (mainWindow) mainWindow.reload(); });
ipcMain.on('hard-refresh', () => hardRefresh());
ipcMain.on('clear-cache', async () => { await clearBrowserCache(); if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cache-cleared', { success: true }); });
ipcMain.handle('get-app-version', () => APP_VERSION);
ipcMain.handle('toggle-devtools', () => { if (mainWindow) mainWindow.webContents.toggleDevTools(); });
ipcMain.handle('get-log-path', () => logFile);
ipcMain.handle('is-desktop', () => true);
ipcMain.handle('get-app-url', () => CLOUD_APP_URL);
ipcMain.handle('get-platform', () => process.platform);
ipcMain.handle('get-status', () => ({ cloudReady, pythonReady, cloudError, pythonError, backendUrl: CLOUD_APP_URL }));
ipcMain.handle('listen-once', async (_, language) => listenWithWindowsSpeech(language));
ipcMain.handle('desktop-action', async (_, action = {}) => {
  try {
    const type = action.type || action.action;
    const nativeResult = await executeDesktopAction(action);
    if (nativeResult.success || nativeResult.message !== 'Unknown desktop action') return nativeResult;
    if (type === 'open-folder') {
      await shell.openPath(action.path);
      return { success: true, message: 'Opened folder' };
    }
    if (type === 'notification') {
      new Notification({ title: action.title || 'JARVIS', body: action.body || '' }).show();
      return { success: true, message: 'Notification shown' };
    }
    return { success: false, message: 'Unknown desktop action' };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
});

// ─── App Lifecycle ───
app.whenReady().then(async () => {
  log('INFO', 'App ready');

  try {
    const ses = session.fromPartition('persist:jarvis');
    await ses.clearCache();
    await ses.clearStorageData({ storages: ['cache', 'serviceworker', 'shadercache'] });
    log('INFO', 'Startup cache cleared');
  } catch (err) { log('WARN', 'Cache clear failed:', err.message); }

  // Launch subprocesses
  log('INFO', '[Launcher] Starting services...');

  if (SKIP_SERVICE_LAUNCH) {
    log('INFO', '[Launcher] Service launch skipped by START_JARVIS');
    cloudReady = await waitForCloud();
    if (!cloudReady) cloudError = cloudError || 'External backend did not become healthy on http://127.0.0.1:3000';
    pythonReady = true;
  } else {
    try {
      await launchCloudBackend();
      await waitForCloud();
    } catch (err) {
      log('ERROR', '[Launcher] Cloud backend failed:', err.message);
    }

    try {
      await launchPythonAgent();
    } catch (err) {
      log('ERROR', '[Launcher] Python agent failed:', err.message);
    }
  }

  createWindow();
  createTray();

  setTimeout(() => { if (app.isPackaged) checkForUpdates(); }, 15000);
  setInterval(() => { if (app.isPackaged) checkForUpdates(); }, 30 * 60 * 1000);
  setInterval(() => { if (loadFailed && isOnline()) loadWebApp(); }, 10000);
}).catch(err => { dialog.showErrorBox('JARVIS Error', err.message); app.quit(); });

app.on('window-all-closed', () => { if (process.platform !== 'darwin' && !trayCreated) app.quit(); });
app.on('activate', () => { if (!mainWindow) createWindow(); else { mainWindow.show(); mainWindow.focus(); } });
app.on('before-quit', () => {
  isQuitting = true;
  cleanupProcesses();
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) { app.quit(); } else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
}

log('INFO', 'Main process loaded');
