import fs from 'fs';
import path from 'path';
import { app, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import serve from 'electron-serve';
import { createWindow, download } from './helpers';
import Store from 'electron-store';
import sudoPrompt from '@vscode/sudo-prompt';

let strapWindow, mainWindow;
let splashStartTime: number;

const isProd = process.env.NODE_ENV === 'production';
let store: Store<any>;

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

ipcMain.on('openApp', async (_event, _arg) => {
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
    if (isProd) {
      await mainWindow.loadURL('app://./home');
      setTimeout(() => initUpdates(), 3000);
    } else {
      await mainWindow.loadURL(`http://localhost:${port}/home`);
      // Uncomment to simulate update or open devtools if desired
      // setTimeout(() => mainWindow.webContents.send('updateAvailable', {}), 2000);
      // mainWindow.webContents.openDevTools();
    }

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    });
  }, waitTime);
});

ipcMain.on('windowControl', async (_event, arg) => {
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
