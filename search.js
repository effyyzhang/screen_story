#!/usr/bin/env node
import SearchEngine from './lib/search-engine.js';
import ScreenStoryDB from './lib/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options = {
    query: null,
    session: null,
    app: null,
    successOnly: false,
    minRelevance: null,
    startDate: null,
    endDate: null,
    limit: 100,
    createVirtual: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--query' || arg === '-q') {
      options.query = args[++i];
    } else if (arg === '--session' || arg === '-s') {
      options.session = args[++i];
    } else if (arg === '--app' || arg === '-a') {
      options.app = args[++i];
    } else if (arg === '--success-only') {
      options.successOnly = true;
    } else if (arg === '--min-relevance' || arg === '-r') {
      options.minRelevance = parseFloat(args[++i]);
    } else if (arg === '--from') {
      options.startDate = args[++i];
    } else if (arg === '--to') {
      options.endDate = args[++i];
    } else if (arg === '--limit' || arg === '-l') {
      options.limit = parseInt(args[++i]);
    } else if (arg === '--create-virtual-session') {
      options.createVirtual = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else if (!options.query) {
      // First non-flag argument is the query
      options.query = arg;
    }
  }

  if (!options.query && !options.app && !options.session) {
    console.error('❌ Error: Please provide a search query, app filter, or session\n');
    showHelp();
    process.exit(1);
  }

  const searchEngine = new SearchEngine();
  const db = new ScreenStoryDB();

  try {
    // Get session ID if session name provided
    let sessionId = null;
    if (options.session) {
      const session = db.getSessionByName(options.session);
      if (!session) {
        console.error(`❌ Session not found: ${options.session}`);
        process.exit(1);
      }
      sessionId = session.id;
      console.log(`\n🔍 Searching session: ${options.session}`);
      console.log(`   Description: ${session.description || 'N/A'}`);
      console.log(`   Total screenshots: ${session.screenshot_count}\n`);
    }

    // Perform search
    console.log('🔎 Searching...\n');

    const results = searchEngine.search(options.query, {
      sessionId,
      appName: options.app,
      successOnly: options.successOnly,
      minRelevance: options.minRelevance,
      startDate: options.startDate,
      endDate: options.endDate,
      limit: options.limit
    });

    if (results.length === 0) {
      console.log('No results found.\n');
      process.exit(0);
    }

    // Cluster results by time
    const clusters = searchEngine.clusterByTime(results);

    // Display results
    const output = searchEngine.formatSearchResults(results, clusters);
    console.log(output);

    // Show first few screenshots for preview
    console.log('━━━ Preview (first 5 results) ━━━\n');
    results.slice(0, 5).forEach((s, idx) => {
      const time = new Date(s.timestamp).toLocaleTimeString();
      const successIcon = s.is_success === 1 ? '✅' : s.is_success === 0 ? '❌' : '🔄';
      const relevanceBar = '█'.repeat(Math.floor((s.relevance_score || 0.5) * 10)) + '░'.repeat(10 - Math.floor((s.relevance_score || 0.5) * 10));

      console.log(`${idx + 1}. ${successIcon} [${time}] ${s.app_name}`);
      if (s.ai_summary) {
        console.log(`   📝 ${s.ai_summary}`);
      }
      if (s.relevance_score !== null) {
        console.log(`   📊 Relevance: ${relevanceBar} ${(s.relevance_score * 100).toFixed(0)}%`);
      }
      console.log('');
    });

    // Offer to create virtual session
    if (options.createVirtual && sessionId) {
      const screenshotIds = results.map(s => s.id);

      const virtualSession = db.createVirtualSession(
        options.createVirtual,
        sessionId,
        options.query,
        screenshotIds,
        `Virtual session created from search: "${options.query}"`
      );

      console.log(`\n✅ Virtual session created: ${options.createVirtual}`);
      console.log(`   Parent session: ${options.session}`);
      console.log(`   Screenshots: ${screenshotIds.length}`);
      console.log(`   Search query: "${options.query}"\n`);
      console.log(`Next steps:`);
      console.log(`   node export-session.js "${options.createVirtual}" --hero-only`);
      console.log(`   node create-video.js --session="${options.createVirtual}" --output=demos/${options.createVirtual}.mp4\n`);
    } else if (!options.createVirtual && sessionId && results.length > 0) {
      console.log(`\n💡 Tip: Create a virtual session from these results:`);
      console.log(`   node search.js "${options.query}" --session="${options.session}" --create-virtual-session="task-name"\n`);
    }

  } catch (error) {
    console.error('❌ Search error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    searchEngine.close();
    db.close();
  }
}

function showHelp() {
  console.log(`
🔍 Screen Story - Search Tool

Usage:
  node search.js [query] [options]

Examples:
  # Search by content (OCR text or AI summary)
  node search.js "coffee booking"
  node search.js "calendar automation"

  # Search within specific session
  node search.js "error" --session="feb-11-work"

  # Filter by app
  node search.js --app="Google Chrome"

  # Filter by success screens only
  node search.js "automation" --success-only

  # Filter by relevance score
  node search.js "demo" --min-relevance=0.7

  # Date range filter
  node search.js "claude" --from="2026-02-11" --to="2026-02-12"

  # Create virtual session from search results
  node search.js "coffee booking" --session="feb-11-work" --create-virtual-session="task-coffee-booking"

Options:
  -q, --query <text>              Search query (FTS5 full-text search)
  -s, --session <name>            Filter to specific session
  -a, --app <name>                Filter by app name
  --success-only                  Only show success screens
  -r, --min-relevance <0-1>       Minimum relevance score
  --from <date>                   Start date (YYYY-MM-DD)
  --to <date>                     End date (YYYY-MM-DD)
  -l, --limit <number>            Max results (default: 100)
  --create-virtual-session <name> Create virtual session from results
  -h, --help                      Show this help

FTS5 Query Syntax:
  "exact phrase"                  Exact match
  term1 OR term2                  Either term
  term1 AND term2                 Both terms
  term1 NOT term2                 Exclude term2
  prefix*                         Prefix match
`);
}

main();
