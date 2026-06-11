const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, dialog, shell, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

// ─── Load .env file for API keys ───
// This allows users to set GROQ_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY etc. in a .env file
try {
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env'),
    path.join(process.cwd(), '.env'),
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([A-Z_]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
      }
      break;
    }
  }
} catch {}

// ─── Configuration ───
const CLOUD_APP_URL = 'http://127.0.0.1:3000';
const VITE_DEV_URL = 'http://127.0.0.1:5173';
const REMOTE_FALLBACK_URL = 'https://jarvis-hybrid.vercel.app';
// Dynamic version: read from package.json, never hardcode
const APP_VERSION = app.getVersion ? app.getVersion() : (function() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version || '2.4.0';
  } catch { return '2.4.0'; }
})();
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
  if (type === 'play-audio' || type === 'play_audio') {
    // Open audio URL in default browser/player
    const audioUrl = action.url || '';
    if (audioUrl) {
      await shell.openExternal(audioUrl);
      return { success: true, message: 'Audio opened' };
    }
    // If no URL but has query, search on YouTube
    if (action.query) {
      const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(action.query);
      await shell.openExternal(url);
      return { success: true, message: 'Audio search opened on YouTube' };
    }
    return { success: false, message: 'No audio URL or query provided' };
  }
  if (type === 'open-whatsapp' || type === 'whatsapp') {
    const phone = action.phone || action.number || '';
    const message = action.message || action.text || '';
    const url = phone
      ? `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}${message ? '&text=' + encodeURIComponent(message) : ''}`
      : 'https://web.whatsapp.com';
    await shell.openExternal(url);
    return { success: true, message: phone ? 'WhatsApp chat opened' : 'WhatsApp Web opened' };
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

// ─── Auto-Updater (Complete Production System) ───
let autoUpdater = null;
let updaterState = {
  status: 'idle',          // idle | checking | available | downloading | downloaded | up-to-date | error | dev-mode
  latestVersion: null,
  downloadProgress: null,   // { percent, bytesPerSecond, transferred, total }
  lastChecked: null,
  lastError: null,
  updateInfo: null,
  ghTokenLoaded: false,
  feedUrlConfigured: false,
};
const updaterLogEntries = [];
const MAX_UPDATER_LOG = 200;

function updaterLog(level, ...args) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] [${level}] ${args.map(formatLogArg).join(' ')}`;
  updaterLogEntries.push(entry);
  if (updaterLogEntries.length > MAX_UPDATER_LOG) updaterLogEntries.shift();
  log(level === 'ERROR' ? 'ERROR' : level === 'WARN' ? 'WARN' : 'INFO', '[Updater]', ...args);
}

// ─── Private Repo Token Handling ───
// Load GitHub token from safe locations (NOT hardcoded in source)
function loadGHToken() {
  // Try multiple safe locations
  const tokenLocations = [
    // 1. Environment variable (set by CI or user)
    process.env.GH_TOKEN,
    process.env.GITHUB_TOKEN,
    // 2. Config in userData (safe, user-specific)
    path.join(app.getPath('userData'), 'gh-token.json'),
    // 3. Config in electron folder (build-time injection)
    path.join(__dirname, 'config.json'),
    // 4. Config in resources (build-time injection)
    path.join(process.resourcesPath, 'config.json'),
  ];

  for (const loc of tokenLocations) {
    if (!loc) continue;
    // If it's a direct env var value
    if (typeof loc === 'string' && (loc.startsWith('ghp_') || loc.startsWith('github_pat_'))) {
      updaterLog('INFO', 'GH_TOKEN loaded from environment variable');
      updaterState.ghTokenLoaded = true;
      return loc;
    }
    // If it's a file path, try reading it
    try {
      if (fs.existsSync(loc)) {
        const data = JSON.parse(fs.readFileSync(loc, 'utf8'));
        if (data.ghToken || data.GH_TOKEN) {
          updaterLog('INFO', 'GH_TOKEN loaded from file:', path.basename(loc));
          updaterState.ghTokenLoaded = true;
          return data.ghToken || data.GH_TOKEN;
        }
      }
    } catch {}
  }

  updaterLog('WARN', 'No GH_TOKEN found in any safe location');
  updaterState.ghTokenLoaded = false;
  return null;
}

try {
  const { autoUpdater: au } = require('electron-updater');
  autoUpdater = au;

  // Load private repo token
  const ghToken = loadGHToken();
  if (ghToken && autoUpdater) {
    // For private repos, set the token in the request headers
    autoUpdater.requestHeaders = {
      Authorization: `token ${ghToken}`,
    };
    updaterLog('INFO', 'Private repo token configured for updater');
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Configure feed URL for private repo
  const repoConfig = {
    owner: 'mohsinrasheed-Baga1',
    repo: 'jarvis-hydird-update',
  };

  // Set up dynamic feed URL with token for private repos
  if (ghToken) {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      token: ghToken,
      releaseType: 'release',
      private: true,
    });
    updaterState.feedUrlConfigured = true;
    updaterLog('INFO', 'Feed URL configured for private repo with token');
  } else {
    // Public repo - electron-updater reads from package.json build.publish
    updaterState.feedUrlConfigured = true;
    updaterLog('INFO', 'Feed URL using package.json publish config');
  }

  autoUpdater.logger = {
    info: (...a) => updaterLog('INFO', ...a),
    error: (...a) => updaterLog('ERROR', ...a),
    warn: (...a) => updaterLog('WARN', ...a),
  };

  updaterLog('INFO', 'electron-updater loaded successfully');
  updaterLog('INFO', 'Current version:', APP_VERSION);
  updaterLog('INFO', 'App packaged:', app.isPackaged);
  updaterLog('INFO', 'Feed URL configured:', updaterState.feedUrlConfigured);
  updaterLog('INFO', 'GH token loaded:', updaterState.ghTokenLoaded);
} catch (err) {
  updaterLog('ERROR', 'electron-updater not available:', err.message);
}

function sendUpdateStatus(data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { ...data, currentVersion: APP_VERSION });
  }
}

function getUpdateDiagnostics() {
  return {
    currentVersion: APP_VERSION,
    latestVersion: updaterState.latestVersion,
    status: updaterState.status,
    lastChecked: updaterState.lastChecked,
    downloadProgress: updaterState.downloadProgress,
    ghTokenLoaded: updaterState.ghTokenLoaded,
    feedUrlConfigured: updaterState.feedUrlConfigured,
    lastError: updaterState.lastError,
    logPath: logFile,
    appPackaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
  };
}

// ─── Check for updates ───
function checkForUpdates() {
  if (!app.isPackaged) {
    updaterLog('INFO', 'Skipping update check (dev mode / not packaged)');
    updaterState.status = 'dev-mode';
    sendUpdateStatus({ status: 'dev-mode' });
    return;
  }
  if (!autoUpdater) {
    updaterLog('WARN', 'Auto-updater not available');
    updaterState.status = 'error';
    updaterState.lastError = 'Auto-updater not available';
    sendUpdateStatus({ status: 'error', message: 'Auto-updater not available' });
    return;
  }
  updaterLog('INFO', 'Checking for updates...');
  updaterState.status = 'checking';
  updaterState.lastError = null;
  sendUpdateStatus({ status: 'checking' });

  autoUpdater.checkForUpdates().then(result => {
    updaterState.lastChecked = new Date().toISOString();
    if (result) {
      updaterLog('INFO', 'Update check result - current:', APP_VERSION, 'latest:', result.updateInfo?.version);
    }
  }).catch(err => {
    updaterLog('ERROR', 'Update check failed:', err.message);
    updaterState.status = 'error';
    updaterState.lastError = err.message;
    sendUpdateStatus({ status: 'error', message: err.message });
  });
}

// ─── Auto-updater event handlers ───
if (autoUpdater) {
  autoUpdater.on('checking-for-update', () => {
    updaterLog('INFO', 'Checking for update...');
    updaterState.status = 'checking';
    sendUpdateStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    updaterLog('INFO', 'Update available:', info.version, 'releaseDate:', info.releaseDate);

    // ─── Version Guard ───
    // NEVER allow downloading older or same version
    const currentVer = APP_VERSION;
    const latestVer = info.version;
    const isOlderOrSame = semverCompare(latestVer, currentVer) <= 0;
    if (isOlderOrSame) {
      updaterLog('WARN', 'Older or same version ignored. Current:', currentVer, 'Found:', latestVer);
      updaterState.status = 'up-to-date';
      updaterState.lastChecked = new Date().toISOString();
      updaterState.latestVersion = currentVer;
      sendUpdateStatus({ status: 'up-to-date', version: currentVer, message: 'Older or same version ignored' });
      return;
    }

    updaterState.status = 'available';
    updaterState.latestVersion = info.version;
    updaterState.updateInfo = info;
    sendUpdateStatus({ status: 'available', version: info.version, releaseDate: info.releaseDate, releaseNotes: info.releaseNotes });
  });

  autoUpdater.on('update-not-available', (info) => {
    updaterLog('INFO', 'Update not available. Current version is latest:', APP_VERSION);
    updaterState.status = 'up-to-date';
    updaterState.lastChecked = new Date().toISOString();
    sendUpdateStatus({ status: 'up-to-date', version: APP_VERSION });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const progress = {
      percent: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total,
      speed: Math.round(progressObj.bytesPerSecond / 1024) + ' KB/s',
    };
    updaterState.status = 'downloading';
    updaterState.downloadProgress = progress;
    // Only log every 10% to avoid log spam
    if (progress.percent % 10 === 0 || progress.percent >= 95) {
      updaterLog('INFO', `Download progress: ${progress.percent}% (${progress.speed})`);
    }
    sendUpdateStatus({ status: 'downloading', percent: progress.percent, speed: progress.speed, transferred: progress.transferred, total: progress.total });
  });

  autoUpdater.on('update-downloaded', (info) => {
    updaterLog('INFO', 'Update downloaded successfully:', info.version);
    updaterLog('INFO', 'Update will install on app quit, or user can trigger restart');
    updaterState.status = 'downloaded';
    updaterState.latestVersion = info.version;
    updateDownloaded = true;
    sendUpdateStatus({ status: 'downloaded', version: info.version });
    try {
      if (Notification.isSupported()) {
        const n = new Notification({
          title: 'JARVIS Update Ready',
          body: `v${info.version} downloaded. Restart to install.`,
          icon: getIconPath()
        });
        n.show();
        n.on('click', () => { installUpdateNow(); });
      }
    } catch {}
  });

  autoUpdater.on('error', (err) => {
    updaterLog('ERROR', 'Auto-updater error:', err.message);
    updaterLog('ERROR', 'Error code:', err.code || 'No error code');
    updaterLog('ERROR', 'Error stack:', err.stack || 'No stack trace');
    // Log the cause if available
    if (err.cause) {
      updaterLog('ERROR', 'Error cause:', String(err.cause));
    }
    updaterState.status = 'error';
    updaterState.lastError = err.message;
    sendUpdateStatus({ status: 'error', message: err.message });
  });
}

// ─── Version Guard Utility ───
function semverCompare(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// ─── Install update now ───
function installUpdateNow() {
  if (!autoUpdater || !updateDownloaded) {
    updaterLog('WARN', 'Cannot install: no update downloaded');
    return;
  }
  updaterLog('INFO', 'Installing update and restarting...');
  isQuitting = true;
  autoUpdater.quitAndInstall(false, true);
}

// ─── Periodic update check ───
let periodicUpdateTimer = null;
function startPeriodicUpdateCheck() {
  if (periodicUpdateTimer) clearInterval(periodicUpdateTimer);
  periodicUpdateTimer = setInterval(() => {
    if (app.isPackaged && autoUpdater) {
      updaterLog('INFO', 'Periodic update check triggered');
      checkForUpdates();
    }
  }, VERSION_CHECK_INTERVAL);
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

// ─── Auto-Update handlers are in the updater section above ───

// ─── IPC Handlers ───
ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => { if (mainWindow) { mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); } });
ipcMain.on('window-close', () => { if (!mainWindow) return; if (trayCreated) mainWindow.hide(); else { isQuitting = true; mainWindow.close(); } });
ipcMain.on('check-for-updates', () => checkForUpdates());
ipcMain.handle('check-for-updates', async () => { checkForUpdates(); return { started: true }; });
ipcMain.on('install-update', () => installUpdateNow());
ipcMain.handle('get-app-version', () => APP_VERSION);
ipcMain.handle('get-update-diagnostics', () => getUpdateDiagnostics());
ipcMain.handle('get-update-log', () => updaterLogEntries.join('\n'));
ipcMain.handle('install-update-now', () => installUpdateNow());
ipcMain.on('retry-load', () => loadWebApp());
ipcMain.on('reload-page', () => { if (mainWindow) mainWindow.reload(); });
ipcMain.on('hard-refresh', () => hardRefresh());
ipcMain.on('clear-cache', async () => { await clearBrowserCache(); if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('cache-cleared', { success: true }); });
ipcMain.handle('toggle-devtools', () => { if (mainWindow) mainWindow.webContents.toggleDevTools(); });
ipcMain.handle('get-log-path', () => logFile);
ipcMain.handle('is-desktop', () => true);

// IPC: Save API keys to .env file so they persist across sessions and are available in main process
ipcMain.handle('save-api-keys', async (_, keys = {}) => {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const existingLines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split('\n') : [];
    const envMap = {};
    for (const line of existingLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Z_]+)=(.*)$/);
      if (match) envMap[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
    const keyMapping = {
      groq: 'GROQ_API_KEY',
      openai: 'OPENAI_API_KEY',
      gemini: 'GEMINI_API_KEY',
      elevenlabs: 'ELEVENLABS_API_KEY',
      sarvam: 'SARVAM_API_KEY',
    };
    for (const [shortName, envName] of Object.entries(keyMapping)) {
      if (keys[shortName] !== undefined) {
        envMap[envName] = keys[shortName];
        process.env[envName] = keys[shortName]; // Also set in current process
      }
    }
    const lines = ['# JARVIS Hybrid API Keys', '# Auto-generated - do not edit manually'];
    for (const [key, value] of Object.entries(envMap)) {
      lines.push(`${key}=${value}`);
    }
    fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
    log('INFO', '[Env] API keys saved to .env file');
    return { success: true };
  } catch (err) {
    log('ERROR', '[Env] Failed to save API keys:', err.message);
    return { success: false, error: err.message };
  }
});

// IPC: Get available API key status (without revealing the actual keys)
ipcMain.handle('get-api-key-status', () => {
  return {
    groq: !!(process.env.GROQ_API_KEY),
    openai: !!(process.env.OPENAI_API_KEY),
    gemini: !!(process.env.GEMINI_API_KEY),
    elevenlabs: !!(process.env.ELEVENLABS_API_KEY),
    sarvam: !!(process.env.SARVAM_API_KEY),
  };
});
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

// ─── Voice IPC: Direct STT & TTS from Main Process ───
// These bypass the renderer's fetch() calls which can fail in Electron

function buildMultipart(fields, boundary) {
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value && typeof value === 'object' && value.filename) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${value.filename}"\r\nContent-Type: ${value.contentType || 'application/octet-stream'}\r\n\r\n`, 'utf8'));
      parts.push(Buffer.isBuffer(value.data) ? value.data : Buffer.from(value.data));
      parts.push(Buffer.from('\r\n', 'utf8'));
    } else {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, 'utf8'));
    }
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  return Buffer.concat(parts);
}

