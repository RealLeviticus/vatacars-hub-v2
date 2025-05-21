import fs from 'fs';
import path from 'path';
import { app, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import serve from 'electron-serve';
import { createWindow, download } from './helpers';
import Store from 'electron-store';
import sudoPrompt from '@vscode/sudo-prompt';
import semver from 'semver';
import axios from 'axios';
import { spawnSync } from 'child_process';

const GITHUB_REPO = "vatACARS/vatacars-hub";

// Helper: Extract version from a string (e.g., title/body)
function extractVersionFromString(text: string): string | null {
  // Match patterns like 1.2.3, 1.2, v1.2.3, v1.2, Version 1.2, Release 1.2, etc.
  const match = text.match(/(?:[Vv]ersion|[Rr]elease|[Vv])?\s*\.?\s*(\d+\.\d+(?:\.\d+)?)/);
  if (match && match[1]) {
    // If version is like 1.8, convert to 1.8.0 for semver
    const parts = match[1].split('.');
    if (parts.length === 2) return `${parts[0]}.${parts[1]}.0`;
    return match[1];
  }
  return null;
}

// Helper: Only check for Version.json (or version.json) in plugin directory
function scanPluginVersion(pluginDir: string): string | null {
  // Try lowercase filename first; if not found then try "Version.json"
  let versionJsonPath = path.join(pluginDir, 'version.json');
  if (!fs.existsSync(versionJsonPath)) {
    versionJsonPath = path.join(pluginDir, 'Version.json');
  }
  console.log(`[PluginLog] Checking for version file at: ${versionJsonPath}`);
  if (fs.existsSync(versionJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      console.log(`[PluginLog] Parsed version file:`, data);
      if (typeof data === 'string') return data;
      if (typeof data.version === 'string') return data.version;
      if (typeof data.Major !== 'undefined' && typeof data.Minor !== 'undefined') {
        return `${data.Major}.${data.Minor}`;
      }
    } catch (err) {
      console.warn(`[PluginLog] Failed to parse version file:`, err);
    }
  } else {
    console.log(`[PluginLog] Version file does not exist at: ${versionJsonPath}`);
  }
  return null;
}

// App update check via GitHub releases
async function checkForAppUpdate() {
  try {
    const response = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    const latest = response.data;
    let latestVersion = latest.tag_name;

    // If tag_name is not a valid semver, try to extract from title/body
    if (!semver.valid(latestVersion)) {
      const fromTitle = extractVersionFromString(latest.name || latest.title || "");
      if (fromTitle && semver.valid(fromTitle)) {
        latestVersion = fromTitle;
      } else {
        const fromBody = extractVersionFromString(latest.body || "");
        if (fromBody && semver.valid(fromBody)) {
          latestVersion = fromBody;
        }
      }
    } else if (latestVersion.startsWith('v')) {
      latestVersion = latestVersion.slice(1);
    }

    const currentVersion = app.getVersion();

    return {
      updateAvailable: semver.gt(latestVersion, currentVersion),
      latestVersion,
      currentVersion,
      releaseNotes: latest.body,  // <-- This is the GitHub release description
      downloadUrl: latest.assets?.[0]?.browser_download_url || null,
    };
  } catch (err) {
    console.error("Failed to check for app update:", err);
    return null;
  }
}

// Plugin version check via GitHub releases
async function getPluginRemoteVersion(repo: string): Promise<{ remoteVersion: string | null, downloadUrl: string | null }> {
  try {
    const response = await axios.get(`https://api.github.com/repos/${repo}/releases/latest`);
    const latest = response.data;
    let remoteVersion = latest.tag_name;

    // If tag_name is not a valid semver, try to extract from title/body
    if (!semver.valid(remoteVersion)) {
      const fromTitle = extractVersionFromString(latest.name || latest.title || "");
      if (fromTitle) {
        remoteVersion = fromTitle;
      } else {
        const fromBody = extractVersionFromString(latest.body || "");
        if (fromBody) {
          remoteVersion = fromBody;
        }
      }
    } else if (remoteVersion.startsWith('v')) {
      remoteVersion = remoteVersion.slice(1);
    }

    const downloadUrl = latest.assets?.[0]?.browser_download_url || null;
    return { remoteVersion, downloadUrl };
  } catch (err) {
    console.error("Failed to check plugin update:", err);
    return { remoteVersion: null, downloadUrl: null };
  }
}

let strapWindow, mainWindow;
let splashStartTime: number;

const isProd = process.env.NODE_ENV === 'production';

// Store setup
let store: Store;
if (isProd) {
  serve({ directory: 'app' });
  store = new Store({ name: 'vatacars' });
} else {
  store = new Store({ name: 'vatacars-dev' });
  app.setPath('userData', `${app.getPath('userData')} (development)`);
}

function initUpdates() {
  if (process.platform === 'win32') app.setAppUserModelId(app.name);
  if (!mainWindow) return;

  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('updateAvailable', {});
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('updateProgress', progressObj.percent.toFixed(1));
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('updateComplete', {});
  });

  autoUpdater.checkForUpdates();
}

