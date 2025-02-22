import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { fork, spawn } from "child_process";  // fork matches server.mjs
import fs from "fs";
import * as mm from 'music-metadata';  // Add this import
import os from "os";  // Add this import

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;
let serverProcess;
let flaskProcess;



// start express server alongside electron
const startServer = () => {
  if (serverProcess) return; // prevent multiple instances !!

  serverProcess = fork(path.join(__dirname, "server.mjs"), {
    stdio: "ignore",
  });

  serverProcess.unref();
};

// Start Flask server
const startFlaskServer = () => {
  flaskProcess = spawn(
    process.platform === 'win32' ? 'venv\\Scripts\\python' : 'venv/bin/python',
    ['-m', 'flask', 'run', '--port=5000'], 
    {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'pipe',  // Change from 'inherit' to 'pipe' to hide output
      env: {
        ...process.env,
        FLASK_APP: 'download.py',
        FLASK_ENV: 'development'
      },
      windowsHide: true,
      detached: false  // Change to false to prevent detachment
    }
  );

  // Optional: pipe output to console for debugging
  flaskProcess.stdout?.on('data', (data) => console.log(`Flask: ${data}`));
  flaskProcess.stderr?.on('data', (data) => console.error(`Flask error: ${data}`));

  flaskProcess.on('close', (code) => {
    console.log(`Flask server exited with code ${code}`);
  });
};

app.whenReady().then(() => {
  startServer();
  startFlaskServer();  // Start the Flask server

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      enableWebSQL: false,
    },
  });

  mainWindow.loadURL("http://localhost:5173");

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' http://localhost:3001 http://localhost:5173 http://localhost:5000; " +
          "script-src 'self' 'unsafe-inline' http://localhost:5173; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: blob: http://localhost:3001; " +
          "media-src 'self' http://localhost:3001"
        ],
      },
    });
  });

  // Move context menu creation here
  const createContextMenu = (isEditable) => {
    const template = [];
    
    if (isEditable) {
      template.push(
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' }
      );
    } else {
      template.push({ label: 'Copy', role: 'copy' });
    }
    
    template.push(
      { type: 'separator' },
      { label: 'Select All', role: 'selectAll' }
    );
    
    return Menu.buildFromTemplate(template);
  };

  // Add context menu handler
  mainWindow.webContents.on('context-menu', (event, params) => {
    event.preventDefault();
    const menu = createContextMenu(params.isEditable);
    menu.popup({ window: mainWindow });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;    // PREVENT MEMORY LEAKS
  });
});

// Add this function after the imports
async function saveAlbumArt(filePath) {
  try {
    const metadata = await mm.parseFile(filePath);
    if (!metadata.common.picture || metadata.common.picture.length === 0) {
      return null;
    }

    const picture = metadata.common.picture[0];
    const format = picture.format.startsWith('image/') 
      ? picture.format.split('/')[1] 
      : picture.format;
    
    // Create album-art directory in the same folder as the music file
    const dirPath = path.dirname(filePath);
    const albumArtDir = path.join(dirPath, 'album-art');
    
    if (!fs.existsSync(albumArtDir)) {
      fs.mkdirSync(albumArtDir);
    }

    // Create a filename based on the music file name
    const musicFileName = path.basename(filePath, path.extname(filePath));
    const imageFileName = `${musicFileName}.${format}`;
    const imagePath = path.join(albumArtDir, imageFileName);

    // Save the image
    fs.writeFileSync(imagePath, picture.data);
    return imagePath;
  } catch (error) {
    console.error('Error saving album art:', error);
    return null;
  }
}

// Modify the existing select-folder handler
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

    // Extract and save album art for each audio file
    for (const audioFile of audioFiles) {
      await saveAlbumArt(audioFile);
    }

    return audioFiles;
  }
  return [];
});

// Modify the get-metadata handler
ipcMain.handle("get-metadata", async (_, filePath) => {
  try {
    const metadata = await mm.parseFile(filePath);
    return {
      title: metadata.common.title,
      artist: metadata.common.artist,
      albumArt: metadata.common.picture?.[0] ? {
        format: metadata.common.picture[0].format,
        data: metadata.common.picture[0].data.toString('base64')
      } : null
    };
  } catch (error) {
    console.error('Error reading metadata:', error);
    return null;
  }
});

// Add this IPC handler
ipcMain.handle("get-file-url", async (_, filePath) => {
  return `http://localhost:3001/file?path=${encodeURIComponent(filePath)}`;
});

// Add this IPC handler with the other handlers
ipcMain.handle("check-album-art-folder", async (_, folderPath) => {
  const albumArtDir = path.join(folderPath, 'album-art');
  
  if (!fs.existsSync(albumArtDir)) {
    return [];
  }

  return fs.readdirSync(albumArtDir)
    .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file))
    .map(file => path.join(albumArtDir, file));
});

// Add this IPC handler to get the default download directory
ipcMain.handle("get-default-download-dir", async () => {
  return path.join(os.homedir(), 'Downloads');
});

// Add this with your other IPC handlers
ipcMain.handle("get-files-in-folder", async (_, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath)
      .filter(file => /\.(mp3|wav|m4a|flac|ogg)$/i.test(file))
      .map(file => path.join(folderPath, file));
    return files;
  } catch (error) {
    console.error('Error reading folder:', error);
    return [];
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on('quit', () => {
  if (flaskProcess) {
    // Force kill the process and its children
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', flaskProcess.pid, '/f', '/t']);
    } else {
      process.kill(-flaskProcess.pid);
    }
  }
  if (serverProcess) serverProcess.kill();
});