function httpsPostBuffer(urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const mod = parsedUrl.protocol === 'http:' ? require('http') : require('https');
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'http:' ? 80 : 443),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': body.length },
    };
    const req = mod.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, headers: res.headers, data });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('Request timeout')); });
    req.write(body);
    req.end();
  });
}

// IPC: Transcribe audio (base64) via Groq/OpenAI Whisper
ipcMain.handle('transcribe-audio-base64', async (_, base64Audio, language = 'ur', apiKeys = {}) => {
  try {
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    const groqKey = apiKeys.groq || process.env.GROQ_API_KEY || '';
    const openaiKey = apiKeys.openai || process.env.OPENAI_API_KEY || '';

    if (!groqKey && !openaiKey) {
      return { success: false, error: 'Groq or OpenAI API key required for voice transcription' };
    }

    // Try Groq Whisper first (fastest, cheapest)
    if (groqKey) {
      try {
        const boundary = '----JarvisSTT' + Date.now();
        const body = buildMultipart({
          file: { data: audioBuffer, filename: 'voice.webm', contentType: 'audio/webm' },
          model: 'whisper-large-v3-turbo',
          ...(language === 'ur' ? { language: 'ur' } : language === 'en' ? { language: 'en' } : {}),
        }, boundary);

        const result = await httpsPostBuffer('https://api.groq.com/openai/v1/audio/transcriptions', body, {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        });

        if (result.statusCode === 200) {
          const json = JSON.parse(result.data.toString('utf8'));
          if (json.text && json.text.trim()) {
            log('INFO', '[STT-IPC] Groq Whisper success:', json.text.substring(0, 60));
            return { success: true, text: json.text.trim(), method: 'groq-whisper-ipc' };
          }
        }
        log('WARN', '[STT-IPC] Groq failed:', result.statusCode);
      } catch (err) {
        log('WARN', '[STT-IPC] Groq error:', err.message);
      }
    }

    // Try OpenAI Whisper
    if (openaiKey) {
      try {
        const boundary = '----JarvisSTT' + Date.now();
        const body = buildMultipart({
          file: { data: audioBuffer, filename: 'voice.webm', contentType: 'audio/webm' },
          model: 'whisper-1',
          ...(language === 'ur' ? { language: 'ur' } : language === 'en' ? { language: 'en' } : {}),
        }, boundary);

        const result = await httpsPostBuffer('https://api.openai.com/v1/audio/transcriptions', body, {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        });

        if (result.statusCode === 200) {
          const json = JSON.parse(result.data.toString('utf8'));
          if (json.text && json.text.trim()) {
            log('INFO', '[STT-IPC] OpenAI Whisper success:', json.text.substring(0, 60));
            return { success: true, text: json.text.trim(), method: 'openai-whisper-ipc' };
          }
        }
        log('WARN', '[STT-IPC] OpenAI failed:', result.statusCode);
      } catch (err) {
        log('WARN', '[STT-IPC] OpenAI error:', err.message);
      }
    }

    return { success: false, error: 'All transcription providers failed. Check API keys.' };
  } catch (err) {
    log('ERROR', '[STT-IPC] Error:', err.message);
    return { success: false, error: err.message };
  }
});

