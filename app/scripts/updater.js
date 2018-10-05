const {ipcRenderer} = require('electron');

let progressBar;

function setLauncherStatusTextVisible(show) {
  document.querySelector('.statusWrapper').style.opacity = show ? 1 : 0;
}

function setDownloadProgress(event, progress) {
  if (progressBar) {
    progressBar.set(progress.percent / 100);
  }
}

onload = () => {
  setLauncherStatusTextVisible(true);

  document.querySelector('.overlayContent').style.opacity = 1;

  progressBar = new Mprogress({
    template: 1,
    parent  : '.loaderWrapper'
  }).start();

  document.addEventListener('dragover', event => event.preventDefault());
  document.addEventListener('drop', event => event.preventDefault());
};

/* IPC Events */
ipcRenderer.on('download-progress', setDownloadProgress);
