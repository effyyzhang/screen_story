#!/usr/bin/env node
import ScreenStoryDB from './lib/database.js';
import TaskDetector from './lib/task-detector.js';
import SearchEngine from './lib/search-engine.js';
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

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const sessionName = args[0];
  const options = {
    autoDetect: args.includes('--auto-detect-tasks'),
    search: null,
    createVirtual: null,
    minScreenshots: 3
  };

  // Parse options
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--search') {
      options.search = args[++i];
    } else if (args[i] === '--create-virtual-session') {
      options.createVirtual = args[++i];
    } else if (args[i] === '--min-screenshots') {
      options.minScreenshots = parseInt(args[++i]);
    }
  }

  const db = new ScreenStoryDB();

  try {
    // Get session
    const session = db.getSessionByName(sessionName);
    if (!session) {
      console.error(`❌ Session not found: ${sessionName}`);
      process.exit(1);
    }

    console.log(`\n🔍 Analyzing session: ${session.session_name}`);
    console.log(`   Description: ${session.description || 'N/A'}`);
    console.log(`   Screenshots: ${session.screenshot_count}`);
    console.log(`   Duration: ${formatDuration(session.started_at, session.ended_at)}\n`);

    // Get all analyzed screenshots
    const screenshots = db.getScreenshotsBySession(session.id)
      .filter(s => s.analyzed);

    if (screenshots.length === 0) {
      console.error('❌ No analyzed screenshots found. Run analyze-session.js first.');
      process.exit(1);
    }

    console.log(`✅ Found ${screenshots.length} analyzed screenshots\n`);

    // Mode 1: Auto-detect tasks using AI
    if (options.autoDetect) {
      console.log('🤖 Auto-detecting tasks using AI...\n');

      const detector = new TaskDetector(process.env.ANTHROPIC_API_KEY);
      const tasks = await detector.detectTasks(screenshots);

      console.log(`✅ Detected ${tasks.length} coherent tasks:\n`);

      tasks.forEach((task, idx) => {
        console.log(`${idx + 1}. ${task.task_name}`);
        console.log(`   📝 ${task.description}`);
        console.log(`   📸 ${task.screenshot_count} screenshots`);
        console.log(`   ⏱️  ${formatDuration(task.start_time, task.end_time)}`);
        console.log(`   🖥️  Apps: ${task.apps_used.join(', ')}`);
        console.log(`   ${task.success === true ? '✅' : task.success === false ? '❌' : '🔄'} Success: ${task.success === null ? 'In progress' : task.success ? 'Yes' : 'No'}`);
        console.log(`   📊 Relevance: ${(task.relevance * 100).toFixed(0)}%`);
        console.log('');
      });

      // Offer to create virtual sessions
      if (tasks.length > 0) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💡 Create virtual sessions for these tasks?\n');

        tasks.forEach((task, idx) => {
          const virtualName = `${task.task_name}-${idx + 1}`;
          console.log(`   node group-session.js "${sessionName}" --search="${task.description}" --create-virtual-session="${virtualName}"`);
        });
        console.log('');
      }
    }

    // Mode 2: Search-based grouping
    else if (options.search) {
      console.log(`🔎 Searching for: "${options.search}"\n`);

      const searchEngine = new SearchEngine();
      const results = searchEngine.search(options.search, {
        sessionId: session.id,
        limit: 1000
      });

      console.log(`✅ Found ${results.length} matching screenshots\n`);

      if (results.length < options.minScreenshots) {
        console.log(`⚠️  Too few screenshots (< ${options.minScreenshots}). Try a broader search query.\n`);
        searchEngine.close();
        process.exit(0);
      }

      // Cluster by time
      const clusters = searchEngine.clusterByTime(results);
      const output = searchEngine.formatSearchResults(results, clusters);
      console.log(output);

      // Create virtual session if requested
      if (options.createVirtual) {
        const screenshotIds = results.map(s => s.id);

        const virtualSession = db.createVirtualSession(
          options.createVirtual,
          session.id,
          options.search,
          screenshotIds,
          `Virtual session from search: "${options.search}"`
        );

        console.log(`\n✅ Virtual session created: ${options.createVirtual}`);
        console.log(`   Parent session: ${sessionName}`);
        console.log(`   Screenshots: ${screenshotIds.length}`);
        console.log(`   Search query: "${options.search}"\n`);
        console.log(`Next steps:`);
        console.log(`   node export-session.js "${options.createVirtual}" --hero-only`);
        console.log(`   node create-video.js --session="${options.createVirtual}" --output=demos/${options.createVirtual}.mp4\n`);
      } else {
        console.log(`\n💡 Create virtual session from these results:`);
        console.log(`   node group-session.js "${sessionName}" --search="${options.search}" --create-virtual-session="task-name"\n`);
      }

      searchEngine.close();
    }

    // Mode 3: Show existing virtual sessions
    else {
      const virtualSessions = db.getAllVirtualSessions()
        .filter(vs => vs.parent_session_id === session.id);

      if (virtualSessions.length === 0) {
        console.log('No virtual sessions found for this session.\n');
        console.log('💡 Create virtual sessions using:');
        console.log(`   node group-session.js "${sessionName}" --auto-detect-tasks`);
        console.log(`   node group-session.js "${sessionName}" --search="query" --create-virtual-session="name"\n`);
      } else {
        console.log(`━━━ Virtual Sessions (${virtualSessions.length}) ━━━\n`);

        virtualSessions.forEach((vs, idx) => {
          console.log(`${idx + 1}. ${vs.virtual_session_name}`);
          console.log(`   📝 ${vs.description || 'N/A'}`);
          console.log(`   📸 ${vs.screenshot_count} screenshots`);
          console.log(`   🔍 Search query: "${vs.search_query || 'N/A'}"`);
          console.log(`   ${vs.ai_detected ? '🤖 AI-detected' : '👤 User-created'}`);
          console.log('');
        });

        console.log('💡 Export virtual sessions:');
        virtualSessions.forEach(vs => {
          console.log(`   node export-session.js "${vs.virtual_session_name}" --hero-only`);
        });
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    db.close();
  }
}