(async () => {
  await app.whenReady();

  splashStartTime = Date.now();

  strapWindow = createWindow('bootstrapper', {
    width: 460,
    height: 220,
    center: true,
    frame: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const url = isProd ? 'app://./' : `http://localhost:${process.argv[2]}/`;
  await strapWindow.loadURL(url);
})();

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.on('openApp', async () => {
  // Retain splash for at least 5 seconds, then open main window with original size logic
  const splashMinDuration = 5000;
  const elapsed = Date.now() - splashStartTime;
  const waitTime = Math.max(0, splashMinDuration - elapsed);

  setTimeout(async () => {
    if (strapWindow) strapWindow.close();

    // Restore window size logic from original (keep user sizing if possible)
    const hasSavedBounds = store.has('mainWindowBounds');
    const savedBounds = store.get('mainWindowBounds') as Electron.Rectangle;

    mainWindow = createWindow('main', {
      width: savedBounds?.width || 1920,
      height: savedBounds?.height || 1080,
      x: savedBounds?.x,
      y: savedBounds?.y,
      resizable: true,
      frame: false,
      useContentSize: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    if (!hasSavedBounds) {
      mainWindow.maximize();
    }

    // Persist window bounds
    const persistBounds = () => {
      if (mainWindow) {
        store.set('mainWindowBounds', mainWindow.getBounds());
      }
    };
    mainWindow.on('resize', persistBounds);
    mainWindow.on('move', persistBounds);
    mainWindow.on('close', persistBounds);

    // CORS header helpers
    const UpsertKeyValue = (
      header: Record<string, string> | Record<string, string[]>,
      keyToChange: string,
      value: string | string[],
    ) => {
      for (const key of Object.keys(header)) {
        if (key.toLowerCase() === keyToChange.toLowerCase()) {
          header[key] = value;
          return;
        }
      }
      header[keyToChange] = value;
    };

    mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      const { requestHeaders } = details;
      UpsertKeyValue(requestHeaders, 'Access-Control-Allow-Origin', '*');
      callback({ requestHeaders });
    });

    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      const { responseHeaders } = details;
      UpsertKeyValue(responseHeaders, 'Access-Control-Allow-Origin', ['*']);
      UpsertKeyValue(responseHeaders, 'Access-Control-Allow-Headers', ['*']);
      callback({ responseHeaders });
    });

    const port = process.argv[2];
    const url = isProd ? 'app://./home' : `http://localhost:${port}/home`;
    await mainWindow.loadURL(url);

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    });

    if (isProd) {
      setTimeout(() => initUpdates(), 3000);
    }
  }, waitTime);
});

ipcMain.on('windowControl', async (event, arg) => {
  if (arg == 'minimize') return mainWindow.minimize();
  if (arg == 'maximize') return mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  if (arg == 'close') return mainWindow.close();

  if (arg == 'unrestrictSize') {
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(1024, 640);
  }
});

ipcMain.on('storeInteraction', async (event, arg) => {
  if (arg.action == 'set') {
    store.set(arg.setting, arg.property);
  } else if (arg.action == 'get') {
    event.reply('storeInteractionReply', {
      setting: arg.setting,
      property: store.get(arg.setting) || false,
    });
  }
});

