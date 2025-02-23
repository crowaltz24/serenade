const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  getFileUrl: (filePath) => `http://localhost:3001/file?path=${encodeURIComponent(filePath)}`,
  getMetadata: (path) => ipcRenderer.invoke("get-metadata", path),
  checkAlbumArtFolder: (folderPath) => ipcRenderer.invoke("check-album-art-folder", folderPath),
  getDefaultDownloadDir: () => ipcRenderer.invoke("get-default-download-dir"),  // Update this line
  getFilesInFolder: (folderPath) => ipcRenderer.invoke("get-files-in-folder", folderPath),
  getSavedFolder: () => ipcRenderer.invoke('get-saved-folder'),
  saveFolder: (folder) => ipcRenderer.invoke('save-folder', folder),
  getSavedVolume: () => ipcRenderer.invoke('get-saved-volume'),
  saveVolume: (volume) => ipcRenderer.invoke('save-volume', volume),
  getSaveStatePreference: () => ipcRenderer.invoke('get-save-state-preference'),
  saveTrackOrder: (folderPath, order) => ipcRenderer.invoke('save-track-order', folderPath, order),
  getTrackOrder: (folderPath) => ipcRenderer.invoke('get-track-order', folderPath),
});

ipcRenderer.on('open-folder', async (_, folderPath) => {
  const files = await ipcRenderer.invoke('get-files-in-folder', folderPath);
  if (files.length > 0) {
    window.dispatchEvent(new CustomEvent('folder-selected', { 
      detail: { folderPath, files } 
    }));
  }
});
