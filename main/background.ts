import fs from 'fs';
import path from 'path';
import { app, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import serve from 'electron-serve';
import { createWindow, download } from './helpers';
import Store from 'electron-store';
import sudoPrompt from '@vscode/sudo-prompt';
import semver from 'semver';
import { spawnSync } from 'child_process';

let strapWindow, mainWindow;
let splashStartTime: number;

const isProd = process.env.NODE_ENV === 'production';
const store = new Store({ name: isProd ? 'vatacars' : 'vatacars-dev' });

if (!isProd) {
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
  const splashMinDuration = 5000;
  const elapsed = Date.now() - splashStartTime;
  const waitTime = Math.max(0, splashMinDuration - elapsed);

  setTimeout(async () => {
    if (strapWindow) strapWindow.close();

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

    const persistBounds = () => {
      if (mainWindow) {
        store.set('mainWindowBounds', mainWindow.getBounds());
      }
    };
    mainWindow.on('resize', persistBounds);
    mainWindow.on('move', persistBounds);
    mainWindow.on('close', persistBounds);

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
      if (error) {
        console.error('Elevated command error:', stderr || error);
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

// Helper: Scan plugin directory for version (now only uses config or version.json)
function scanPluginVersion(pluginDir: string, pluginName: string): string | null {
  // 1. Check for version.json
  const versionJsonPath = path.join(pluginDir, 'version.json');
  if (fs.existsSync(versionJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      return typeof data === 'string' ? data : data.version || null;
    } catch { }
  }

  // 2. For OzStrips, check .config file only
  if (pluginName === 'OzStrips') {
    const ozVersion = getOzStripsVersion(pluginDir);
    if (ozVersion) return ozVersion;
  }

  // 3. Optionally, scan all files for version-like strings in text files (not DLLs)
  if (fs.existsSync(pluginDir) && fs.lstatSync(pluginDir).isDirectory()) {
    const files = fs.readdirSync(pluginDir);
    for (const file of files) {
      const filePath = path.join(pluginDir, file);
      if (fs.lstatSync(filePath).isFile() && file.endsWith('.config')) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const found = extractVersionFromText(content);
          if (found) return found;
        } catch { }
      }
    }
  }
  return null;
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

      // Always log the version we tried to install, even if the plugin doesn't report it
      store.set(`plugin_${pluginName}_version`, version);

      // Write install log to app's user data directory instead of Plugins directory
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

      if (extract && fs.existsSync(path.join(pluginsDir, pluginName))) {
        const removeDirCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Path '${path.join(pluginsDir, pluginName)}' -Recurse -Force"`;
        await runProcessElevated(removeDirCommand);
      }

      const pluginStillExists = fs.existsSync(pluginPath) || (extract && fs.existsSync(path.join(pluginsDir, pluginName)));

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
  const remoteVersion = arg?.remoteVersion || null; // Pass this from your UI if available

  const vatSysLoc = await getVatSysLoc();
  if (!vatSysLoc) {
    return event.reply('checkDownloadedPluginReply', { pluginName, installed: false, status: 'not-available' });
  }

  const pluginsDir = path.join(vatSysLoc, 'Plugins');
  const pluginLoc = path.join(pluginsDir, `${pluginName}.${pluginType}`);
  const extractDir = path.join(pluginsDir, pluginName);
  let exists = fs.existsSync(pluginLoc) || fs.existsSync(extractDir);
  let installedVersion = null;

  // Only use scanPluginVersion (which now only uses .config or version.json)
  if (fs.existsSync(extractDir)) {
    exists = true;
    installedVersion = scanPluginVersion(extractDir, pluginName);
  } else if (fs.existsSync(pluginLoc)) {
    installedVersion = scanPluginVersion(pluginsDir, pluginName);
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

// Update plugin (only if remote version is newer)
ipcMain.on('updatePlugin', async (event, arg) => {
  const { pluginName, downloadUrl, version, extract, pluginType = 'dll' } = arg;
  if (!pluginName || !downloadUrl || !version) {
    return event.reply('updatePluginReply', {
      pluginName,
      status: 'not-available',
      error: 'Missing pluginName, downloadUrl, or version',
    });
  }

  checkProcess('vatSys.exe', async (running) => {
    if (running) {
      return event.reply('updatePluginReply', { pluginName, status: 'running' });
    }

    const vatSysLoc = await getVatSysLoc();
    if (!vatSysLoc) {
      return event.reply('updatePluginReply', { pluginName, status: 'not-available', error: 'vatSys location not set' });
    }

    const pluginsDir = path.join(vatSysLoc, 'Plugins');
    const pluginDir = extract ? path.join(pluginsDir, pluginName) : pluginsDir;
    let currentVersion = null;

    if (extract && fs.existsSync(pluginDir)) {
      currentVersion = scanPluginVersion(pluginDir, pluginName);
    } else if (!extract) {
      const dllPath = path.join(pluginsDir, `${pluginName}.dll`);
      currentVersion = getDllVersion(dllPath) || store.get(`plugin_${pluginName}_version`);
    }

    if (currentVersion && semver.valid(version) && semver.valid(currentVersion)) {
      if (semver.gte(currentVersion, version)) {
        return event.reply('updatePluginReply', {
          pluginName,
          status: 'up-to-date',
          currentVersion,
          remoteVersion: version,
        });
      }
    }

    const tempFile = path.join(app.getPath('userData'), `${pluginName}.${pluginType}`);
    const finalPath = extract ? path.join(pluginsDir, pluginName) : path.join(pluginsDir, `${pluginName}.dll`);

    try {
      await download(downloadUrl, tempFile, (bytes, percent) => {
        event.reply('updatePluginReply', { pluginName, status: 'downloading', bytes, percent });
      });

      event.reply('updatePluginReply', { pluginName, status: 'installing' });

      const command = extract
        ? `Expand-Archive -Path "${tempFile}" -DestinationPath "${finalPath}" -Force`
        : `Copy-Item -Path "${tempFile}" -Destination "${finalPath}" -Force`;

      await runProcessElevated(`powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process powershell -ArgumentList '${command}' -Verb RunAs -WindowStyle Hidden -Wait"`);

      const pluginExists = fs.existsSync(finalPath);
      store.set(`plugin_${pluginName}_version`, version);

      event.reply('updatePluginReply', {
        pluginName,
        status: pluginExists ? 'updated' : 'failed',
        error: pluginExists ? undefined : 'Plugin did not appear after update.',
        currentVersion: version,
        remoteVersion: version,
      });
    } catch (error) {
      console.error("Plugin update failed:", error);
      event.reply('updatePluginReply', {
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