ipcMain.on('installUpdate', async (_event, _arg) => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('restartApp', (_event, _arg) => {
  autoUpdater.quitAndInstall();
});

function checkProcess(query, cb) {
  const exec = require('child_process').exec;

  let platform = process.platform;
  let cmd = '';
  switch (platform) {
    case 'win32':
      cmd = `tasklist`;
      break;
    case 'darwin':
      cmd = `ps -ax | grep ${query}`;
      break;
    case 'linux':
      cmd = `ps -A`;
      break;
    default:
      break;
  }
  exec(cmd, (err, stdout, stderr) => {
    cb(stdout.toLowerCase().indexOf(query.toLowerCase()) > -1);
  });
}

// Helper to get vatSys location, always returns a string or null
async function getVatSysLoc(): Promise<string | null> {
  let vatSysLoc = store.get('vatSysLoc') as string;
  if (vatSysLoc && fs.existsSync(vatSysLoc)) return vatSysLoc;

  const defaultPath = 'C:\\Program Files (x86)\\vatSys\\bin';
  if (fs.existsSync(defaultPath)) {
    vatSysLoc = defaultPath;
  } else {
    const result = dialog.showOpenDialogSync({
      title: 'Select your vatSys.exe installation.',
      properties: ['openFile'],
      filters: [{ name: 'vatSys.exe', extensions: ['exe'] }],
    });
    if (!result) return null;
    vatSysLoc = path.dirname(result[0]);
  }
  store.set('vatSysLoc', vatSysLoc);
  return vatSysLoc;
}

// Helper to run a command with elevation using PowerShell Start-Process -Verb RunAs, hidden window
function runProcessElevated(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sudoPrompt.exec(command, { name: 'vatACARS' }, (error, stdout, stderr) => {
      if (stdout) {
        console.log('runProcessElevated', stdout);
      }
      if (stderr) {
        console.log('runProcessElevated', stderr);
      }
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// Helper: Extract version from a DLL file (Windows only)
function getDllVersion(dllPath: string): string | null {
  const psScript = `(Get-Item "${dllPath}").VersionInfo.FileVersion`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout) {
    const version = result.stdout.trim();
    return /^\d+\.\d+\.\d+(\.\d+)?$/.test(version) ? version : null;
  }
  return null;
}

// Helper: Extract OzStrips version from OzStrips.dll.config
function getOzStripsVersion(pluginDir: string): string | null {
  const configPath = path.join(pluginDir, 'OzStrips.dll.config');
  if (!fs.existsSync(configPath)) return null;
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    // Looks for patterns like 1.2.3 or v1.2.3
    const match = content.match(/v?(\d+\.\d+\.\d+([a-zA-Z0-9\-\.]*)?)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Helper: Try to extract version from a file's contents
function extractVersionFromText(text: string): string | null {
  // Looks for patterns like 1.2.3 or v1.2.3
  const match = text.match(/v?(\d+\.\d+\.\d+([a-zA-Z0-9\-\.]*)?)/);
  return match ? match[1] : null;
}

// Install or update plugin
ipcMain.on('downloadPlugin', async (event, arg) => {
  const { pluginName, downloadUrl, version, extract, pluginType = 'dll' } = arg;

  if (!pluginName || !downloadUrl) {
    return event.reply('downloadPluginReply', {
      pluginName,
      status: 'not-available',
      error: 'Missing pluginName or downloadUrl',
    });
  }

  checkProcess('vatSys.exe', async (running) => {
    if (running) {
      return event.reply('downloadPluginReply', { pluginName, status: 'running' });
    }

    const vatSysLoc = await getVatSysLoc();
    if (!vatSysLoc) {
      return event.reply('downloadPluginReply', { pluginName, status: 'not-available', error: 'vatSys location not set' });
    }

    const pluginsDir = path.join(vatSysLoc, 'Plugins');
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });

    const tempFile = path.join(app.getPath('userData'), `${pluginName}.${pluginType}`);
    const finalPath = extract ? path.join(pluginsDir, pluginName) : path.join(pluginsDir, `${pluginName}.dll`);

    try {
      await download(downloadUrl, tempFile, (bytes, percent) => {
        event.reply('downloadPluginReply', { pluginName, status: 'downloading', bytes, percent });
      });

      event.reply('downloadPluginReply', { pluginName, status: 'installing' });

      const command = extract
        ? `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${tempFile}' -DestinationPath '${finalPath}' -Force"`
        : `copy /Y "${tempFile}" "${finalPath}"`;

      await runProcessElevated(command);

      const pluginExists = fs.existsSync(finalPath);

      // Save the version from the release for reference
      store.set(`plugin_${pluginName}_version`, version);

      // Write install log
      const installLogDir = app.getPath('userData');
      fs.writeFileSync(
        path.join(installLogDir, `${pluginName}.installed_version.txt`),
        `Installed version: ${version}\nInstalled at: ${new Date().toISOString()}\n`
      );

      event.reply('downloadPluginReply', {
        pluginName,
        status: pluginExists ? 'done' : 'failed',
        error: pluginExists ? undefined : 'Plugin did not appear after install.',
      });
    } catch (error) {
      console.error("Plugin install failed:", error);
      event.reply('downloadPluginReply', {
        pluginName,
        status: 'failed',
        error: error.message || String(error),
      });
    } finally {
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch (cleanupErr) {
          console.warn(`Failed to remove temp file: ${tempFile}`, cleanupErr);
        }
      }
    }
  });
});

// Uninstall plugin
ipcMain.on('uninstallPlugin', async (event, arg) => {
  const pluginName = arg?.pluginName || 'vatACARS';
  const pluginType = arg?.pluginType || 'dll';
  const extract = arg?.extract || false;

  checkProcess('vatSys.exe', async (running) => {
    if (running) {
      return event.reply('uninstallPluginReply', { pluginName, status: 'running' });
    }

    const vatSysLoc = await getVatSysLoc();
    if (!vatSysLoc) {
      return event.reply('uninstallPluginReply', { pluginName, status: 'not-available', error: 'vatSys location not set' });
    }

    const pluginsDir = path.join(vatSysLoc, 'Plugins');
    const pluginPath = path.join(pluginsDir, `${pluginName}.${pluginType}`);
    const extractPath = path.join(pluginsDir, pluginName);

    try {
      if (fs.existsSync(pluginPath)) {
        const removeCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -LiteralPath '${pluginPath}' -Force"`;
        await runProcessElevated(removeCommand);
      }

      if (extract && fs.existsSync(extractPath)) {
        const removeDirCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Path '${extractPath}' -Recurse -Force"`;
        await runProcessElevated(removeDirCommand);
      }

      const pluginStillExists = fs.existsSync(pluginPath) || (extract && fs.existsSync(extractPath));
      event.reply('uninstallPluginReply', {
        pluginName,
        status: pluginStillExists ? 'failed' : 'done',
        error: pluginStillExists ? 'Plugin still exists after uninstall attempt.' : undefined,
      });
    } catch (error) {
      console.error("Plugin uninstall failed:", error);
      event.reply('uninstallPluginReply', { pluginName, status: 'failed', error: error.message || String(error) });
    }
  });
});

// Helper: Check plugin status
ipcMain.on('checkDownloadedPlugin', async (event, arg) => {
  const pluginName = arg?.pluginName || 'vatACARS';
  const pluginType = arg?.pluginType || 'dll';
  const remoteVersion = arg?.remoteVersion || null;

  const vatSysLoc = await getVatSysLoc();
  if (!vatSysLoc) {
    return event.reply('checkDownloadedPluginReply', { pluginName, installed: false, status: 'not-available' });
  }

  const pluginsDir = path.join(vatSysLoc, 'Plugins');
  const pluginLoc = path.join(pluginsDir, `${pluginName}.${pluginType}`);
  const extractDir = path.join(pluginsDir, pluginName);
  let exists = fs.existsSync(pluginLoc) || fs.existsSync(extractDir);
  let installedVersion = null;

  if (fs.existsSync(extractDir)) {
    // For extracted plugins, use ONLY the version file
    installedVersion = scanPluginVersion(extractDir);
    console.log(`[PluginLog] scanPluginVersion result for ${pluginName}:`, installedVersion);
  } else if (fs.existsSync(pluginLoc)) {
    // For DLL plugins, check the install log
    const installLogDir = app.getPath('userData');
    const logFile = path.join(installLogDir, `${pluginName}.installed_version.txt`);
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      const match = content.match(/Installed version:\s*([^\n]+)/i);
      if (match) installedVersion = match[1].trim();
      console.log(`[PluginLog] Read installed version from log for ${pluginName}:`, installedVersion);
    }
  }

  // For extracted plugins, DO NOT fallback to store (to avoid "latest")
  if (!installedVersion && pluginType !== 'zip') {
    installedVersion = store.get(`plugin_${pluginName}_version`) || null;
    console.log(`[PluginLog] Fallback to store for ${pluginName}:`, installedVersion);
  }

  const updateAvailable = remoteVersion && installedVersion && semver.valid(remoteVersion) && semver.valid(installedVersion)
    ? semver.gt(remoteVersion, installedVersion)
    : false;

  event.reply('checkDownloadedPluginReply', {
    pluginName,
    installed: exists,
    installedVersion,
    remoteVersion,
    updateAvailable,
    status: exists ? 'available' : 'not-available'
  });
});

ipcMain.on('readInstalledVersion', (event, arg) => {
  const { pluginName } = arg;
  const installLogDir = app.getPath('userData');
  const logFile = path.join(installLogDir, `${pluginName}.installed_version.txt`);
  let installedVersion: string | null = null;
  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const match = content.match(/Installed version:\s*([^\n]+)/i);
    if (match) installedVersion = match[1].trim();
  }
  event.reply('readInstalledVersionReply', { pluginName, installedVersion });
});

ipcMain.handle('checkAppUpdate', async () => {
  const updateInfo = await checkForAppUpdate();
  // updateInfo.releaseNotes contains the GitHub release description (change log)
  return updateInfo;
});

ipcMain.handle('downloadAndInstallAppUpdate', async (_event, downloadUrl) => {
  const tmpPath = path.join(app.getPath('temp'), path.basename(downloadUrl));
  const writer = fs.createWriteStream(tmpPath);

  const response = await axios({
    url: downloadUrl,
    method: 'GET',
    responseType: 'stream'
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      require('child_process').spawn(tmpPath, [], { detached: true, stdio: 'ignore' }).unref();
      app.quit();
      resolve(true);
    });
    writer.on('error', reject);
  });
});

ipcMain.on('saveAndClose', () => {
  if (mainWindow) {
    store.set('mainWindowBounds', mainWindow.getBounds());
    mainWindow.close();
  }
});
