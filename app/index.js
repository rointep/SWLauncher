const {app, BrowserWindow, dialog, ipcMain} = require('electron');

let mainWindow;
let hangameLoginWindow;

const isSecondInstance = app.makeSingleInstance(() => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
if (isSecondInstance) {
  app.exit();
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    title: 'Soulworker Launcher',
    icon: 'app/images/icon.ico',

    width: 512,
    height: 270,

    center: true,
    resizable: false,
    movable: false,
    frame: false,
    transparent: true,
  });

  mainWindow.loadURL(`file://${__dirname}/launcher.html`);
  // mainWindow.toggleDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.exit();
  });
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

function showHangameLogin (event, skipDialog) {
  hangameLoginWindow = new BrowserWindow({
    title: 'Soulworker Launcher',
    icon: 'app/images/icon.ico',

    width: 800,
    height: 600,

    resizable: true,
    movable: true,
  });

  hangameLoginWindow.loadURL('http://top.hangame.co.jp/logout/');
  hangameLoginWindow.setMenuBarVisibility(false);

  hangameLoginWindow.once('close', (e) => {
    hangameLoginWindow.webContents.session.cookies.get({}, (error, cookies) => {
      if (error) {
        dialog.showMessageBox(mainWindow, {
          type: 'error',
          buttons: [],
          title: 'Soulworker Launcher - An error occured',
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

  hangameLoginWindow.once('closed', () => {
    hangameLoginWindow = null;
  });

  function checkHostname () {
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
      type: 'info',
      buttons: [],
      title: 'Soulworker Launcher - Authentication required',
      message: 'Please log in to your Soulworker account.'
    }, () => {
    });
  }
}

/* IPC Events */
ipcMain.on('show-hangame-login', showHangameLogin);
ipcMain.on('app-quit', app.exit);
