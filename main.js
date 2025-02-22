import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { fork } from "child_process";  // fork matches server.mjs
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;
let serverProcess;

// start express server alongside electron
const startServer = () => {
  if (serverProcess) return; // prevent multiple instances !!

  serverProcess = fork(path.join(__dirname, "server.mjs"), {
    stdio: "ignore",
  });

  serverProcess.unref();
};

app.whenReady().then(() => {
  startServer();

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,   // earlier we were trying to do this with contextIsolation off, however we decided to preload for security
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL("http://localhost:5173");

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' http://localhost:3001 http://localhost:5173; script-src 'self' 'unsafe-inline' http://localhost:5173; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self' http://localhost:3001"
        ],

      },
    });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;    // PREVENT MEMORY LEAKS
  });
});

// folder select
ipcMain.handle("select-folder", async () => {
  if (!mainWindow) return [];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });

  if (!result.canceled) {
    const folderPath = result.filePaths[0];

    const audioFiles = fs
      .readdirSync(folderPath)
      .filter((file) => file.endsWith(".mp3") || file.endsWith(".wav"))
      .map((file) => path.join(folderPath, file));

    return audioFiles;
  }
  return [];
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
