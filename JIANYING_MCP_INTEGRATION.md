# JianYing MCP Integration - Complete Guide

## Current Status

✅ **Phase 1: Configuration Complete**
- JianYing MCP server configured in Claude Desktop config
- MCP wrapper module created (`lib/jianying-mcp-wrapper.js`)
- Video assembly service created (`lib/video-assembly.js`)
- UI integration complete (Create Video button + modal)
- API endpoint ready (`/api/video/assemble`)

⚠️ **Phase 2: Activation Needed**
- **Action Required**: Restart Claude Desktop to load JianYing MCP server
- Once restarted, JianYing MCP tools will be available in Claude sessions

🔄 **Phase 3: Testing & Refinement**
- Test JianYing MCP tools with sample session
- Refine MCP wrapper based on actual tool behavior
- Complete end-to-end workflow

---

## How to Complete the Integration

### Step 1: Restart Claude Desktop

**You need to quit and restart Claude Desktop** for the new MCP configuration to take effect.

```bash
# Option 1: Use macOS UI
# Cmd+Q to quit Claude Desktop, then relaunch

# Option 2: Force quit and restart
killall Claude
open -a Claude
```

After restart, the JianYing MCP server should be loaded and available.

### Step 2: Test JianYing MCP Tools

Once Claude Desktop is restarted, you can test the JianYing MCP integration in a new Claude session:

**Ask Claude:**
> "What JianYing MCP tools are available? List all tools with their parameters."

Expected tools (based on @hey-jian-wei/jianying-mcp):
- `create_project` - Create new JianYing project
- `import_media` - Import images/videos to project
- `add_to_timeline` - Add clips to timeline with timing
- `add_text_overlay` - Add text/captions
- `export_project` - Export final video or draft

### Step 3: Update MCP Wrapper (Once Tools Confirmed)

After discovering available tools, update `lib/jianying-mcp-wrapper.js` to call them properly.

**Example implementation:**

```javascript
async createProject(options) {
  const { frames, projectName, settings = {} } = options;

  try {
    // Use Claude MCP to call JianYing tools
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      tools: [], // JianYing MCP tools will be injected automatically
      messages: [{
        role: 'user',
        content: `Create a JianYing video project named "${projectName}" with these specifications:

- Resolution: ${settings.resolution || '1920x1080'}
- FPS: ${settings.fps || 30}
- Number of frames: ${frames.length}

For each frame, add to timeline:
${frames.map((f, i) => `
Frame ${i + 1}:
- Image: ${f.path}
- Duration: ${f.duration}s
- Caption: ${f.caption || 'No caption'}
`).join('\n')}

Add smooth crossfade transitions (0.3s) between clips.
Export as draft project file.`
      }]
    });

    // Parse response and extract project path
    return {
      success: true,
      projectPath: '/path/to/jianying/draft.json',
      message: 'Project created successfully'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      fallback: 'manual'
    };
  }
}
```

### Step 4: Test End-to-End Workflow

1. **Create a test video from the UI:**
   - Open http://localhost:3000 (or Electron app)
   - Click "📹 Create Video"
   - Select session: "screen-story-completion" (30 frames)
   - Mode: "Hero Moments"
   - Format: "JianYing Project (experimental)"
   - Click "Create Video"

2. **Expected behavior:**
   - API calls `/api/video/assemble`
   - VideoAssembly selects ~20 hero frames
   - Applies auto-cropping to windowed frames
   - JianYingMCP wrapper creates project via MCP tools
   - Returns project path and stats
   - *(Ideal)* JianYing desktop app opens with project

3. **Fallback if MCP fails:**
   - System falls back to FFmpeg MP4 export
   - User gets functional video immediately
   - Error message explains MCP limitation

---

## Current Workflow (Without MCP)

**What works RIGHT NOW** (before MCP activation):

1. Click "📹 Create Video" → Select session → Choose "MP4 Video"
2. API endpoint calls VideoAssembly service
3. Selects hero frames (relevance >= 0.7)
4. Auto-crops windowed screenshots
5. Calls existing `create-enhanced-video.js` via FFmpeg
6. Returns MP4 video with stats

**Output:** Professional MP4 video with intelligent frame selection!

---

## Integration Architecture

