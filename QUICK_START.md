# Screen Story - Quick Start Guide

## What We Built

A complete AI-powered screen recording and video creation system with **4 intelligent phases**:

1. **Capture** - Screenshots with multi-window support
2. **Analyze** - AI summaries and relevance scoring  
3. **Search** - Full-text search and virtual sessions
4. **Export** - Professional videos (FFmpeg + JianYing)

## Test It Out (5 minutes)

### 1. Start Capturing
```bash
node capture-daemon.js start my-first-session "Testing Screen Story"
```

### 2. Do Some Work
- Browse some websites
- Open some apps
- Write some code
- (Let it capture for 2-3 minutes)

### 3. Stop Capturing
```bash
node capture-daemon.js stop
```

### 4. Analyze Screenshots
```bash
node analyze-session.js my-first-session
```

### 5. Create Video
```bash
# Quick FFmpeg video
node create-video.js my-first-session

# Professional JianYing export
node export-jianying.js my-first-session

# Open the video
open videos/my-first-session.mp4
```

## Real-World Example: AI Agent Demo

Perfect for recording AI agents performing tasks!

### Record Agent Sending iMessage
```bash
# Start smart recording (captures Terminal + Messages automatically)
node demo-record.js smart-record "Use AI agent to send iMessage"

# In another terminal, run your agent
# The recording captures both terminal and Messages app

# After 30 seconds, it stops automatically
# Then create video:
node create-video.js demo_<timestamp>
```

## Current Session

Your real session "screen-story-completion" has **30 screenshots** analyzed:
- Average relevance: 76%
- 5 success moments
- 4 hero moments (≥80% relevance)

Try creating different videos from it:

```bash
# Standard video (all 30 screenshots)
node create-video.js screen-story-completion

# Hero highlights only (4 screenshots)
node create-video.js screen-story-completion --hero-only

# Enhanced with captions and progress bar
node create-enhanced-video.js screen-story-completion

# Export to JianYing for professional editing
node export-jianying.js screen-story-completion
```

## Available Commands

### Capture
```bash
node capture-daemon.js start <name> <description>
node capture-daemon.js stop
node capture-daemon.js status
```

### Analyze
```bash
node analyze-session.js <session-name>
node list-sessions.js
```

### Search
```bash
node search-screenshots.js "keyword"
node create-virtual-session.js --name "bugs" --task "debugging"
```

### Video Export
```bash
# FFmpeg (fast, automated)
node create-video.js <session>
node create-enhanced-video.js <session> [--hero-only]

# JianYing (professional)
node export-jianying.js <session> [--hero-only]

# Multi-window demos
node demo-record.js smart-record "task description"
node demo-record.js manual-record "App1" "App2"
```

## Integration: JianYing MCP

For advanced users who want **automated** JianYing import:

1. Visit: https://glama.ai/mcp/servers/@hey-jian-wei/jianying-mcp
2. Install the MCP server
3. Restart Claude Desktop
4. Use MCP tools for auto-import

See `JIANYING_INTEGRATION.md` for details.

## What Makes It Smart?

### Intelligent Pacing
Each frame's duration is based on AI relevance:
- Hero moments (≥80%): 3 seconds
- Important (50-80%): 2 seconds  
- Context (<50%): 1 second

### Multi-Window Capture
AI predicts which apps to capture based on task:
- "send iMessage" → Messages app
- "debug code" → VSCode, Terminal, Chrome
- "calendar event" → Calendar app

### Professional Export
Two approaches for different needs:
- **FFmpeg**: Fast automated videos (good for testing)
- **JianYing**: Professional editing (good for final demos)

## Next Steps

1. ✅ **Try it**: Record a session and create a video
2. ✅ **Explore**: Try search, virtual sessions, hero-only mode
3. 📹 **Create demos**: Use multi-window capture for agent workflows
4. 🎬 **Polish**: Export to JianYing for professional editing

Enjoy creating amazing demo videos! 🎥✨
