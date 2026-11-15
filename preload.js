// Ponte minimo tra il gioco e la finestra: schermo intero e uscita.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('trivellaHost', {
  setFullscreen: on => ipcRenderer.send('fullscreen', !!on),
  quit: () => ipcRenderer.send('quit')
});
