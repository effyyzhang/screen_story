# Screen Story - Electron App Guide

Convert the web UI into a native macOS app with Electron.

## Quick Start

```bash
# Install Electron dependencies
cd electron
npm install

# Run as Electron app
npm start

# Build distributable app
npm run build
```

## What You Get

### Native Features

**1. Menu Bar Icon**
- Always accessible from the macOS menu bar
- Right-click menu:
  - Show Screen Story
  - Start/Stop Capture
  - Quit

**2. Global Keyboard Shortcuts**
- `⌘⇧R` - Start/stop recording
- `⌘⇧S` - Show Screen Story window

**3. Native App Experience**
- Dock icon
- macOS window controls
- App can run in background (window hidden)
- Proper quit vs. close behavior

**4. Distribution**
- Build `.dmg` installer
- Code signing support
- Auto-updates (future)

## Architecture

```
Electron Main Process (main.js)
    ↓
Spawns: node server.js
    ↓
BrowserWindow → http://localhost:3000
    ↓
Your existing web UI (unchanged!)
```

**Key insight:** Your web UI doesn't need ANY changes! Electron just wraps it.

## How It Works

### 1. Main Process (main.js)
- Spawns the Node.js server as a child process
- Creates BrowserWindow pointing to localhost:3000
- Sets up tray icon and global shortcuts
- Handles app lifecycle (quit, hide, show)

### 2. Preload Script (preload.js)
- Optional IPC bridge between UI and Electron
- Exposes `window.electron` API to web UI
- Can add native features without modifying UI

### 3. Server (server.js)
- Runs exactly as before (unchanged!)
- Electron is just another way to view it

## Installation Steps

### 1. Create Icon

You need a proper icon file. Two options:

**Option A: Quick (use emoji)**
```bash
# macOS can render emoji as icons temporarily
# We'll create a proper icon later
```

**Option B: Proper icon**
- Create 512x512 PNG with Screen Story logo
- Use https://cloudconvert.com/png-to-icns to convert
- Save as `electron/icon.icns`

### 2. Install Dependencies

```bash
cd electron
npm install
```

This installs:
- `electron` - The Electron runtime
- `electron-builder` - Build and package tool

### 3. Test It

```bash
cd electron
npm start
```

The app should:
1. Start the server
2. Open a native window
3. Load the UI at localhost:3000
4. Show tray icon (if icon exists)

## Building Distributable App

```bash
cd electron
npm run build
```

This creates:
- `dist/Screen Story.app` - The macOS app
- `dist/Screen Story-1.0.0.dmg` - Installer

You can then:
- Drag app to /Applications
- Share the DMG with others
- Double-click to run (no terminal needed!)

## Enhancements Over Web UI

### What Electron Adds:

✅ **Menu bar icon** - Always accessible
✅ **Global shortcuts** - Work anywhere
✅ **Background operation** - Can hide window, app keeps running
✅ **Native notifications** - System-level alerts
✅ **Dock integration** - Badge counts, progress bars
✅ **Single .app file** - Easy distribution
✅ **Auto-launch on login** - Start with macOS

### What Stays the Same:

✅ **All functionality** - Everything from web UI works
✅ **No code changes** - UI files unchanged
✅ **CLI still works** - Can use both!
✅ **Local data** - Same database, same files

## Advanced Features (Future)

Once basic Electron app works, can add:

### Auto-Updates
```javascript
const { autoUpdater } = require('electron-updater');
autoUpdater.checkForUpdatesAndNotify();
```

### Native Menus
```javascript
Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'File', submenu: [...] },
  { label: 'Edit', submenu: [...] },
  { label: 'Session', submenu: [...] }
]));
```

### Dock Badge
```javascript
app.dock.setBadge('3'); // Show unanalyzed session count
```

### Touch Bar Support
```javascript
new TouchBar({
  items: [
    new TouchBarButton({ label: '▶️ Start', click: () => {} }),
    new TouchBarButton({ label: '⏹ Stop', click: () => {} })
  ]
});
```

## File Structure

```
screen_story/
├── electron/              # Electron wrapper (NEW)
│   ├── package.json      # Electron dependencies
│   ├── main.js           # Main process
│   ├── preload.js        # IPC bridge
│   └── icon.icns         # App icon
├── server.js             # Backend (unchanged)
├── ui/                   # Web UI (unchanged)
└── lib/                  # Core logic (unchanged)
```

## Comparison: Web vs Electron

| Feature | Web UI | Electron App |
|---------|--------|--------------|
| Start method | `node server.js` | Double-click app |
| Access | Browser tab | Native window |
| Global shortcuts | ❌ | ✅ |
| Menu bar icon | ❌ | ✅ |
| Background operation | ❌ | ✅ |
| Distribution | GitHub | .dmg installer |
| Auto-updates | ❌ | ✅ (future) |
| CLI access | ✅ | ✅ |

## Troubleshooting

### Icon not showing in tray
- Make sure `icon.png` exists in `electron/` directory
- Create a proper 16x16 or 32x32 PNG icon
- Restart the Electron app

### Server not starting
- Check if port 3000 is already in use
- Kill existing `node server.js` processes
- Check console for errors

### Build fails
- Make sure all dependencies are installed
- Check `electron/package.json` file list
- Verify Node.js modules are included

### Window is blank
- Server might not be ready yet
- Increase timeout in `startServer()` function
- Open DevTools: `View > Toggle Developer Tools`

## Development Workflow

**For testing:**
```bash
cd electron
npm start
```

**For building:**
```bash
cd electron
npm run build
```

**For debugging:**
- Open DevTools in the window (⌘⌥I)
- Check main process logs in terminal
- Use `console.log` in main.js

## Next Steps

1. ✅ Create proper icon (512x512 PNG)
2. ✅ Test Electron app (`npm start`)
3. ✅ Build distributable (`npm run build`)
4. 🔜 Add code signing for distribution
5. 🔜 Set up auto-updates
6. 🔜 Add native notifications for analysis complete
7. 🔜 Dock badge for unanalyzed sessions

## Effort Required

- **Basic wrapper**: 30 minutes ✅ (Already done!)
- **Icon creation**: 15 minutes
- **Testing & tweaks**: 30 minutes
- **Building distributable**: 15 minutes

**Total: ~1.5 hours** to have a working native macOS app!

## Why This Approach Works

Following the brian/electron-wrapper pattern:
- **Server independence** - Backend runs unchanged
- **UI flexibility** - Can use browser OR Electron
- **Easy testing** - Web UI for development, Electron for production
- **Dual access** - Power users keep CLI, casual users get GUI

**Best of all worlds!** 🚀
