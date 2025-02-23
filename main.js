import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { fork, spawn } from "child_process";
import fs from "fs";
import * as mm from 'music-metadata';
import os from "os";
import Store from 'electron-store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;
let serverProcess;
let flaskProcess;

// store
const store = new Store();
const defaultPreferences = { saveState: true };
const preferences = new Store({ name: 'preferences', defaults: defaultPreferences });
const trackOrderStore = new Store({ name: 'trackOrder' });

// start express server alongside electron
const startServer = () => {
  if (serverProcess) return; // prevent multiple instances !!

  serverProcess = fork(path.join(__dirname, "server.mjs"), {
    stdio: "ignore",
  });

  serverProcess.unref();
};

// start Flask server
const startFlaskServer = () => {
  flaskProcess = spawn(
    process.platform === 'win32' ? 'venv\\Scripts\\python' : 'venv/bin/python',
    ['-m', 'flask', 'run', '--port=5000'], 
    {
      cwd: path.join(__dirname, 'backend'),
      stdio: 'pipe',  // hide output
      env: {
        ...process.env,
        FLASK_APP: 'download.py',
        FLASK_ENV: 'development'
      },
      windowsHide: true,
      detached: false
    }
  );

  // debugging
  flaskProcess.stdout?.on('data', (data) => console.log(`Flask: ${data}`));
  flaskProcess.stderr?.on('data', (data) => console.error(`Flask error: ${data}`));

  flaskProcess.on('close', (code) => {
    console.log(`Flask server exited with code ${code}`);
  });
};

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Folder in Tracklist',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openDirectory"],
            });
            if (!result.canceled) {
              mainWindow.webContents.send('open-folder', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Go to Open Folder',
          click: async () => {
            const currentFolder = store.get('lastFolder');
            if (currentFolder) {
              shell.openPath(currentFolder);
            }
          },
          enabled: !!store.get('lastFolder')
        },
        { type: 'separator' },
        {
          label: 'Save State on Exit',
          type: 'checkbox',
          checked: preferences.get('saveState'),
          click: (menuItem) => {
            preferences.set('saveState', menuItem.checked);
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      role: 'viewMenu',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          role: 'toggleDevTools',
          click: () => mainWindow.webContents.openDevTools({ mode: 'detach' })  // open devtools in separate window so it doesnt mess with our specific layout lol
        }
      ]
    },
    { role: 'windowMenu' },
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Help',
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/crowaltz24/serenade')
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  startServer();
  startFlaskServer();
  createMenu();

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




  mainWindow.webContents.on('context-menu', (event, params) => {
    event.preventDefault();
    const menu = createContextMenu(params.isEditable);
    menu.popup({ window: mainWindow });
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 'i') {
      event.preventDefault();
      mainWindow.webContents.openDevTools({ mode: 'detach' });  // open devtools in separate window so it doesnt mess with our specific layout lol
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;    // PREVENT MEMORY LEAKS
  });
});



// full image path and format
async function saveAlbumArt(filePath) {
  try {
    const metadata = await mm.parseFile(filePath);
    if (!metadata.common.picture?.[0]?.data) {
      return null;
    }

    const picture = metadata.common.picture[0];
    const format = picture.format.startsWith('image/') 
      ? picture.format.split('/')[1] 
      : picture.format;
    
    const dirPath = path.dirname(filePath);
    const albumArtDir = path.join(dirPath, 'album-art');
    
    if (!fs.existsSync(albumArtDir)) {
      fs.mkdirSync(albumArtDir);
    }

    const musicFileName = path.basename(filePath, path.extname(filePath));
    const imageFileName = `${musicFileName}.${format}`;
    const imagePath = path.join(albumArtDir, imageFileName);

    // Save image if it doesn't exist
    if (!fs.existsSync(imagePath)) {
      fs.writeFileSync(imagePath, picture.data);
    }

    return {
      path: imagePath,
      format: `image/${format}`
    };
  } catch (error) {
    console.error('Error saving album art:', error);
    return null;
  }
}



// IPC handlers





// use saved album art
ipcMain.handle("get-metadata", async (_, filePath) => {
  try {
    const metadata = await mm.parseFile(filePath, {
      duration: false,
      skipCovers: false,
      includeChapters: false
    });

    const albumArt = await saveAlbumArt(filePath);
    
    // filter out 'Various Artists' bs
    const artists = (metadata.common.artists || [metadata.common.artist])
      .filter(artist => artist && artist !== 'Various Artists');

    return {
      title: metadata.common.title,
      artist: metadata.common.artist,
      artists: artists.length > 0 ? artists : undefined,
      albumArt: albumArt ? {
        format: albumArt.format,
        data: fs.readFileSync(albumArt.path).toString('base64')
      } : null
    };
  } catch (error) {
    console.error('Error reading metadata for:', filePath, error);
    return null;
  }
});

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

    // extract and save album art for each audio file
    for (const audioFile of audioFiles) {
      await saveAlbumArt(audioFile);
    }

    return audioFiles;
  }
  return [];
});

ipcMain.handle("get-file-url", async (_, filePath) => {
  return `http://localhost:3001/file?path=${encodeURIComponent(filePath)}`;
});

ipcMain.handle("check-album-art-folder", async (_, folderPath) => {
  const albumArtDir = path.join(folderPath, 'album-art');
  
  if (!fs.existsSync(albumArtDir)) {
    return [];
  }

  return fs.readdirSync(albumArtDir)
    .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file))
    .map(file => path.join(albumArtDir, file));
});

// get default download directory
ipcMain.handle("get-default-download-dir", async () => {
  return path.join(os.homedir(), 'Downloads');
});

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

ipcMain.handle("get-saved-folder", () => {
  return store.get('lastFolder', '');
});

ipcMain.handle("save-folder", (_, folder) => {
  store.set('lastFolder', folder);
});

ipcMain.handle("get-saved-volume", () => {
  return store.get('volume', 1);
});

ipcMain.handle("save-volume", (_, volume) => {
  store.set('volume', volume);
});

ipcMain.handle('get-save-state-preference', () => {
  return preferences.get('saveState');
});

ipcMain.handle("save-track-order", (_, folderPath, order) => {
  trackOrderStore.set(folderPath, order);
});

ipcMain.handle("get-track-order", (_, folderPath) => {
  return trackOrderStore.get(folderPath, []);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on('quit', () => {
  if (!preferences.get('saveState')) {
    store.delete('lastFolder');
    store.delete('volume');
  }
  
  if (flaskProcess) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', flaskProcess.pid, '/f', '/t']);
    } else {
      process.kill(-flaskProcess.pid);
    }
  }
  if (serverProcess) serverProcess.kill();
});