# JianYing MCP Server

Local MCP server for automating JianYing (CapCut) video editor imports from Screen Story.

## What It Does

Automatically imports Screen Story video drafts into JianYing/CapCut desktop app:
- ✅ Creates JianYing project from `jianying-draft.json`
- ✅ Copies screenshots to project Resources folder
- ✅ Converts Screen Story format to JianYing format
- ✅ Preserves video timing, text overlays, transitions
- ✅ Lists all JianYing projects

## Installation

Already installed in Claude Desktop! Config at:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

## Usage

### From Screen Story

1. Export your session:
```bash
node export-jianying.js <session-name>
```

2. Use Claude to import:
```
Import my Screen Story draft to JianYing: exports/<session>/jianying-draft.json
```

3. Open JianYing and find your project!

### Available MCP Tools

#### `import_draft`
Import Screen Story draft to JianYing
```javascript
{
  draftPath: "/path/to/jianying-draft.json",
  projectName: "My Video",  // optional
  openInApp: true           // optional, opens JianYing
}
```

#### `list_projects`
List all JianYing projects
```javascript
{}
```

## How It Works

1. **Reads Screen Story export** - Parses `jianying-draft.json`
2. **Creates JianYing project** - Generates proper directory structure:
   ```
   ~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft/<project>/
   ├── draft_info.json          # Main project file
   ├── draft_meta_info.json     # Metadata
   ├── Resources/               # Screenshots copied here
   └── common_attachment/       # Required by JianYing
   ```
3. **Converts format** - Transforms Screen Story JSON → JianYing JSON
4. **Done!** - Project appears in JianYing app

## File Structure

```javascript
// Screen Story format
{
  "project": { "name": "demo", "fps": 30 },
  "tracks": {
    "video": [{ "path": "/path/to/screenshot.png", "duration": 2.5 }],
    "text": [{ "text": "Caption", "startTime": 0, "duration": 2.5 }]
  }
}

// JianYing format
{
  "materials": { "videos": [...], "canvases": [...] },
  "tracks": [{ "type": "video", "segments": [...] }],
  "duration": 5000000  // microseconds
}
```

## Development

Test the MCP server:
```bash
cd jianying-mcp
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node index.js
```

## Troubleshooting

### "JianYing projects directory not found"
Make sure JianYing is installed:
```bash
ls ~/Movies/JianyingPro/User\ Data/Projects/
```

### "Project doesn't appear in JianYing"
1. Restart JianYing app
2. Check project was created: `ls ~/Movies/JianyingPro/User\ Data/Projects/com.lveditor.draft/`

### "Import failed"
Check logs in Claude Desktop or run manually:
```bash
node jianying-mcp/index.js
```

## Next Steps

Potential enhancements:
- [ ] Text overlay support (captions, timestamps)
- [ ] Transition effects
- [ ] Audio track import
- [ ] Smart zoom/pan keyframes
- [ ] Export finished videos back to Screen Story

## License

MIT
