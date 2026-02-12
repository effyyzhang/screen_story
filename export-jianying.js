#!/usr/bin/env node

/**
 * JianYing Export Tool
 * Export Screen Story sessions to JianYing-compatible formats
 */

import ScreenStoryDB from './lib/database.js';
import JianyingExport from './lib/jianying-export.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  const options = {
    session: null,
    virtualSession: null,
    heroOnly: false,
    addCaptions: true,
    addTimestamps: true,
    addTransitions: true,
    transitionType: 'crossfade',
    intelligentPacing: true,
    minDuration: 1.0,
    maxDuration: 3.0
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--virtual-session') options.virtualSession = args[++i];
    else if (args[i] === '--hero-only') options.heroOnly = true;
    else if (args[i] === '--no-captions') options.addCaptions = false;
    else if (args[i] === '--no-timestamps') options.addTimestamps = false;
    else if (args[i] === '--no-transitions') options.addTransitions = false;
    else if (args[i] === '--transition') options.transitionType = args[++i];
    else if (args[i] === '--no-intelligent-pacing') options.intelligentPacing = false;
    else if (!options.session) options.session = args[i];
  }

  if (!options.session && !options.virtualSession) {
    console.error('❌ Error: Please specify a session name');
    showHelp();
    process.exit(1);
  }

  const db = new ScreenStoryDB();

  try {
    let screenshots = [];
    let sessionName = '';

    // Get screenshots from session or virtual session
    if (options.virtualSession) {
      const vs = db.getVirtualSession(options.virtualSession);
      if (!vs) throw new Error('Virtual session not found: ' + options.virtualSession);
      sessionName = options.virtualSession;
      const ids = JSON.parse(vs.screenshot_ids);
      screenshots = ids.map(id => db.db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id)).filter(Boolean);
    } else {
      const session = db.getSessionByName(options.session);
      if (!session) throw new Error('Session not found: ' + options.session);
      sessionName = options.session;
      screenshots = db.getScreenshotsBySession(session.id).filter(s => s.analyzed);
    }

    if (screenshots.length === 0) throw new Error('No analyzed screenshots found');

    // Filter for hero-only if requested
    if (options.heroOnly) {
      screenshots = screenshots.filter(s => s.relevance_score >= 0.7);
      console.log(`Hero-only mode: ${screenshots.length} screenshots selected (≥70% relevance)\n`);
    }

    screenshots.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    console.log(`🎬 Exporting session: ${sessionName}`);
    console.log(`   Screenshots: ${screenshots.length}`);
    console.log(`   Format: JianYing draft + instructions\n`);

    // Export to multiple formats
    const results = await JianyingExport.exportMultiFormat(screenshots, sessionName, options);

    console.log('💡 Next steps:');
    console.log('   1. Open JianYing desktop app');
    console.log('   2. Follow instructions in IMPORT_INSTRUCTIONS.txt');
    console.log('   3. Or use JianYing MCP (if connected) to auto-import\n');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

function showHelp() {
  console.log(`
🎬 Screen Story - JianYing Export Tool

Export sessions to JianYing-compatible draft projects for professional video editing

Usage:
  node export-jianying.js <session> [options]

Examples:
  # Export full session
  node export-jianying.js screen-story-completion

  # Export hero moments only
  node export-jianying.js screen-story-completion --hero-only

  # Minimal export (no text overlays)
  node export-jianying.js my-session --no-captions --no-timestamps

  # Custom transitions
  node export-jianying.js my-session --transition fade

Options:
  --hero-only                  Only export hero moments (≥70% relevance)
  --no-captions                Disable AI caption overlays
  --no-timestamps              Disable timestamp overlays
  --no-transitions             Disable transitions between clips
  --transition <type>          Transition type (crossfade, fade, slide)
  --no-intelligent-pacing      Use fixed duration instead of relevance-based
  --virtual-session <name>     Use virtual session instead

Output:
  Creates exports/<session>/ directory with:
    - jianying-draft.json        JianYing-compatible project file
    - IMPORT_INSTRUCTIONS.txt    Manual import guide
    - manifest.json              Complete session metadata

JianYing MCP Integration:
  If you have the JianYing MCP server connected to Claude Desktop, the draft
  can be automatically imported. Otherwise, use the manual instructions.

  To add JianYing MCP to Claude Desktop:
  1. Visit: https://glama.ai/mcp/servers/@hey-jian-wei/jianying-mcp
  2. Follow installation instructions
  3. Restart Claude Desktop
  4. The MCP tools will be available for auto-import
`);
}

main();
