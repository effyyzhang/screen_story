# Screen Story

Turn your screen activity into shareable short-form videos with AI-powered summaries.

## What it does

**Screen Story** is an AI-powered screen recording and video creation tool with 4 intelligent phases:

### Phase 1: Intelligent Capture
- **Auto-capture**: Timer-based screenshots (every 5-10s) or app-switch triggered
- **Multi-window**: Capture background apps for demo videos (Terminal + Messages, etc.)
- **Smart monitoring**: AI predicts which apps to capture based on task description

### Phase 2: AI Analysis
- **OCR**: Extract text from screenshots using macOS Vision API
- **AI summaries**: Claude Haiku analyzes each screenshot and generates captions
- **Relevance scoring**: 0-100% score for intelligent video pacing
- **Success detection**: Identifies "hero moments" for highlights

### Phase 3: Smart Search
- **Full-text search**: Query screenshots by OCR text, AI summaries, or tags
- **Virtual sessions**: Group screenshots from multiple sessions
- **Task detection**: AI identifies what you accomplished

### Phase 4: Professional Video Export
- **FFmpeg videos**: Quick automated videos with intelligent pacing (1-3s per frame based on relevance)
- **JianYing export**: Professional editing with captions, transitions, effects
- **Multiple formats**: Standard, hero-only, enhanced with overlays

## Setup

### Prerequisites

- macOS with Screenpipe installed
- FFmpeg: `brew install ffmpeg`
- Node.js 18+
- Anthropic API key

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start screenpipe (in separate terminal)
screenpipe --fps 0.2 --disable-audio --enable-frame-cache
```

### Grant Permissions

1. Open **System Settings** → **Privacy & Security** → **Screen Recording**
2. Enable **screenpipe**

## Usage

### Quick Start/Stop Scripts

**Desktop Shortcuts** (double-click):
- `~/Desktop/ScreenStory/START.command` - Start screenpipe
- `~/Desktop/ScreenStory/STOP.command` - Stop screenpipe
- `~/Desktop/ScreenStory/STATUS.command` - Check status

**Shell Aliases** (from anywhere in terminal):
```bash
screen-story-start   # Start screenpipe
screen-story-stop    # Stop screenpipe
screen-story-status  # Check status
screen-story         # Go to project directory
```

**Direct Scripts** (from project directory):
```bash
./start.sh    # Start screenpipe
./stop.sh     # Stop screenpipe
./status.sh   # Check status
```

### Test screenpipe connection
```bash
npm test
```

### Export screenshots with AI summaries
```bash
npm run export
```

### Create videos

**Quick FFmpeg videos** (automated, fast):
```bash
# Standard video
node create-video.js <session-name>

# Hero highlights only
node create-video.js <session-name> --hero-only

# Enhanced with captions, timestamps, progress bar
node create-enhanced-video.js <session-name>
```

**Professional JianYing export** (for manual editing):
```bash
# Export to JianYing-compatible format
node export-jianying.js <session-name>

# Then import into JianYing desktop app
# See JIANYING_INTEGRATION.md for details
```

### Multi-window demo recording
```bash
# Smart recording (AI predicts apps to capture)
node demo-record.js smart-record "Send iMessage using AI agent"

# Manual recording (specify apps)
node demo-record.js manual-record "Messages" "Terminal"

# See which apps to monitor
node demo-record.js list-apps
```

## Project Structure

```
screen_story/
├── lib/
│   ├── screenshot.js           # Phase 1: Screenshot capture
│   ├── ocr.js                  # macOS Vision OCR
│   ├── ai-analyzer.js          # Phase 2: AI analysis with Claude
│   ├── database.js             # SQLite with FTS5 search
│   ├── video-editor.js         # Phase 4: FFmpeg video creation
│   ├── video-enhancements.js   # Text overlays, transitions, effects
│   ├── jianying-export.js      # JianYing draft project export
│   └── multi-window-capture.js # Background app capture for demos
├── capture-daemon.js           # Start/stop capture daemon
├── analyze-session.js          # Run AI analysis on session
├── search-screenshots.js       # Search with FTS5
├── create-video.js             # Create standard videos
├── create-enhanced-video.js    # Create videos with overlays
├── export-jianying.js          # Export to JianYing format
├── demo-record.js              # Multi-window demo recording
├── sessions/                   # Screenshot sessions
├── videos/                     # Exported videos
├── exports/                    # JianYing exports
└── JIANYING_INTEGRATION.md     # JianYing setup guide
```

## Key Features

### Intelligent Pacing
Videos automatically adjust frame duration (1-3s) based on AI relevance scores:
- Hero moments (≥80%): 3 seconds
- Important (50-80%): 2 seconds
- Context (<50%): 1 second

### Multi-Window Demos
Perfect for recording AI agent workflows:
```bash
node demo-record.js smart-record "Agent sends iMessage"
# Captures: Terminal (active) + Messages (background) every 5s
```

### JianYing Integration
Export to professional video editor with:
- AI-generated captions
- Intelligent pacing recommendations
- Timestamps and success indicators
- See `JIANYING_INTEGRATION.md` for setup

### Search & Discovery
```bash
# Full-text search
node search-screenshots.js "error message"

# Create virtual sessions
node create-virtual-session.js --name "debugging" --task "fix login bug"
```

## Cost

- Screenpipe: **Free** (open source)
- Claude Haiku API: ~**$5-10/month** (very affordable)
- Total: Much cheaper than Screenpipe Pro ($29/mo)

## License

MIT
