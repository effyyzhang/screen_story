const { app, BrowserWindow, Tray, Menu, globalShortcut, Notification, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let serverProcess = null;
let daemonProcess = null;
let nextProcess = null;
let tray = null;

// Start the capture daemon
function startDaemon() {
  const daemonPath = path.join(__dirname, '..', 'capture-daemon.js');

  daemonProcess = spawn('node', [daemonPath], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });

  daemonProcess.on('error', (err) => {
    console.error('Failed to start daemon:', err);
  });

  // Wait for daemon to be ready
  return new Promise((resolve) => {
    setTimeout(resolve, 2000); // Give daemon 2 seconds to start
  });
}

// Start the Node.js backend server
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

// Start the Next.js dev server
function startNextServer() {
  const nextDir = path.join(__dirname, '..', 'ui-redesign');

  nextProcess = spawn('npm', ['run', 'dev'], {
    cwd: nextDir,
    stdio: 'inherit',
    shell: true
  });

  nextProcess.on('error', (err) => {
    console.error('Failed to start Next.js server:', err);
  });

  // Wait for Next.js to be ready
  return new Promise((resolve) => {
    setTimeout(resolve, 5000); // Give Next.js 5 seconds to start
  });
}

// Wait for Next.js server to be ready
async function waitForServer(url, maxAttempts = 30) {
  const http = require('http');

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        http.get(url, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject();
          }
        }).on('error', reject);
      });
      console.log('✅ Next.js server is ready!');
      return true;
    } catch (err) {
      console.log(`Waiting for Next.js server... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

// Create the main window
async function createWindow() {
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
    show: false, // Don't show until ready
    backgroundColor: '#1a1a1a'
  });

  // Show loading message
  console.log('📱 Showing loading screen...');
  mainWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #1a1a1a;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
          }
          .container {
            text-align: center;
          }
          .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid #333;
            border-top-color: #007AFF;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          h1 {
            font-size: 24px;
            font-weight: 500;
            margin: 0 0 10px 0;
          }
          p {
            font-size: 14px;
            color: #999;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h1>🎬 Screen Story</h1>
          <p>Starting services...</p>
        </div>
      </body>
    </html>
  `);

  mainWindow.show();

  // Wait for Next.js to be ready
  const isReady = await waitForServer('http://localhost:3000');

  console.log(isReady ? '✅ Server ready, loading UI' : '❌ Server failed, showing error');

  if (isReady) {
    // Load the web UI
    console.log('🌐 Loading http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // Show error if server didn't start
    console.log('⚠️ Showing error screen');
    mainWindow.loadURL(`data:text/html;charset=utf-8,
      <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 0;
              background: #1a1a1a;
              color: #fff;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
            }
            .container {
              text-align: center;
              max-width: 500px;
              padding: 40px;
            }
            h1 {
              color: #FF453A;
              margin: 0 0 20px 0;
            }
            p {
              color: #999;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Failed to Start</h1>
            <p>Could not start the Next.js server. Please try running the app again, or start services manually with ./start.sh</p>
          </div>
        </body>
      </html>
    `);
  }

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
  // Skip tray icon for now - icon file needs to be created
  return;

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

// Handle folder selection dialog
ipcMain.handle('select-screenshot-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Screenshot Storage Folder',
    buttonLabel: 'Select Folder'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = result.filePaths[0];

    // Save to settings file
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    let settings = {};

    try {
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }
    } catch (err) {
      console.error('Error reading settings:', err);
    }

    settings.screenshotFolder = selectedPath;

    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      return { success: true, path: selectedPath };
    } catch (err) {
      console.error('Error saving settings:', err);
      return { success: false, error: err.message };
    }
  }

  return { success: false, canceled: true };
});

// Get current screenshot folder
ipcMain.handle('get-screenshot-folder', () => {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  const defaultPath = path.join(__dirname, '..', 'sessions');

  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return settings.screenshotFolder || defaultPath;
    }
  } catch (err) {
    console.error('Error reading settings:', err);
  }

  return defaultPath;
});

// App lifecycle
app.whenReady().then(async () => {
  // Start all services
  console.log('Starting capture daemon...');
  await startDaemon();

  console.log('Starting backend server...');
  await startServer();

  console.log('Starting Next.js dev server...');
  await startNextServer();

  // Create the window (will wait for server)
  await createWindow();

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

  // Kill all processes
  if (daemonProcess) {
    daemonProcess.kill();
  }
  if (serverProcess) {
    serverProcess.kill();
  }
  if (nextProcess) {
    nextProcess.kill();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
