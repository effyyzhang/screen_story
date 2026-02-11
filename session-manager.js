#!/usr/bin/env node
import ScreenStoryDB from './lib/database.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new ScreenStoryDB();

// Parse command line arguments
const command = process.argv[2];
const args = process.argv.slice(3);

async function startSession() {
  const sessionName = args[0];
  const descriptionFlag = args.find(arg => arg.startsWith('--description='));
  const isContinuous = args.includes('--continuous');

  if (!sessionName) {
    console.error('❌ Usage: node session-manager.js start <session-name> [--description="..."] [--continuous]');
    process.exit(1);
  }

  // Check if session already exists
  const existing = db.getSessionByName(sessionName);
  if (existing) {
    console.error(`❌ Session "${sessionName}" already exists`);
    process.exit(1);
  }

  // Check if there's already an active session
  const active = db.getActiveSession();
  if (active) {
    console.error(`❌ Session "${active.session_name}" is already recording`);
    console.error('   Stop it first with: node session-manager.js stop');
    process.exit(1);
  }

  const description = descriptionFlag ? descriptionFlag.split('=')[1].replace(/['"]/g, '') : null;

  // Create session in database
  const sessionId = db.createSession(sessionName, description, isContinuous);

  // Create session directory
  const sessionDir = path.join(__dirname, 'sessions', sessionName);
  await fs.mkdir(sessionDir, { recursive: true });

  console.log('🎬 Screen Story - Session Started\n');
  console.log(`📝 Session: ${sessionName}`);
  if (description) {
    console.log(`📋 Description: ${description}`);
  }
  console.log(`🔄 Mode: ${isContinuous ? 'Continuous Recording (all-day)' : 'Task-Focused'}`);
  console.log(`📁 Directory: ${sessionDir}`);
  console.log(`🆔 Session ID: ${sessionId}\n`);
  console.log('✅ Recording started! Screenshots will be captured every 10 seconds.');
  console.log('   Stop with: node session-manager.js stop\n');
}

async function stopSession() {
  const active = db.getActiveSession();

  if (!active) {
    console.error('❌ No active recording session');
    process.exit(1);
  }

  db.stopSession(active.id);

  // Get final stats
  const screenshots = db.getScreenshotsBySession(active.id);
  const duration = new Date(active.ended_at || new Date()) - new Date(active.started_at);
  const durationMin = Math.floor(duration / 1000 / 60);
  const apps = [...new Set(screenshots.map(s => s.app_name))];

  console.log('🛑 Screen Story - Session Stopped\n');
  console.log(`📝 Session: ${active.session_name}`);
  console.log(`⏱️  Duration: ${durationMin} minutes`);
  console.log(`📸 Screenshots: ${screenshots.length}`);
  console.log(`🖥️  Apps Used: ${apps.length} (${apps.join(', ')})\n`);
  console.log('✅ Session stopped successfully!');
  console.log(`   Analyze with: node analyze-session.js "${active.session_name}"\n`);
}

async function listSessions() {
  const sessions = db.getAllSessions();
  const virtualSessions = args.includes('--virtual') ? db.getAllVirtualSessions() : [];

  console.log('📊 Screen Story - All Sessions\n');

  if (sessions.length === 0 && virtualSessions.length === 0) {
    console.log('No sessions found.');
    console.log('Start a new session with: node session-manager.js start <session-name>\n');
    return;
  }

  // Physical sessions
  if (sessions.length > 0) {
    console.log('━━━ Physical Sessions ━━━\n');
    sessions.forEach(session => {
      const status = session.status === 'recording' ? '🔴 RECORDING' : '⚫ Stopped';
      const duration = session.ended_at
        ? Math.floor((new Date(session.ended_at) - new Date(session.started_at)) / 1000 / 60)
        : '...';

      console.log(`${status} ${session.session_name}`);
      if (session.description) {
        console.log(`   📋 ${session.description}`);
      }
      console.log(`   📸 ${session.screenshot_count} screenshots | ⏱️  ${duration} min`);
      console.log(`   🕐 Started: ${new Date(session.started_at).toLocaleString()}`);
      console.log('');
    });
  }

  // Virtual sessions
  if (virtualSessions.length > 0) {
    console.log('━━━ Virtual Sessions (Retroactively Created) ━━━\n');
    virtualSessions.forEach(vsession => {
      const parentSession = db.getSessionByName(vsession.parent_session_id);
      const icon = vsession.ai_detected ? '🤖' : '🔍';

      console.log(`${icon} ${vsession.virtual_session_name}`);
      if (vsession.description) {
        console.log(`   📋 ${vsession.description}`);
      }
      console.log(`   📸 ${vsession.screenshot_count} screenshots`);
      console.log(`   🔗 Parent: ${parentSession?.session_name || 'Unknown'}`);
      if (vsession.search_query) {
        console.log(`   🔎 Query: ${vsession.search_query}`);
      }
      console.log('');
    });
  }
}

async function showSession() {
  const sessionName = args[0];

  if (!sessionName) {
    console.error('❌ Usage: node session-manager.js show <session-name>');
    process.exit(1);
  }

  const session = db.getSessionByName(sessionName);

  if (!session) {
    console.error(`❌ Session "${sessionName}" not found`);
    process.exit(1);
  }

  const screenshots = db.getScreenshotsBySession(session.id);
  const duration = session.ended_at
    ? new Date(session.ended_at) - new Date(session.started_at)
    : new Date() - new Date(session.started_at);
  const durationMin = Math.floor(duration / 1000 / 60);
  const durationHours = Math.floor(durationMin / 60);
  const durationRemainingMin = durationMin % 60;

  const apps = [...new Set(screenshots.map(s => s.app_name))];
  const analyzedCount = screenshots.filter(s => s.analyzed).length;

  console.log('📊 Screen Story - Session Details\n');
  console.log(`📝 Session: ${session.session_name}`);
  if (session.description) {
    console.log(`📋 Description: ${session.description}`);
  }
  console.log(`🔄 Mode: ${session.is_continuous ? 'Continuous Recording' : 'Task-Focused'}`);
  console.log(`📌 Status: ${session.status === 'recording' ? '🔴 RECORDING' : '⚫ Stopped'}`);
  console.log(`⏱️  Duration: ${durationHours}h ${durationRemainingMin}m`);
  console.log(`📸 Screenshots: ${screenshots.length}`);
  console.log(`🔍 Analyzed: ${analyzedCount}/${screenshots.length}`);
  console.log(`🖥️  Apps Used: ${apps.length}`);
  console.log(`   ${apps.join(', ')}`);
  console.log(`🕐 Started: ${new Date(session.started_at).toLocaleString()}`);
  if (session.ended_at) {
    console.log(`🕐 Ended: ${new Date(session.ended_at).toLocaleString()}`);
  }
  console.log('');

  // Show next steps
  if (session.status !== 'recording') {
    if (analyzedCount === 0) {
      console.log('💡 Next steps:');
      console.log(`   node analyze-session.js "${sessionName}"`);
    } else if (session.is_continuous) {
      console.log('💡 Next steps:');
      console.log(`   node group-session.js "${sessionName}" --auto-detect-tasks`);
      console.log(`   node summarize-day.js "${sessionName}"`);
    } else {
      console.log('💡 Next steps:');
      console.log(`   node export-session.js "${sessionName}" --hero-only`);
      console.log(`   node create-video.js --session="${sessionName}"`);
    }
    console.log('');
  }
}

async function getStatus() {
  const active = db.getActiveSession();

  console.log('📊 Screen Story - Status\n');

  if (!active) {
    console.log('⚫ No active recording session\n');
    console.log('Start a new session with:');
    console.log('   node session-manager.js start <session-name>\n');
    return;
  }

  const screenshots = db.getScreenshotsBySession(active.id);
  const duration = new Date() - new Date(active.started_at);
  const durationMin = Math.floor(duration / 1000 / 60);
  const lastScreenshot = screenshots[screenshots.length - 1];

  console.log('🔴 RECORDING\n');
  console.log(`📝 Session: ${active.session_name}`);
  if (active.description) {
    console.log(`📋 Description: ${active.description}`);
  }
  console.log(`⏱️  Duration: ${durationMin} minutes`);
  console.log(`📸 Screenshots: ${screenshots.length}`);
  if (lastScreenshot) {
    console.log(`🕐 Last capture: ${new Date(lastScreenshot.timestamp).toLocaleTimeString()}`);
    console.log(`🖥️  Current app: ${lastScreenshot.app_name}`);
  }
  console.log('');
  console.log('Stop with: node session-manager.js stop\n');
}

// Main command router
async function main() {
  try {
    switch (command) {
      case 'start':
        await startSession();
        break;
      case 'stop':
        await stopSession();
        break;
      case 'list':
        await listSessions();
        break;
      case 'show':
        await showSession();
        break;
      case 'status':
        await getStatus();
        break;
      default:
        console.log('🎬 Screen Story - Session Manager\n');
        console.log('Usage:');
        console.log('  node session-manager.js start <session-name> [--description="..."] [--continuous]');
        console.log('  node session-manager.js stop');
        console.log('  node session-manager.js list [--virtual]');
        console.log('  node session-manager.js show <session-name>');
        console.log('  node session-manager.js status');
        console.log('');
        console.log('Examples:');
        console.log('  # Task-focused recording');
        console.log('  node session-manager.js start "book-coffee-chat" --description="Booking coffee via AI"');
        console.log('');
        console.log('  # Continuous all-day recording');
        console.log('  node session-manager.js start "feb-11-work" --description="Full work day" --continuous');
        console.log('');
        process.exit(1);
    }

    db.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    db.close();
    process.exit(1);
  }
}

main();
