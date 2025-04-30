import fs from 'fs';
import path from 'path';
import { app, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import serve from 'electron-serve';
import { createWindow, download } from './helpers';
import Store from 'electron-store';
import sudoPrompt from '@vscode/sudo-prompt';
import { randomBytes } from 'crypto';

let strapWindow, mainWindow;

const isProd = process.env.NODE_ENV === 'production';
let store;

if (isProd) {
  serve({ directory: 'app' });
  store = new Store({ name: 'vatacars' });
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`);
  store = new Store({ name: 'vatacars' });
}

Store.initRenderer();

async function safeLoadURL(pathName: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      await mainWindow.loadURL(`app://./${pathName}`);
    } else {
      const port = process.argv[2];
      await mainWindow.loadURL(`http://localhost:${port}/${pathName}`);
    }
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

  if (isProd) {
    await strapWindow.loadURL('app://./');
  } else {
    const port = process.argv[2];
    await strapWindow.loadURL(`http://localhost:${port}/`);
  }
})();

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.on('openApp', async () => {
  strapWindow.close();
  mainWindow = createWindow('main', {
    width: 1024,
    height: 640,
    center: true,
    resizable: false,
    frame: false,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    const { requestHeaders } = details;
    requestHeaders['Access-Control-Allow-Origin'] = '*';
    callback({ requestHeaders });
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const { responseHeaders } = details;
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Headers'] = ['*'];
    callback({ responseHeaders });
  });

  if (isProd) {
    await mainWindow.loadURL('app://./welcome');
    setTimeout(() => initUpdates(), 3000);
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/welcome`);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
});

ipcMain.on('windowControl', async (_event, arg) => {
  if (!mainWindow) return;
  if (arg === 'minimize') return mainWindow.minimize();
  if (arg === 'maximize') return mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  if (arg === 'close') return mainWindow.close();

  if (arg === 'unrestrictSize') {
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(1024, 640);
  }
});

ipcMain.on('navigate-home', async () => {
  await safeLoadURL('home');
});

ipcMain.on('navigate-to', async (_event, pathToGo: string) => {
  await safeLoadURL(pathToGo);
});

ipcMain.on('storeInteraction', async (event, arg) => {
  if (arg.action === 'set') {
    store.set(arg.setting, arg.property);
  } else if (arg.action === 'get') {
    event.reply('storeInteractionReply', {
      setting: arg.setting,
      property: store.get(arg.setting) || false,
    });
  }
});

ipcMain.on('installUpdate', async () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('restartApp', () => {
  autoUpdater.quitAndInstall();
});

function checkProcess(query: string, cb: (running: boolean) => void) {
  const exec = require('child_process').exec;
  let cmd = '';

  switch (process.platform) {
    case 'win32':
      cmd = 'tasklist';
      break;
    case 'darwin':
      cmd = `ps -ax | grep ${query}`;
      break;
    case 'linux':
      cmd = 'ps -A';
      break;
  }

  exec(cmd, (err, stdout) => {
    cb(stdout.toLowerCase().includes(query.toLowerCase()));
  });
}

ipcMain.on('downloadPlugin', async (event, arg) => {
  const { downloadUrl, version } = arg;

  checkProcess('vatSys.exe', async (running) => {
    if (running) return event.reply('downloadPluginReply', { status: 'running' });

    let vatSysLoc = store.get('vatSysLoc');
    if (!vatSysLoc) {
      if (fs.existsSync('C:\\Program Files (x86)\\vatSys\\bin')) {
        vatSysLoc = 'C:\\Program Files (x86)\\vatSys\\bin';
      } else {
        const result = dialog.showOpenDialogSync({
          title: 'Select your vatSys.exe installation.',
          properties: ['openFile'],
          filters: [{ name: 'vatSys.exe', extensions: ['exe'] }],
        });

        if (!result) return;
        vatSysLoc = result[0].split('\\').slice(0, -1).join('\\');
      }
      store.set('vatSysLoc', vatSysLoc);
    }

    const pluginLoc = path.join(app.getPath('userData'), 'vatACARS.dll');
    await download(downloadUrl, pluginLoc, (bytes, percent) => {
      event.reply('downloadPluginReply', { status: 'downloading', bytes, percent });
    });

    const command = `copy /Y "${pluginLoc}" "${vatSysLoc}\\Plugins\\vatACARS.dll"`;
    await event.reply('downloadPluginReply', { status: 'installing' });

    await runProcessElevated(command).catch(() => {
      return event.reply('downloadPluginReply', { status: 'failed' });
    });

    store.set('pluginInstalledVersion', version);
    event.reply('checkDownloadedPluginReply', { installed: true, version });
    event.reply('downloadPluginReply', { status: 'done' });
  });
});

ipcMain.on('uninstallPlugin', async (event) => {
  checkProcess('vatSys.exe', async (running) => {
    if (running) return event.reply('uninstallPluginReply', { status: 'running' });

    let vatSysLoc = store.get('vatSysLoc');
    if (!vatSysLoc) {
      if (fs.existsSync('C:\\Program Files (x86)\\vatSys\\bin')) {
        vatSysLoc = 'C:\\Program Files (x86)\\vatSys\\bin';
      } else {
        const result = dialog.showOpenDialogSync({
          title: 'Select your vatSys.exe installation.',
          properties: ['openFile'],
          filters: [{ name: 'vatSys.exe', extensions: ['exe'] }],
        });

        if (!result) return;
        vatSysLoc = result[0].split('\\').slice(0, -1).join('\\');
      }
      store.set('vatSysLoc', vatSysLoc);
    }

    const pluginLoc = path.join(vatSysLoc, 'Plugins\\vatACARS.dll');
    const command = `del /Q "${pluginLoc}"`;

    await runProcessElevated(command).catch(() => {
      return event.reply('uninstallPluginReply', { status: 'failed' });
    });

    event.reply('uninstallPluginReply', { status: 'done' });
  });
});

ipcMain.on('checkDownloadedPlugin', async (event) => {
  let vatSysLoc = store.get('vatSysLoc');
  if (!vatSysLoc) return event.reply('checkDownloadedPluginReply', { installed: false });

  const pluginLoc = path.join(vatSysLoc, 'Plugins\\vatACARS.dll');
  const exists = fs.existsSync(pluginLoc);
  const cVer = store.get('pluginInstalledVersion') || '1.0.1';

  event.reply('checkDownloadedPluginReply', { installed: exists, version: exists ? cVer : null });
});

ipcMain.handle('save-plugin-file', async (_event, { filename, data }) => {
  try {
    const savePath = path.join(app.getPath('userData'), filename);
    await fs.promises.writeFile(savePath, new Uint8Array(Buffer.from(data)));
    return { success: true, path: savePath };
  } catch (error) {
    console.error('Failed to save plugin file:', error);
    throw error;
  }
});


function runProcessElevated(command: string) {
  return new Promise<string>((resolve, reject) => {
    sudoPrompt.exec(command, { name: 'Install vatACARS' }, (error, stdout, stderr) => {
      if (stdout) console.log('runProcessElevated', stdout);
      if (stderr) console.log('runProcessElevated', stderr);
      if (error) {
        reject(error);
      } else {
        resolve(stdout.toString());
      }
    });
  });
}