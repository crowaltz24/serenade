const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  getFileUrl: (filePath) => `http://localhost:3001/file?path=${encodeURIComponent(filePath)}`,
});
