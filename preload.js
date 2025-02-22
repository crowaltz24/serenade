const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  getFileUrl: (filePath) => `http://localhost:3001/file?path=${encodeURIComponent(filePath)}`,
  getMetadata: (path) => ipcRenderer.invoke("get-metadata", path),
  checkAlbumArtFolder: (folderPath) => ipcRenderer.invoke("check-album-art-folder", folderPath),
  getDefaultDownloadDir: () => ipcRenderer.invoke("get-default-download-dir"),  // Update this line
  getFilesInFolder: (folderPath) => ipcRenderer.invoke("get-files-in-folder", folderPath),
});
