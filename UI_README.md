# Screen Story - Web UI

A simple, lightweight web interface for Screen Story that runs locally on your machine.

## Quick Start

```bash
# Start the server
node server.js

# Open in browser
open http://localhost:3000
```

The UI will be available at **http://localhost:3000**

## Features

### 1. **Control Panel**
- Start/Stop capture with one click
- Live status indicator (recording/idle)
- Session name and description input

### 2. **Sessions Browser**
- Grid view of all your recording sessions
- Quick stats: screenshots count, analyzed count, avg relevance
- Filter sessions by name or description
- Click any session to view details

### 3. **Session Detail View**
- View all screenshots from a session
- See AI summaries and relevance scores
- Color-coded relevance badges (green = high, yellow = medium, gray = low)
- One-click analysis for unanalyzed sessions

### 4. **Search**
- Full-text search across all screenshots
- Searches OCR text, AI summaries, and tags
- Results with relevance scores and summaries
- Fast FTS5 search powered by SQLite

### 5. **Export Panel**
- Select session to export
- Option for hero-only mode (≥70% relevance)
- Create videos with one click
- Shows FFmpeg output in real-time

### 6. **Stats Dashboard**
- Total sessions count
- Total screenshots count
- Analyzed screenshots count
- Updates automatically

## Architecture

### Backend (server.js)
- Express HTTP server on port 3000
- REST API wrapping existing CLI functionality
- No data modification - reads from existing SQLite DB
- Serves static UI files and screenshot images

### Frontend (ui/)
- Vanilla JavaScript (no framework overhead)
- Clean, minimal UI inspired by Raycast/Linear
- Dark theme optimized for long sessions
- Responsive grid layouts

## API Endpoints

```
GET  /api/sessions          - List all sessions
GET  /api/sessions/:id      - Get session with screenshots
GET  /api/search?q=...      - Search screenshots
GET  /api/capture/status    - Check if recording
POST /api/capture/start     - Start new recording
POST /api/capture/stop      - Stop current recording
POST /api/analyze/:session  - Analyze session (background)
POST /api/export/video      - Create video from session
GET  /api/stats             - Get overall statistics
```

## CLI Still Works!

The UI is **completely optional**. All your CLI commands still work:

```bash
# Capture (CLI)
node capture-daemon.js start my-session "description"

# Analyze (CLI)
node analyze-session.js my-session

# Search (CLI)
node search-screenshots.js "query"

# Export (CLI)
node create-video.js my-session --hero-only
```

The UI and CLI read from the same database, so you can use both!

## File Structure

```
screen_story/
├── server.js              # HTTP server (NEW)
├── ui/                    # Web UI (NEW)
│   ├── index.html        # Main page
│   ├── styles.css        # Dark theme styling
│   └── app.js            # Frontend logic
├── lib/                   # Backend (unchanged)
├── capture-daemon.js      # CLI tools (unchanged)
└── ...
```

## Benefits

✅ **Local-first** - All data stays on your machine
✅ **Lightweight** - No frameworks, minimal dependencies
✅ **Fast** - Direct SQLite queries, no ORM overhead
✅ **Optional** - CLI still works for power users
✅ **Simple** - No build step, no compilation

## Development

The server auto-serves static files from `ui/` directory. Just edit the HTML/CSS/JS files and refresh your browser - no build step needed!

## Future Enhancements

- [ ] Electron wrapper for native app
- [ ] Global keyboard shortcuts
- [ ] Menu bar icon/system tray
- [ ] Video preview player
- [ ] Drag-and-drop virtual session creation
- [ ] Timeline view for multi-window sessions
- [ ] Export progress indicator
- [ ] Batch operations (analyze/export multiple sessions)

## Troubleshooting

**Port 3000 already in use?**
```bash
# Use a different port
PORT=3001 node server.js
```

**Sessions not showing up?**
- Make sure you have sessions in the database
- Try `node list-sessions.js` to verify

**Screenshots not loading?**
- Check that session directories exist in `sessions/`
- Verify file paths in the database

**Search not working?**
- Sessions must be analyzed first
- Use the UI to analyze sessions or run `node analyze-session.js <session>`

## Why This Approach?

Following the "Electron as chrome, Bun as server" pattern from brian's electron-wrapper:

1. **Server stays pure** - Can run standalone or in Electron
2. **UI is optional** - Power users keep CLI workflow
3. **Local data** - No cloud, no privacy concerns
4. **Extensible** - Easy to add Electron wrapper later

This gives you the best of both worlds: **speed of CLI + convenience of UI** 🚀
