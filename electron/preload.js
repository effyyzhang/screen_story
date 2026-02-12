const { contextBridge, ipcRenderer } = require('electron');

// Expose IPC to the renderer (web UI)
contextBridge.exposeInMainWorld('electron', {
  // Listen for events from main process
  onToggleRecording: (callback) => {
    ipcRenderer.on('toggle-recording', callback);
  },
  onTriggerCapture: (callback) => {
    ipcRenderer.on('trigger-capture', (event, action) => {
      callback(action);
    });
  },

  // Send events to main process
  notify: (title, body) => {
    ipcRenderer.send('notification', { title, body });
  },

  // Check if running in Electron
  isElectron: true
});
