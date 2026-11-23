const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('finanzasDesktop', {
  saveBackup: (filename, content) => ipcRenderer.invoke('backup:save', filename, content),
  revealBackup: () => ipcRenderer.invoke('backup:reveal'),
});
