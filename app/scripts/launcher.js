const {ipcRenderer} = require('electron');
const remote = require('electron').remote;
const {dialog, app, BrowserWindow} = require('electron').remote;
const Store = require('electron-store');
const path = require('path');
const safeEval = require('notevil');
const childProcess = require('child_process');


const store = new Store();

let launchWindow, isRetrying;

function initializeLaunchWindow() {
  launchWindow = new BrowserWindow({
    width : 1000,
    height: 800,

    webPreferences: {
      nodeIntegration: false,
    },

    show: false,
  });

  // launchWindow.toggleDevTools();

  launchWindow.on('closed', () => {
    launchWindow = null;
  });

  launchWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validateURL, isMainFrame) => {
    dialog.showMessageBox(remote.getCurrentWindow(), {
      type   : 'error',
      buttons: [],
      title  : 'Soulworker Launcher - Connection error',
      message: errorCode.toString() + '\n' + errorDescription,
    });

    appQuit();
  });
}

function checkLogin() {
  const cookies = loadSessionData();
  for (let cookie of cookies) {
    launchWindow.webContents.session.cookies.set(cookie, (e) => {
    });
  }

  launchWindow.loadURL('http://members-soulworker.hangame.co.jp/login.nhn');

  launchWindow.webContents.once('did-finish-load', () => {
    launchWindow.webContents.executeJavaScript(`document.querySelector('.m-loginPanel .loginPanel_login');`, false, (result) => {
      if (!result) {
        // Not logged in.
        if (isRetrying) {
          const selected = dialog.showMessageBox(remote.getCurrentWindow(), {
            type   : 'warning',
            buttons: ['Retry', 'Cancel'],
            title  : 'Soulworker Launcher - Login failed',
            message: `The launcher was unable to log you in. This may happen if you close the authentication window without logging in, or navigate away from the page. Would you like to try again?`
          });

          if (selected) {
            appQuit();
            return;
          } else {
            launchWindow.webContents.session.clearStorageData();
          }
        }
        ipcRenderer.send('show-hangame-login', isRetrying);
        setLauncherStatusTextVisible(true);
        setLauncherStatusText('Waiting for login');
      } else {
        // Logged in.
        console.log('Launch');
        setLauncherStatusText('Starting game');
        setLauncherStatusTextVisible(isRetrying);
        launchGame();
      }
    });
  });
}

function launchGame() {
  const cookies = loadSessionData();
  for (let cookie of cookies) {
    launchWindow.webContents.session.cookies.set(cookie, (e) => {
    });
  }

  // Generate HGAC.
  console.log('HGAC');
  launchWindow.loadURL(`http://members-soulworker.hangame.co.jp/externalStartGame.nhn`);

  launchWindow.webContents.once('did-finish-load', () => {
    // Get token.
    console.log('Token');
    launchWindow.loadURL('http://hg-soulworker.gamecom.jp/game/start');
    launchWindow.webContents.once('did-finish-load', () => {
      launchWindow.webContents.executeJavaScript(`document.querySelector('#container-maintenance') ? '320' : document.querySelector('pre').textContent`, false, (result) => {
        console.log('token=', result);
        result = safeEval(result);

        if (typeof result === 'number') {
          let message;
          switch (result) {
            case 110:
              message = 'Please log in.';
              break;
            case 320:
              message = 'Currently under maintenance.';
              break;
            case 340:
              message = 'Disabled and cannot be used.';
              break;
            default:
              message = 'Unknown error.';
              break;
          }

          dialog.showMessageBox(remote.getCurrentWindow(), {
            type   : 'error',
            buttons: [],
            title  : 'Soulworker Launcher - Error launching game',
            message: 'Unable to start game.\nReason: ' + message
          });

          appQuit();
        } else if (typeof result === 'string') {
          console.log('Run WGLauncher');

          function findLauncher() {
            childProcess.execFile('tasklist', function (err, result) {
              if (err) {
                dialog.showMessageBox(remote.getCurrentWindow(), {
                  type   : 'error',
                  buttons: [],
                  title  : 'Soulworker Launcher - Error launching game',
                  message: 'Can\'t get running process list, exiting...',
                });
                appQuit();
              } else {
                if (result.indexOf('WGLauncher.exe') > -1 || result.indexOf('SoulWorker100.exe') > -1) {
                  appQuit();
                } else {
                  findLauncher();
                }
              }
            });
          }

          launchWindow.webContents.executeJavaScript(`window.location.href='${result}'`, false, () => {
          });

          findLauncher();
        } else {
          // ???
          dialog.showMessageBox(remote.getCurrentWindow(), {
            type   : 'error',
            buttons: [],
            title  : 'Soulworker Launcher - Error launching game',
            message: 'Unknown error.'
          });

          appQuit();
        }
      });
    });
  });
}

function getSessionDataPath() {
  return path.join(app.getPath('appData'), 'SwjpLauncher', 'session.json');
}

function saveSessionData(cookies) {
  for (const cookie of cookies) {
    const scheme = cookie.secure ? 'https' : 'http';
    const host = cookie.domain[0] === '.' ? cookie.domain.substr(1) : cookie.domain;
    cookie.url = scheme + '://' + host;
  }
  store.set('cookies', cookies);
}

function loadSessionData() {
  return store.get('cookies') || [];
}

function onHangameLoginComplete(event, cookies) {
  saveSessionData(cookies);
  setLauncherStatusTextVisible(true);
  setLauncherStatusText('Connecting');

  isRetrying = true;

  checkLogin();
}

function appQuit() {
  ipcRenderer.send('app-quit');
}

function setLauncherStatusTextVisible(show) {
  document.querySelector('.statusWrapper').style.opacity = show ? 1 : 0;
}

function setLauncherStatusText(text) {
  document.querySelector('h1.status').textContent = text;
}

onload = () => {
  document.querySelector('.overlayContent').style.opacity = 1;

  const indeterminateProgress = new Mprogress({
    template: 3,
    parent  : '.loaderWrapper'
  }).start();

  document.addEventListener('dragover', event => event.preventDefault());
  document.addEventListener('drop', event => event.preventDefault());

  initializeLaunchWindow();
  checkLogin();
};

/* IPC Events */
ipcRenderer.on('on-hangame-login-complete', onHangameLoginComplete);