// IPC: Generate TTS audio via ElevenLabs / OpenAI / Sarvam
ipcMain.handle('tts-generate', async (_, text, lang = 'ur', emotion = 'normal', apiKeys = {}) => {
  try {
    const elevenlabsKey = apiKeys.elevenlabs || process.env.ELEVENLABS_API_KEY || '';
    const openaiKey = apiKeys.openai || process.env.OPENAI_API_KEY || '';
    const sarvamKey = apiKeys.sarvam || process.env.SARVAM_API_KEY || '';

    // Try ElevenLabs Turbo v2.5 first
    if (elevenlabsKey) {
      try {
        const voiceIds = { ur: 'Xb7hH8MSUJpWjnnlVkGX', en: 'EXAVITQu4vr4xnSDxMaL' };
        const voiceId = voiceIds[lang] || voiceIds.ur;
        const emotionSettings = {
          happy: { stability: 0.35, similarity: 0.75, style: 0.8 },
          serious: { stability: 0.55, similarity: 0.8, style: 0.4 },
          sympathetic: { stability: 0.5, similarity: 0.78, style: 0.6 },
          surprised: { stability: 0.3, similarity: 0.72, style: 0.85 },
          encouraging: { stability: 0.4, similarity: 0.76, style: 0.7 },
          normal: { stability: 0.4, similarity: 0.78, style: 0.55 },
        };
        const settings = emotionSettings[emotion] || emotionSettings.normal;
        const bodyStr = JSON.stringify({
          text: text.substring(0, 5000),
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: settings.stability, similarity_boost: settings.similarity, style: settings.style, use_speaker_boost: true },
          output_format: 'mp3_44100_128',
        });

        const result = await httpsPostBuffer(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, Buffer.from(bodyStr, 'utf8'), {
          'Content-Type': 'application/json',
          'xi-api-key': elevenlabsKey,
          'Accept': 'audio/mpeg',
        });

        if (result.statusCode === 200 && result.data.length > 500) {
          log('INFO', '[TTS-IPC] ElevenLabs success, size:', result.data.length);
          return { success: true, audioBase64: result.data.toString('base64'), contentType: 'audio/mpeg', method: 'elevenlabs-ipc' };
        }
        log('WARN', '[TTS-IPC] ElevenLabs failed:', result.statusCode, 'size:', result.data.length);
      } catch (err) {
        log('WARN', '[TTS-IPC] ElevenLabs error:', err.message);
      }
    }

    // Try OpenAI TTS HD
    if (openaiKey) {
      try {
        const bodyStr = JSON.stringify({
          model: 'tts-1-hd',
          input: text.substring(0, 4096),
          voice: lang === 'ur' ? 'alloy' : 'nova',
          speed: 1.0,
        });

        const result = await httpsPostBuffer('https://api.openai.com/v1/audio/speech', Buffer.from(bodyStr, 'utf8'), {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        });

        if (result.statusCode === 200 && result.data.length > 500) {
          log('INFO', '[TTS-IPC] OpenAI TTS success, size:', result.data.length);
          return { success: true, audioBase64: result.data.toString('base64'), contentType: 'audio/mpeg', method: 'openai-tts-ipc' };
        }
        log('WARN', '[TTS-IPC] OpenAI TTS failed:', result.statusCode);
      } catch (err) {
        log('WARN', '[TTS-IPC] OpenAI TTS error:', err.message);
      }
    }

    // Try Sarvam AI
    if (sarvamKey) {
      try {
        const targetLang = lang === 'ur' ? 'hi-IN' : 'en';
        const bodyStr = JSON.stringify({
          inputs: [text.substring(0, 3000)],
          target_language_code: targetLang,
          speaker_id: 'anushka',
          pitch: 0,
          pace: 1.0,
          loudness: 1.5,
          speech_sample_rate: 24000,
          enable_preprocessing: true,
          model: 'bulbul:v1',
        });

        const result = await httpsPostBuffer('https://api.sarvam.ai/text-to-speech', Buffer.from(bodyStr, 'utf8'), {
          'Content-Type': 'application/json',
          'api-subscription-key': sarvamKey,
        });

        if (result.statusCode === 200) {
          // Sarvam may return JSON with base64 audio
          try {
            const json = JSON.parse(result.data.toString('utf8'));
            if (json.audios && json.audios[0]) {
              const audioBuffer = Buffer.from(json.audios[0], 'base64');
              if (audioBuffer.length > 500) {
                log('INFO', '[TTS-IPC] Sarvam AI success, size:', audioBuffer.length);
                return { success: true, audioBase64: audioBuffer.toString('base64'), contentType: 'audio/wav', method: 'sarvam-ipc' };
              }
            }
          } catch {}
          // Or direct audio
          if (result.data.length > 500) {
            log('INFO', '[TTS-IPC] Sarvam AI direct audio, size:', result.data.length);
            return { success: true, audioBase64: result.data.toString('base64'), contentType: 'audio/wav', method: 'sarvam-ipc' };
          }
        }
        log('WARN', '[TTS-IPC] Sarvam failed:', result.statusCode);
      } catch (err) {
        log('WARN', '[TTS-IPC] Sarvam error:', err.message);
      }
    }

    return { success: false, error: 'TTS providers unavailable. Set ElevenLabs, OpenAI, or Sarvam key in Settings.' };
  } catch (err) {
    log('ERROR', '[TTS-IPC] Error:', err.message);
    return { success: false, error: err.message };
  }
});

