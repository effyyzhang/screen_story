const { app, BrowserWindow, Tray, Menu, globalShortcut, Notification } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow = null;
let serverProcess = null;
let tray = null;

// Start the Node.js server
function startServer() {
  const serverPath = path.join(__dirname, '..', 'server.js');

  serverProcess = spawn('node', [serverPath], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });

  // Wait for server to be ready
  return new Promise((resolve) => {
    setTimeout(resolve, 2000); // Give server 2 seconds to start
  });
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset', // macOS traffic lights
    show: false // Don't show until ready
  });

  // Load the web UI
  mainWindow.loadURL('http://localhost:3000');

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window close (hide instead of quit)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

// Create system tray icon
function createTray() {
  // You'll need to create an icon.png in the electron/ directory
  // For now, using a simple template
  tray = new Tray(path.join(__dirname, 'icon.png'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Screen Story',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Start Capture',
      click: () => {
        // Could send IPC message to UI to trigger capture
        if (mainWindow) {
          mainWindow.webContents.send('trigger-capture', 'start');
        }
      }
    },
    {
      label: 'Stop Capture',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('trigger-capture', 'stop');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Screen Story');
  tray.setContextMenu(contextMenu);

  // Double-click to show window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });
}

// Register global shortcuts
function registerShortcuts() {
  // CMD+Shift+R to start/stop recording
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    // Toggle recording
    if (mainWindow) {
      mainWindow.webContents.send('toggle-recording');
    }
  });

  // CMD+Shift+S to show Screen Story
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Start the server first
  await startServer();

  // Create the window
  createWindow();

  // Create tray icon
  createTray();

  // Register shortcuts
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on quit
app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();

  // Kill the server process
  if (serverProcess) {
    serverProcess.kill();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