```
┌─────────────────────────────────────────────────┐
│  Screen Story UI                                │
│  - "Create Video" button                        │
│  - Modal with options (mode, format, cropping)  │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│  API Endpoint: /api/video/assemble              │
│  - Receives: sessionName, mode, autoCrop        │
│  - Returns: outputPath, stats                   │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│  VideoAssembly Service                          │
│  - selectFrames() → queries by relevance        │
│  - prepareFrames() → applies auto-cropping      │
│  - getStats() → calculates metrics              │
└─────────┬──────────────────────┬────────────────┘
          │                      │
          v                      v
┌──────────────────┐   ┌─────────────────────────┐
│  JianYingMCP     │   │  FFmpeg Export          │
│  (via MCP tools) │   │  (fallback)             │
│  - Creates draft │   │  - create-enhanced-     │
│  - Auto-imports  │   │    video.js             │
│  - Returns path  │   │  - Returns MP4          │
└──────────────────┘   └─────────────────────────┘
```

---

## Next Actions

**Immediate (You):**
1. ✅ Restart Claude Desktop
2. ✅ Verify JianYing MCP server loaded (check Claude logs or new session)

**Then (Claude/You):**
3. ✅ Discover available JianYing MCP tools
4. ✅ Update `jianying-mcp-wrapper.js` with actual tool calls
5. ✅ Test JianYing format option in UI
6. ✅ Refine based on results

**Future Enhancements:**
- Direct JianYing desktop app integration
- Real-time project preview
- Custom transitions and effects
- Audio track support
- Batch processing multiple sessions

---

## Troubleshooting

### Issue: JianYing format returns "experimental" error

**Cause:** MCP wrapper not fully implemented yet

**Solution:**
1. Use "MP4 Video (FFmpeg)" format (works perfectly!)
2. OR complete MCP wrapper implementation after confirming tools
3. OR use manual export: `node export-jianying.js <session>`

### Issue: MCP server not loading

**Cause:** Claude Desktop config not refreshed

**Solution:**
1. Verify config file: `cat ~/Library/Application\ Support/Claude/claude_desktop_config.json`
2. Should show `"jianying"` in `mcpServers` section
3. Completely quit Claude Desktop (Cmd+Q, not just close window)
4. Restart Claude Desktop
5. Check MCP server status in new session

### Issue: Auto-cropping not working

**Cause:** Screenshots may all be fullscreen

**Solution:**
1. Check database: `SELECT COUNT(*) FROM screenshots WHERE is_fullscreen = 0`
2. Capture new session with windowed apps (Calculator, Terminal)
3. Verify window bounds stored: `SELECT window_width, window_height FROM screenshots LIMIT 5`

---

## Files Modified/Created

**New Files:**
- `lib/jianying-mcp-wrapper.js` - MCP API wrapper
- `lib/video-assembly.js` - Smart frame selection service
- `JIANYING_MCP_INTEGRATION.md` - This guide

**Modified Files:**
- `~/Library/Application Support/Claude/claude_desktop_config.json` - MCP config
- `server.js` - Added `/api/video/assemble` endpoint
- `ui/index.html` - Added video modal
- `ui/app.js` - Added video assembly UI logic
- `ui/styles.css` - Added progress bar styles

**Existing Files (Reused):**
- `lib/screenshot.js` - `cropToWindow()` method
- `lib/database.js` - Hero frame queries
- `create-enhanced-video.js` - FFmpeg fallback
- `export-jianying.js` - Manual export workflow

---

## Success Metrics

✅ **MVP Complete:**
- [x] AI-powered frame selection (hero/super-hero/all)
- [x] Auto-cropping for windowed screenshots
- [x] FFmpeg video export working
- [x] Beautiful UI with progress tracking
- [x] Stats reporting (frame count, duration, relevance)

🎯 **MCP Integration Goals:**
- [ ] JianYing MCP server activated (restart Claude Desktop)
- [ ] JianYing draft creation via MCP tools
- [ ] Auto-import to JianYing desktop app
- [ ] End-to-end test successful

---

## Resources

- **JianYing MCP Server:** https://glama.ai/mcp/servers/@hey-jian-wei/jianying-mcp
- **Anthropic MCP Docs:** https://docs.anthropic.com/en/docs/model-context-protocol
- **Screen Story Docs:** `JIANYING_INTEGRATION.md` (existing manual workflow)
- **FFmpeg Export:** `create-enhanced-video.js` (working fallback)

---

**Ready to complete the integration!** Restart Claude Desktop and let's test the MCP tools. 🚀
