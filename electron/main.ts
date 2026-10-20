import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc/handlers.js';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#090d16',
    title: 'ASO & Pazar İstihbarat Radarı',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  registerIpcHandlers();

  if (isDev) {
    let connected = false;
    for (let i = 0; i < 30; i++) {
      try {
        await mainWindow.loadURL('http://localhost:3000');
        connected = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    if (!connected) {
      mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
