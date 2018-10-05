const electron = require('electron');
const {app, BrowserWindow, dialog, ipcMain} = electron;
const {autoUpdater} = require('electron-updater');
const isDev = require('electron-is-dev');

let mainWindow;
let hangameLoginWindow;

/* Single instance check */
const isSecondInstance = app.makeSingleInstance(() => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
if (isSecondInstance) {
  app.exit();
}

/* Automatic updates */
autoUpdater.autoDownload = false;

autoUpdater.on('error', (event, error) => {
  dialog.showErrorBox('Update error', error.toString());
  app.exit();
});

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type   : 'info',
    title  : 'Update available',
    message: 'A new version is available.\nWould you like to download and install it now?',
    buttons: ['Yes', 'No']
  }, (buttonIndex) => {
    if (buttonIndex === 0) {
      autoUpdater.downloadUpdate();
      createWindow(true);
    } else {
      createWindow();
    }
  });
});

autoUpdater.on('update-not-available', () => {
  createWindow();
});

autoUpdater.on('update-downloaded', () => {
  setImmediate(() => autoUpdater.quitAndInstall());
});

autoUpdater.on('download-progress', (progress) => {
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progress);
  }
});

/* App */
const createWindow = (updaterWindow = false) => {
  const {width, height} = electron.screen.getPrimaryDisplay().size;
  const windowWidth = Math.floor(width / 3.2);
  const windowHeight = Math.floor(windowWidth / 1.9);

  mainWindow = new BrowserWindow({
    title: 'Soulworker Launcher',
    icon : 'app/images/icon.ico',

    width : windowWidth,
    height: windowHeight,

    center     : true,
    resizable  : false,
    movable    : false,
    frame      : false,
    transparent: true,
    alwaysOnTop: true,

    show: false
  });

  mainWindow.loadURL(`file://${__dirname}/${updaterWindow ? 'updater.html' : 'launcher.html'}`);
  // mainWindow.toggleDevTools();

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.exit();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validateURL, isMainFrame) => {
    dialog.showMessageBox(mainWindow, {
      type   : 'error',
      buttons: [],
      title  : 'Soulworker Launcher - Connection error',
      message: errorCode.toString() + '\n' + errorDescription,
    });

    app.exit();
  });
};

app.on('ready', () => {
  if (!isDev) {
    autoUpdater.checkForUpdates();
  } else {
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/* Hangame login */
function showHangameLogin(event, skipDialog) {
  hangameLoginWindow = new BrowserWindow({
    title: 'Soulworker Launcher',
    icon : 'app/images/icon.ico',

    width : 800,
    height: 600,

    resizable: true,
    movable  : true,
    modal    : true,
    parent   : mainWindow,

    show: false
  });

  hangameLoginWindow.loadURL('http://top.hangame.co.jp/logout/');
  hangameLoginWindow.setMenuBarVisibility(false);

  hangameLoginWindow.once('close', (e) => {
    hangameLoginWindow.webContents.session.cookies.get({}, (error, cookies) => {
      if (error) {
        dialog.showMessageBox(mainWindow, {
          type   : 'error',
          buttons: [],
          title  : 'Soulworker Launcher - An error occured',
          message: 'There was an error retrieving your login data. The application will now exit.'
        });
        app.quit();
        return;
      }
      mainWindow.webContents.send('on-hangame-login-complete', cookies);
      hangameLoginWindow.close();
    });

    e.preventDefault();
  });

  hangameLoginWindow.on('ready-to-show', () => {
    hangameLoginWindow.show();
  });

  hangameLoginWindow.once('closed', () => {
    hangameLoginWindow = null;
  });

  hangameLoginWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validateURL, isMainFrame) => {
    dialog.showMessageBox(hangameLoginWindow, {
      type   : 'error',
      buttons: [],
      title  : 'Soulworker Launcher - Connection error',
      message: errorCode.toString() + '\n' + errorDescription,
    });

    app.exit();
  });

  function checkHostname() {
    if (hangameLoginWindow) {
      hangameLoginWindow.webContents.executeJavaScript(`location.hostname === 'www.hangame.co.jp'`, false, (result) => {
        if (result) {
          hangameLoginWindow.close();
        } else {
          setTimeout(checkHostname, 100, 0);
        }
      });
    }
  }

  checkHostname();

  if (!skipDialog) {
    dialog.showMessageBox(hangameLoginWindow, {
      type   : 'info',
      buttons: [],
      title  : 'Soulworker Launcher - Authentication required',
      message: 'Please log in to your Soulworker account.'
    }, () => {
    });
  }
}

/* IPC Events */
ipcMain.on('show-hangame-login', showHangameLogin);
ipcMain.on('app-quit', app.exit);
