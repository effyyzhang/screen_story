# Screen Story - Electron Desktop App

## Current Status: ✅ Ready to Use!

Your Screen Story Electron app is fully functional and ready to run.

## Features Implemented

### ✅ Core Functionality
- **Desktop window** with native macOS look and feel
- **System tray icon** - stays in menu bar, doesn't clutter dock
- **Auto-starts server** - no manual `node server.js` needed
- **Global shortcuts**:
  - `Cmd+Shift+R` - Start/stop capture
  - `Cmd+Shift+S` - Show Screen Story window

### ✅ New Settings
- **Screenshot folder selection** - Choose where screenshots are saved
- Settings modal with folder browser
- Persistent settings (saved in `~/Library/Application Support/screen-story-electron/settings.json`)

### ✅ Window Management
- Minimize to tray (window close doesn't quit app)
- Double-click tray icon to reopen
- Tray menu with capture controls
- macOS traffic lights (native window controls)

## How to Run

### Development Mode (Quick Start)
```bash
# From project root
./start-electron.sh

# Or manually:
cd electron
npm start
```

### First Launch
1. The app will auto-start the server on port 3000
2. Window opens automatically showing the UI
3. Tray icon appears in menu bar (⏺️)
4. Click ⚙️ Settings to choose screenshot folder

## Usage

### Start/Stop Capture
**Method 1:** Use the UI
- Click "Start Capture" button
- Enter session name and description
- Click "Start Recording"

**Method 2:** Global shortcut
- Press `Cmd+Shift+R` anywhere to toggle

**Method 3:** Tray menu
- Click tray icon → Start Capture

### Change Screenshot Storage Folder
1. Click ⚙️ (Settings) button in top right
2. Click "Browse..." button
3. Select your desired folder
4. Screenshots will be saved to that location

**Default location:** `~/Documents/effyos/screen_story/sessions/`

### View Captures
- All screenshots appear in the grid view
- Filter by app, date, success status
- AI analysis shows relevance scores
- Window badges show fullscreen vs windowed

## Build as Standalone App (Optional)

To create a `.app` bundle you can drag to Applications:

```bash
cd electron
npm run build
```

This creates:
- `dist/Screen Story.app` - Drag to Applications folder
- `dist/Screen Story.dmg` - Distributable installer

## Settings File Location

Settings are saved in:
```
~/Library/Application Support/screen-story-electron/settings.json
```

Current settings:
- `screenshotFolder` - Custom screenshot storage location

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+R` | Toggle capture (start/stop) |
| `Cmd+Shift+S` | Show Screen Story window |

## Tray Menu

- **Show Screen Story** - Open main window
- **Start Capture** - Begin screenshot capture
- **Stop Capture** - End capture session
- **Quit** - Close app completely

## Architecture

```
Screen Story Electron App
├── electron/main.js        - Main process (window, tray, shortcuts)
├── electron/preload.js     - IPC bridge (security)
├── electron/package.json   - Electron config
├── server.js               - Backend (auto-started by Electron)
└── ui/                     - Frontend (loaded at localhost:3000)
```

## Next Steps

### Ready to Use Now ✅
- Start the app: `./start-electron.sh`
- Configure settings (folder selection)
- Start capturing!

### Future Enhancements (Optional)
- [ ] Auto-launch at login
- [ ] Custom capture intervals (currently 10s)
- [ ] In-app video preview
- [ ] JianYing MCP integration for video assembly
- [ ] Notification preferences
- [ ] Dark mode toggle

## Comparison: CLI vs Electron App

| Feature | CLI (`node server.js`) | Electron App |
|---------|----------------------|--------------|
| Server startup | Manual | Automatic |
| Browser window | Manual (open localhost:3000) | Automatic |
| Background running | Terminal must stay open | Runs in system tray |
| Shortcuts | None | Cmd+Shift+R, Cmd+Shift+S |
| Settings | Edit files manually | GUI settings panel |
| Folder selection | Manual path editing | File browser dialog |
| Quit behavior | Kill terminal | Hide to tray |

## Troubleshooting

### App won't start
```bash
# Check Electron is installed
cd electron
npm install

# Try running manually
npm start
```

### Server port conflict (3000 already in use)
```bash
# Kill existing server
lsof -ti:3000 | xargs kill -9

# Or change port in server.js
```

### Tray icon not appearing
- Check macOS menu bar isn't full (hide other apps)
- Restart the app

### Screenshots not saving
1. Click ⚙️ Settings
2. Verify folder path is valid
3. Check folder permissions

## License

MIT