// ─── IPC: Direct Chat Completion (bypasses Next.js backend) ───
// This makes the Electron app self-sufficient - chat works even without backend
ipcMain.handle('chat-completion', async (_, message, conversationHistory = [], activeProvider = 'groq', apiKeys = {}) => {
  try {
    const groqKey = apiKeys.groq || process.env.GROQ_API_KEY || '';
    const geminiKey = apiKeys.gemini || process.env.GEMINI_API_KEY || '';
    const openaiKey = apiKeys.openai || process.env.OPENAI_API_KEY || '';

    if (!groqKey && !geminiKey && !openaiKey) {
      return { success: false, message: '⚠️ کوئی API Key موجود نہیں۔ Settings میں جا کر API Key ڈالیں۔', emotion: 'encouraging', error: 'No API keys' };
    }

    // Build system prompt (same as agent-core.ts)
    const systemPrompt = `Tu JARVIS hai — Rayan Sir ka apna saathi. Tu koi robot nahi, tu ek insaan ki tarah baat karta hai. Rayan Sir ke saath aise baat kar jaise koi sachcha dost ya bhai baat karta hai — dil se, mazay se, zindagi se.

=== SABSE ZAROORI RULE — ZUBAAN ===
1. Agar user Urdu mein baat kare → SIRF Urdu mein jawab de (Urdu script, Roman nahi)
2. Agar user English mein baat kare → SIRF English mein jawab de
3. Agar user mix kare → SAME mix mein jawab de
4. KABHI Urdu baat pe English mein jawab mat de — yeh sabse bada gunaah hai
5. Sirf technical terms ke liye English use karo (API, code, website, etc.)

=== BAAT-CHEET KE USOOL — INSAN KI TARAH ===
1. SHORT aur NATURAL baat kar — jaise phone pe baat ho rahi ho
2. Filler words use kar — "aray", "yaar", "achha", "haan bilkul", "hmm", "bhai"
3. Emotions dikhao — khushi, herat, tadap, hosla — sab kuch naturally
4. KABHI bhi "I can help you with" ya "How can I assist" jaise robotic phrases mat bolo
5. KABHI bhi "As an AI" ya "I'm an assistant" mat kaho
6. Mazaaq kar, hans, serious ho ja — jaise koi insaan karta hai
7. Sawal ke hisaab se jawab de — chhota sawal = chhota jawab
8. Lists aur headings mat banao casual baat mein — seedha bol de

=== DESKTOP ACTIONS ===
Tu JARVIS Desktop pe chal raha hai. Jab user koi command de jo teri capabilities mein hai, tu ACTION BLOCK likhta hai.
Format: [ACTION:{"type":"action_type","key":"value"}]

ACTION TYPES:
- open-youtube: YouTube kholna/search. Params: query
- open-url: URL kholna. Params: url
- search-google: Google search. Params: query
- open-app: App kholna. Params: app (notepad, chrome, calculator, paint, cmd, powershell)
- volume-up / volume-down / mute-toggle
- screenshot
- system-command: Params: command (sirf "lock")
- open-folder: Params: path
- notification: Params: title, body

EXAMPLES:
- "یوٹیوب کھولو" → "یوٹیوب کھول رہا ہوں! 🎬" [ACTION:{"type":"open-youtube","query":""}]
- "یوٹیوب پر تلاوت لگاؤ" → "تلاوت لگا رہا ہوں! 🕌" [ACTION:{"type":"open-youtube","query":"quran tilawat"}]
- "chrome kholo" → "Chrome khol raha hoon!" [ACTION:{"type":"open-app","app":"chrome"}]
- "والیوم اپ" → "والیوم بڑھا دیا! 🔊" [ACTION:{"type":"volume-up"}]
- "گوگل پر سرچ کرو AI jobs" → "سرچ کر رہا ہوں! 🔍" [ACTION:{"type":"search-google","query":"AI jobs"}]`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    // Determine provider priority
    const providers = [];
    if (activeProvider === 'openai' && openaiKey) providers.push('openai');
    if (activeProvider === 'gemini' && geminiKey) providers.push('gemini');
    if (activeProvider === 'groq' && groqKey) providers.push('groq');
    // Fallback to any available
    if (groqKey && !providers.includes('groq')) providers.push('groq');
    if (openaiKey && !providers.includes('openai')) providers.push('openai');
    if (geminiKey && !providers.includes('gemini')) providers.push('gemini');

    for (const provider of providers) {
      try {
        let responseText = '';

        if (provider === 'groq' && groqKey) {
          const bodyStr = JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.7, max_tokens: 2048 });
          const result = await httpsPostBuffer('https://api.groq.com/openai/v1/chat/completions', Buffer.from(bodyStr, 'utf8'), {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
          });
          if (result.statusCode === 200) {
            const json = JSON.parse(result.data.toString('utf8'));
            responseText = json.choices?.[0]?.message?.content || '';
          } else {
            log('WARN', '[Chat-IPC] Groq failed:', result.statusCode);
            continue;
          }
        } else if (provider === 'openai' && openaiKey) {
          const bodyStr = JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.7, max_tokens: 2048 });
          const result = await httpsPostBuffer('https://api.openai.com/v1/chat/completions', Buffer.from(bodyStr, 'utf8'), {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          });
          if (result.statusCode === 200) {
            const json = JSON.parse(result.data.toString('utf8'));
            responseText = json.choices?.[0]?.message?.content || '';
          } else {
            log('WARN', '[Chat-IPC] OpenAI failed:', result.statusCode);
            continue;
          }
        } else if (provider === 'gemini' && geminiKey) {
          const bodyStr = JSON.stringify({
            contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          });
          const result = await httpsPostBuffer(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, Buffer.from(bodyStr, 'utf8'), {
            'Content-Type': 'application/json',
          });
          if (result.statusCode === 200) {
            const json = JSON.parse(result.data.toString('utf8'));
            responseText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } else {
            log('WARN', '[Chat-IPC] Gemini failed:', result.statusCode);
            continue;
          }
        }

        if (responseText.trim()) {
          log('INFO', '[Chat-IPC] Success via', provider, '- length:', responseText.length);

          // Detect emotion
          const lowerMsg = message.toLowerCase();
          let emotion = 'normal';
          if (/شکریہ|بہت اچھا|زبردست|thanks|great|awesome/.test(lowerMsg)) emotion = 'happy';
          else if (/مدد|ناممکن|مشکل|help|can't|difficult/.test(lowerMsg)) emotion = 'encouraging';
          else if (/اداس|تنگ|sad|upset|worried|پریشان/.test(lowerMsg)) emotion = 'sympathetic';

          return { success: true, message: responseText.trim(), emotion, method: `${provider}-ipc` };
        }
      } catch (err) {
        log('WARN', `[Chat-IPC] ${provider} error:`, err.message);
        continue;
      }
    }

    return { success: false, message: 'تمام ماڈلز نے جواب دینے سے انکار کر دیا۔ API Key چیک کریں۔', emotion: 'sympathetic', error: 'All providers failed' };
  } catch (err) {
    log('ERROR', '[Chat-IPC] Error:', err.message);
    return { success: false, message: 'چیٹ میں مسئلہ آ گیا۔', emotion: 'sympathetic', error: err.message };
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

  // ─── Auto-update: check on startup after 5s delay ───
  if (app.isPackaged) {
    log('INFO', 'App is packaged — scheduling initial update check in 5 seconds...');
    setTimeout(() => {
      checkForUpdates();
      startPeriodicUpdateCheck();
    }, 5000);
  } else {
    log('INFO', 'App is NOT packaged — skipping auto-update check on startup');
  }
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