function formatDuration(startTime, endTime) {
  if (!endTime) return 'In progress';

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const diffSeconds = Math.floor((end - start) / 1000);

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

function showHelp() {
  console.log(`
🗂️  Screen Story - Retroactive Task Grouping

Usage:
  node group-session.js <session-name> [options]

Modes:

1. Auto-detect tasks using AI (PRIMARY MODE - for continuous recordings):
   node group-session.js "feb-11-work" --auto-detect-tasks

   AI analyzes ALL screenshots and automatically identifies logical task boundaries.
   Creates suggestions for virtual sessions.

2. Search-based grouping:
   node group-session.js "feb-11-work" --search="coffee booking calendar"

   Searches for specific content and shows matching screenshots grouped by time.
   Use --create-virtual-session to save as a virtual session.

3. List existing virtual sessions:
   node group-session.js "feb-11-work"

   Shows all virtual sessions derived from this parent session.

Options:
  --auto-detect-tasks              AI-powered task detection
  --search <query>                 Search for specific content
  --create-virtual-session <name>  Create virtual session from search results
  --min-screenshots <number>       Minimum screenshots for task (default: 3)
  -h, --help                       Show this help

Examples:

  # Continuous recording workflow (PRIMARY USE CASE)
  node session-manager.js start "feb-11-work" --description="Full work day" --continuous
  # ... work on multiple tasks throughout the day ...
  node session-manager.js stop
  node analyze-session.js "feb-11-work"

  # Auto-detect all tasks
  node group-session.js "feb-11-work" --auto-detect-tasks

  # Create specific virtual session
  node group-session.js "feb-11-work" \\
    --search="coffee booking calendar scheduling" \\
    --create-virtual-session="task-coffee-booking"

  # List all virtual sessions
  node group-session.js "feb-11-work"

Virtual Sessions:
  Virtual sessions are derived from parent sessions using search or AI detection.
  They contain a subset of screenshots from the parent session.
  Use them to create focused demo videos from continuous recordings.
`);
}

main();
