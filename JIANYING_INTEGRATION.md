# JianYing Integration Guide

Screen Story now supports exporting to JianYing (剪映) for professional video editing!

## Overview

JianYing is a professional video editor popular in China. This integration allows you to:
- Export Screen Story sessions as JianYing-compatible draft projects
- Get intelligent pacing recommendations based on AI relevance scores
- Include AI-generated captions, timestamps, and success indicators
- Use manual import OR automated import via JianYing MCP

## Quick Start

### 1. Export Your Session

```bash
# Export full session
node export-jianying.js screen-story-completion

# Export hero moments only (≥70% relevance)
node export-jianying.js screen-story-completion --hero-only
```

This creates an `exports/<session>/` directory with:
- `jianying-draft.json` - Project structure with timing and overlays
- `IMPORT_INSTRUCTIONS.txt` - Step-by-step manual import guide
- `manifest.json` - Complete session metadata

### 2. Import into JianYing

**Option A: Manual Import** (Works immediately)
1. Open JianYing desktop app
2. Create new project (1920x1080, 30fps recommended)
3. Follow instructions in `IMPORT_INSTRUCTIONS.txt`
4. Drag screenshots to timeline with recommended durations
5. Add text overlays for captions and timestamps

**Option B: Automated Import** (Requires JianYing MCP)
1. Install JianYing MCP server (see below)
2. Use the MCP tools to auto-import the draft
3. All segments, text, and transitions added automatically

## Export Options

```bash
node export-jianying.js <session> [options]

Options:
  --hero-only                  Only export hero moments (≥70% relevance)
  --no-captions                Disable AI caption overlays
  --no-timestamps              Disable timestamp overlays
  --no-transitions             Disable transitions between clips
  --transition <type>          Transition type (crossfade, fade, slide)
  --no-intelligent-pacing      Use fixed duration instead of relevance-based
  --virtual-session <name>     Use virtual session instead
```

## Features

### Intelligent Pacing
Duration for each frame is calculated based on AI relevance score:
- High relevance (≥80%): 2.6-3.0 seconds
- Medium relevance (50-80%): 2.0-2.6 seconds
- Low relevance (<50%): 1.0-2.0 seconds

### Text Overlays
Three types of text overlays are included:
1. **Captions** (bottom) - AI-generated summaries
2. **Timestamps** (top-left) - Time of capture
3. **Success Indicators** (top-right) - ✓ for hero moments

### Transitions
Smooth crossfade transitions (0.3s) between all clips

## JianYing MCP Setup (Optional)

For automated import capabilities:

### 1. Install JianYing MCP Server

Visit: https://glama.ai/mcp/servers/@hey-jian-wei/jianying-mcp

Follow the installation guide to add the MCP server to Claude Desktop.

### 2. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jianying": {
      "command": "npx",
      "args": ["-y", "@hey-jian-wei/jianying-mcp"]
    }
  }
}
```

### 3. Restart Claude Desktop

After restarting, you'll have access to JianYing MCP tools:
- `create_draft` - Initialize projects
- `add_video_segment` - Add clips
- `add_text_segment` - Add captions
- `add_video_transition` - Add transitions
- `export_draft` - Generate final project

## Draft JSON Structure

The exported `jianying-draft.json` contains:

```json
{
  "version": "1.0.0",
  "project": {
    "name": "session-name",
    "resolution": "1920:1080",
    "fps": 30,
    "duration": 70.4
  },
  "tracks": {
    "video": [
      {
        "id": "video_0",
        "path": "/path/to/screenshot.png",
        "startTime": 0,
        "duration": 2.4,
        "track": 0
      }
    ],
    "text": [
      {
        "id": "caption_0",
        "text": "AI summary here",
        "startTime": 0,
        "duration": 2.4,
        "position": "bottom",
        "fontSize": 36,
        "track": 1
      }
    ],
    "transitions": [
      {
        "id": "transition_0",
        "type": "crossfade",
        "duration": 0.3
      }
    ]
  }
}
```

## Examples

### Export with All Features
```bash
node export-jianying.js my-demo
```
→ Creates draft with captions, timestamps, transitions, intelligent pacing

### Minimal Export (Just Video Clips)
```bash
node export-jianying.js my-demo --no-captions --no-timestamps --no-transitions
```
→ Creates simple video sequence for manual editing

### Hero Highlights Reel
```bash
node export-jianying.js my-demo --hero-only
```
→ Only includes screenshots with ≥70% relevance

## Comparison: FFmpeg vs JianYing

| Feature | FFmpeg (built-in) | JianYing Export |
|---------|-------------------|-----------------|
| **Speed** | Fast automated export | Manual editing required |
| **Quality** | Good | Professional |
| **Text overlays** | Limited by command length | Unlimited |
| **Transitions** | Basic fade only | Full library |
| **Visual effects** | Manual filters | Built-in effects |
| **Editing** | Re-render required | Real-time preview |
| **Use case** | Quick demos, testing | Final production videos |

## Workflow Recommendation

**Dual approach for best results:**

1. **During development**: Use FFmpeg for quick iteration
   ```bash
   node create-video.js my-session
   ```

2. **For final demos**: Export to JianYing for polish
   ```bash
   node export-jianying.js my-session --hero-only
   ```

This gives you both speed (FFmpeg) and quality (JianYing).

## Troubleshooting

### "No analyzed screenshots found"
Run analysis first:
```bash
node analyze-session.js <session>
```

### "Session not found"
List available sessions:
```bash
node list-sessions.js
```

### Text overlays not appearing in JianYing
- Check that `--no-captions` wasn't used
- Verify screenshots have AI summaries (check with `analyze-session.js`)
- Ensure JianYing project fps matches (30fps recommended)

## Future Enhancements

With JianYing MCP server connected, we could add:
- One-click auto-import to JianYing
- Batch export multiple sessions
- Custom effect library integration
- Audio track generation
- Advanced animations (zoom, pan)

## Resources

- JianYing MCP: https://glama.ai/mcp/servers/@hey-jian-wei/jianying-mcp
- JianYing Desktop: https://www.capcut.cn/
- Screen Story Docs: README.md
