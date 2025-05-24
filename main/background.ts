import fs from 'fs';
import path from 'path';
import { app, ipcMain, dialog, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import serve from 'electron-serve';
import { createWindow, download } from './helpers';
import Store from 'electron-store';
import sudoPrompt from '@vscode/sudo-prompt';
import semver from 'semver';
import { spawnSync } from 'child_process';
import axios from 'axios'; // Add to your dependencies if not present

const GITHUB_REPO = "vatACARS/hub"; // Change to your repo

// Helper: Extracts a semver version from a string (e.g., "Release v1.2.3" => "1.2.3")
function extractVersionFromString(input: string): string | null {
  const match = input.match(/\b\d+\.\d+\.\d+(-[A-Za-z0-9-.]+)?\b/);
  return match ? match[0] : null;
}

// Helper: Write version.json if missing and version is valid
function ensureVersionJson(dir: string, version: string | null) {
  const versionJsonPath = path.join(dir, 'version.json');
  if (!fs.existsSync(versionJsonPath) && version && semver.valid(version)) {
    fs.writeFileSync(versionJsonPath, JSON.stringify({ version }, null, 2), 'utf8');
  }
}

// Helper: Write version.json if missing or if scanPluginVersion returns null and version is valid
function ensureVersionJsonOverwriteIfNull(dir: string, version: string | null) {
  const versionJsonPath = path.join(dir, 'version.json');
  let shouldWrite = false;
  if (!fs.existsSync(versionJsonPath)) {
    shouldWrite = true;
  } else {
    // If version.json exists but scanPluginVersion returns null, overwrite it
    if (scanPluginVersion(dir, "") === null) {
      shouldWrite = true;
    }
  }
  if (shouldWrite && version && semver.valid(version)) {
    fs.writeFileSync(versionJsonPath, JSON.stringify({ version }, null, 2), 'utf8');
  }
}

async function checkForAppUpdate() {
  try {
    const response = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/releases`);
    const releases = response.data;

    // Find the latest valid semver release, including pre-releases
    let latestRelease = releases
      .map(release => {
        let version = release.tag_name.startsWith('v') ? release.tag_name.slice(1) : release.tag_name;
        if (!semver.valid(version)) {
          const fallback = extractVersionFromString(release.name || release.title || release.body || '');
          if (semver.valid(fallback)) version = fallback;
        }
        return { ...release, semverVersion: version };
      })
      .filter(r => semver.valid(r.semverVersion))
      .sort((a, b) => semver.rcompare(a.semverVersion, b.semverVersion))[0]; // reverse compare: newest first

    if (!latestRelease) throw new Error("No valid releases found");

    const latestVersion = latestRelease.semverVersion;
    const currentVersion = app.getVersion();
    const updateAvailable = semver.gt(latestVersion, currentVersion, { includePrerelease: true });

    console.log(`[UpdateCheck] Current: ${currentVersion}, Latest: ${latestVersion}, Update Available: ${updateAvailable}`);

    return {
      updateAvailable,
      latestVersion,
      currentVersion,
      releaseNotes: latestRelease.body,
      downloadUrl: latestRelease.assets?.[0]?.browser_download_url || null,
    };
  } catch (err) {
    console.error("Failed to check for app update:", err);
    return null;
  }
}


let strapWindow, mainWindow;
let splashStartTime: number;

const isProd = process.env.NODE_ENV === 'production';

// Correct store naming and userData path depending on environment
let store: Store;
if (isProd) {
  serve({ directory: 'app' });
  store = new Store({ name: 'vatacars' });
} else {
  store = new Store({ name: 'vatacars-dev' });
  app.setPath('userData', `${app.getPath('userData')} (development)`);
}

function saveWindowBounds() {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    store.set('mainWindowBounds', bounds);
  }
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
  saveWindowBounds();
  app.quit();
});

ipcMain.on('openApp', async () => {
  // Retain splash for at least 5 seconds, then open main window with original size logic
  const splashMinDuration = 5000;
  const elapsed = Date.now() - splashStartTime;
  const waitTime = Math.max(0, splashMinDuration - elapsed);

  setTimeout(async () => {
    if (strapWindow) strapWindow.close();

    // Always use saved window bounds if available, otherwise center on main monitor
    const hasSavedBounds = store.has('mainWindowBounds');
    const savedBounds = store.get('mainWindowBounds') as Electron.Rectangle;

    let mainWindowOptions: Electron.BrowserWindowConstructorOptions = {
      width: savedBounds?.width || 1920,
      height: savedBounds?.height || 1080,
      resizable: true,
      frame: false,
      useContentSize: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    };

    if (hasSavedBounds && savedBounds) {
      mainWindowOptions = {
        ...mainWindowOptions,
        x: savedBounds.x,
        y: savedBounds.y,
      };
    } else {
      // Center on main monitor if no saved bounds
      const { screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      mainWindowOptions.x = Math.floor(primaryDisplay.bounds.x + (primaryDisplay.workAreaSize.width - mainWindowOptions.width) / 2);
      mainWindowOptions.y = Math.floor(primaryDisplay.bounds.y + (primaryDisplay.workAreaSize.height - mainWindowOptions.height) / 2);
    }

    mainWindow = createWindow('main', mainWindowOptions);

    // Do not maximize if no saved bounds; just center
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

    // Periodically check for updates (every 4 hours)
    if (isProd) {
      setTimeout(() => initUpdates(), 3000);  // Initial check after startup

      // Add periodic checks
      setInterval(async () => {
        console.log("Running periodic update check...");
        const updateInfo = await checkForAppUpdate();
        if (updateInfo?.updateAvailable) {
          mainWindow.webContents.send('updatePrompt', updateInfo);
        }
      }, 4 * 60 * 60 * 1000); // Check every 4 hours
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

ipcMain.on('saveAndClose', () => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    store.set('mainWindowBounds', bounds);
  }
  app.quit();
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

// Helper: Scan plugin directory for version (now only uses version.json)
function scanPluginVersion(pluginDir: string, pluginName: string): string | null {
  const versionJsonPath = path.join(pluginDir, 'version.json');
  if (fs.existsSync(versionJsonPath)) {
    try {
      const rawData = fs.readFileSync(versionJsonPath, 'utf8');
      console.log(`[Debug] Raw version.json content for ${pluginName}:`, rawData);

      // Sanitize the content by removing invalid characters
      const sanitizedData = rawData.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
      console.log(`[Debug] Sanitized version.json content for ${pluginName}:`, sanitizedData);

      const data = JSON.parse(sanitizedData);
      console.log(`[Debug] Parsed version.json for ${pluginName}:`, data);

      // Accept { "Major": x, "Minor": y, "Patch": z }
      if (typeof data.Major === 'number' && typeof data.Minor === 'number') {
        if (typeof data.Patch === 'number') {
          return `${data.Major}.${data.Minor}.${data.Patch}`;
        } else {
          return `${data.Major}.${data.Minor}`;
        }
      }

      // Accept { "version": "x.y.z" }
      if (typeof data.version === 'string') {
        return data.version;
      }

      // Accept just a string
      if (typeof data === 'string') {
        return data;
      }

      console.warn(`[Debug] version.json for ${pluginName} does not contain a valid version format.`);
    } catch (error) {
      console.error(`[Error] Failed to parse version.json for ${pluginName}:`, error);
    }
  } else {
    console.warn(`[Debug] version.json not found for ${pluginName} in ${pluginDir}`);
  }
  return null;
}

// Install or update plugin
ipcMain.on('downloadPlugin', async (event, arg) => {
  const { pluginName, downloadUrl, version, extract, pluginType = 'dll', releaseTitle, releaseBody } = arg;

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

      // Determine version to use for version.json
      let versionToWrite = null;
      if (semver.valid(version)) {
        versionToWrite = version;
      } else if (releaseTitle && semver.valid(extractVersionFromString(releaseTitle))) {
        versionToWrite = extractVersionFromString(releaseTitle);
      } else if (releaseBody && semver.valid(extractVersionFromString(releaseBody))) {
        versionToWrite = extractVersionFromString(releaseBody);
      }

      if (extract) {
        // Remove existing plugin folder if present
        if (fs.existsSync(finalPath)) {
          const removeDirCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Path '${finalPath}' -Recurse -Force"`;
          await runProcessElevated(removeDirCommand);
        }

        // Move the folder directly from the .zip to the final plugin directory
        await moveFolderFromZip(tempFile, finalPath);
      } else {
        // For DLL plugins, create a temp folder, put DLL and version.json, then move
        const tmpDllDir = path.join(app.getPath('userData'), `${pluginName}_tmp_dll`);
        if (fs.existsSync(tmpDllDir)) fs.rmSync(tmpDllDir, { recursive: true, force: true });
        fs.mkdirSync(tmpDllDir, { recursive: true });
        // Move DLL into temp dir
        const dllDest = path.join(tmpDllDir, `${pluginName}.dll`);
        fs.copyFileSync(tempFile, dllDest);
        // Ensure version.json exists
        ensureVersionJsonOverwriteIfNull(tmpDllDir, versionToWrite);

        // Move DLL and version.json to plugins dir (elevated)
        const moveDllCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item -Path '${dllDest}' -Destination '${finalPath}' -Force"`;
        await runProcessElevated(moveDllCommand);

        // Also copy version.json
        const versionJsonPath = path.join(tmpDllDir, 'version.json');
        if (fs.existsSync(versionJsonPath)) {
          const versionJsonDest = path.join(pluginsDir, 'version.json');
          const moveVersionJsonCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item -Path '${versionJsonPath}' -Destination '${versionJsonDest}' -Force"`;
          await runProcessElevated(moveVersionJsonCommand);
        }

        // Clean up temp dll dir
        if (fs.existsSync(tmpDllDir)) {
          try { fs.rmSync(tmpDllDir, { recursive: true, force: true }); } catch { }
        }
      }

      const pluginExists = fs.existsSync(finalPath);

      // Always log the version we tried to install, even if the plugin doesn't report it
      store.set(`plugin_${pluginName}_version`, version);

      // Write install log to app's user data directory instead of Plugins directory
      const installLogDir = app.getPath('userData');

      // Read version from version.json in the plugin directory (after move)
      let installedVersion: string | null = null;
      if (extract && fs.existsSync(finalPath)) {
        installedVersion = scanPluginVersion(finalPath, pluginName);
      } else if (!extract && fs.existsSync(finalPath)) {
        // For DLL, version.json is in Plugins folder
        installedVersion = scanPluginVersion(path.dirname(finalPath), pluginName);
      }

      fs.writeFileSync(
        path.join(installLogDir, `${pluginName}.installed_version.txt`),
        `Installed version: ${installedVersion ?? version}\nInstalled at: ${new Date().toISOString()}\n`
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
  const remoteVersion = arg?.remoteVersion || null;

  const vatSysLoc = await getVatSysLoc();
  if (!vatSysLoc) {
    return event.reply('checkDownloadedPluginReply', { pluginName, installed: false, status: 'not-available' });
  }

  const pluginsDir = path.join(vatSysLoc, 'Plugins');
  const pluginLoc = path.join(pluginsDir, `${pluginName}.${pluginType}`);
  const extractDir = path.join(pluginsDir, pluginName);

  let exists = false;
  let installedVersion = null;

  if (fs.existsSync(extractDir)) {
    exists = true;
    installedVersion = scanPluginVersion(extractDir, pluginName);
  } else if (fs.existsSync(pluginLoc)) {
    exists = true;
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
    status: exists ? 'available' : 'not-available',
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

ipcMain.handle('checkAppUpdate', async () => {
  return await checkForAppUpdate();
});

// Add progress support in downloadAndInstallAppUpdate
ipcMain.handle('downloadAndInstallAppUpdate', async (_event, downloadUrl) => {
  const tmpPath = path.join(app.getPath('temp'), path.basename(downloadUrl));
  const writer = fs.createWriteStream(tmpPath);

  const response = await axios({
    url: downloadUrl,
    method: 'GET',
    responseType: 'stream',
  });

  const totalLength = parseInt(response.headers['content-length'], 10);
  let downloaded = 0;

  response.data.on('data', chunk => {
    downloaded += chunk.length;
    const percent = (downloaded / totalLength) * 100;
    BrowserWindow.getAllWindows()[0]?.webContents.send('updateProgress', { percent });

  });

  // Wait for stream to fully finish before spawning installer
  return new Promise((resolve, reject) => {
    response.data.pipe(writer);

    writer.on('error', reject);

    writer.on('finish', () => {
      // Give the system a tiny delay to flush filesystem buffers (optional but helps)
      setTimeout(() => {
        try {
          require('child_process').spawn(tmpPath, [], {
            detached: true,
            stdio: 'ignore'
          }).unref();
          app.quit(); // Quit the app cleanly
          resolve(true);
        } catch (spawnErr) {
          reject(spawnErr);
        }
      }, 100); // small delay to avoid EBUSY
    });
  });
});

ipcMain.handle('readInstalledVersion', (event, arg) => {
  const { pluginName } = arg;
  const installLogDir = app.getPath('userData');
  const logFile = path.join(installLogDir, `${pluginName}.installed_version.txt`);
  let installedVersion: string | null = null;

  if (fs.existsSync(logFile)) {
    const content = fs.readFileSync(logFile, 'utf8');
    const match = content.match(/Installed version:\s*([^\n]+)/i);
    if (match) installedVersion = match[1].trim();
  }

  return { pluginName, installedVersion };
});

ipcMain.handle('setSeenVersion', async (_event, version: string) => {
  const file = path.join(app.getPath('userData'), 'last_seen_version.txt');
  fs.writeFileSync(file, version, 'utf8');
  return true;
});

ipcMain.handle('getSeenVersion', async () => {
  const file = path.join(app.getPath('userData'), 'last_seen_version.txt');
  if (fs.existsSync(file)) {
    return fs.readFileSync(file, 'utf8');
  }
  return null;
});

ipcMain.handle('getAppVersion', () => {
  return app.getVersion();
});

// Helper: Move files from a temporary directory to the final plugin directory with elevated permissions
async function moveFilesToFinalLocation(tempDir: string, finalDir: string): Promise<void> {
  const moveCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Move-Item -Path '${tempDir}\\*' -Destination '${finalDir}' -Force"`;
  await runProcessElevated(moveCommand);
}

// Helper: Move extracted files to the final plugin directory, ensuring no nested folders
async function moveExtractedFilesToFinalDir(tempDir: string, finalDir: string): Promise<void> {
  const files = fs.readdirSync(tempDir, { withFileTypes: true });

  // If there's only one folder inside the temp directory, check its contents
  if (files.length === 1 && files[0].isDirectory()) {
    const nestedDir = path.join(tempDir, files[0].name);
    const nestedFiles = fs.readdirSync(nestedDir, { withFileTypes: true });

    // Ensure the nested folder contains the expected files (.dll and version.json)
    const hasDll = nestedFiles.some(file => file.name.endsWith('.dll'));
    const hasVersionJson = nestedFiles.some(file => file.name === 'version.json');

    if (hasDll && hasVersionJson) {
      // Move the contents of the nested folder to the final directory
      for (const file of nestedFiles) {
        const sourcePath = path.join(nestedDir, file.name);
        const targetPath = path.join(finalDir, file.name);
        const moveCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Move-Item -Path '${sourcePath}' -Destination '${targetPath}' -Force"`;
        await runProcessElevated(moveCommand);
      }
    } else {
      throw new Error("The extracted folder does not contain the required .dll and version.json files.");
    }
  } else {
    // If no nested folder, ensure the temp directory itself contains the expected files
    const hasDll = files.some(file => file.name.endsWith('.dll'));
    const hasVersionJson = files.some(file => file.name === 'version.json');

    if (hasDll && hasVersionJson) {
      // Move all files from the temp directory to the final directory
      for (const file of files) {
        const sourcePath = path.join(tempDir, file.name);
        const targetPath = path.join(finalDir, file.name);
        const moveCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Move-Item -Path '${sourcePath}' -Destination '${targetPath}' -Force"`;
        await runProcessElevated(moveCommand);
      }
    } else {
      throw new Error("The extracted folder does not contain the required .dll and version.json files.");
    }
  }
}

// Helper: Find the folder containing the required files (.dll and version.json)
function findPluginFolder(dir: string): string | null {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  // Check if the current directory contains the required files
  const hasDll = files.some(file => file.isFile() && file.name.endsWith('.dll'));
  const hasVersionJson = files.some(file => file.isFile() && file.name === 'version.json');
  if (hasDll && hasVersionJson) {
    return dir;
  }

  // Recursively search subdirectories
  for (const file of files) {
    if (file.isDirectory()) {
      const nestedDir = path.join(dir, file.name);
      const pluginFolder = findPluginFolder(nestedDir);
      if (pluginFolder) {
        return pluginFolder;
      }
    }
  }

  // Fallback: If no folder is found, check if the current directory itself contains the required files
  if (hasDll || hasVersionJson) {
    console.warn(`Warning: Found partial match in ${dir}. Proceeding with this directory.`);
    return dir;
  }

  return null;
}

// Helper: Move the folder directly from the .zip to the final plugin directory
async function moveFolderFromZip(zipPath: string, finalDir: string): Promise<void> {
  // Ensure the final directory exists
  if (!fs.existsSync(finalDir)) {
    const createDirCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "New-Item -ItemType Directory -Path '${finalDir}'"`;
    await runProcessElevated(createDirCommand);
  }

  // Extract the entire .zip to a temporary directory first
  const tempExtractDir = path.join(app.getPath('temp'), `${path.basename(zipPath, '.zip')}_extract`);
  if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
  const extractCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtractDir}' -Force"`;
  await runProcessElevated(extractCommand);

  // Find the folder containing the required files
  const pluginFolder = findPluginFolder(tempExtractDir);
  if (!pluginFolder) {
    console.error(`Debug: Extracted files in ${tempExtractDir}:`, fs.readdirSync(tempExtractDir, { withFileTypes: true }));
    throw new Error("No folder containing both .dll and version.json was found in the extracted .zip.");
  }

  // Move the contents of the identified folder to the final directory
  const pluginFiles = fs.readdirSync(pluginFolder);
  for (const file of pluginFiles) {
    const sourcePath = path.join(pluginFolder, file);
    const targetPath = path.join(finalDir, file);
    const moveCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Move-Item -Path '${sourcePath}' -Destination '${targetPath}' -Force"`;
    await runProcessElevated(moveCommand);
  }

  // Clean up the temporary extraction directory
  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }
}

