const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

require('./server');

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 750,
    minHeight: 550,
    title: 'B站缓存视频转MP4',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.loadURL('http://localhost:3456');
  mainWindow.setMenuBarVisibility(false);
});

app.on('window-all-closed', () => app.quit());
