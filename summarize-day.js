#!/usr/bin/env node
import ScreenStoryDB from './lib/database.js';
import TaskDetector from './lib/task-detector.js';
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
  const db = new ScreenStoryDB();

  try {
    // Get session
    const session = db.getSessionByName(sessionName);
    if (!session) {
      console.error(`❌ Session not found: ${sessionName}`);
      process.exit(1);
    }

    // Get all analyzed screenshots
    const screenshots = db.getScreenshotsBySession(session.id)
      .filter(s => s.analyzed);

    if (screenshots.length === 0) {
      console.error('❌ No analyzed screenshots found. Run analyze-session.js first.');
      process.exit(1);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Work Session Summary: ${session.session_name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Basic stats
    const duration = formatDuration(session.started_at, session.ended_at);
    const uniqueApps = new Set(screenshots.map(s => s.app_name));

    console.log(`⏱️  Duration: ${duration}`);
    console.log(`📸 Screenshots: ${screenshots.length}`);
    console.log(`🖥️  Apps Used: ${uniqueApps.size}`);

    // Auto-detect tasks
    console.log('\n🤖 Detecting tasks...\n');

    const detector = new TaskDetector(process.env.ANTHROPIC_API_KEY);
    const tasks = await detector.detectTasks(screenshots);

    console.log(`📱 Tasks Detected: ${tasks.length}\n`);

    // Task breakdown
    if (tasks.length > 0) {
      console.log('━━━ Tasks Breakdown ━━━');

      tasks.forEach((task, idx) => {
        const emoji = task.success === true ? '✅' : task.success === false ? '❌' : '🔄';
        const relevanceLabel = task.relevance > 0.7 ? 'High (demo-worthy)' : task.relevance > 0.4 ? 'Medium' : 'Low (routine work)';

        console.log(`${idx + 1}. ${emoji} ${task.task_name} (${task.screenshot_count} screenshots, ${formatDuration(task.start_time, task.end_time)})`);
        console.log(`   Status: ${task.success === true ? '✅ Success' : task.success === false ? '❌ Failed' : '🔄 In Progress'}`);
        console.log(`   Relevance: ${relevanceLabel}`);
        console.log('');
      });
    }

    // App distribution
    console.log('━━━ Productivity Insights ━━━');

    const completedTasks = tasks.filter(t => t.success === true).length;
    const failedTasks = tasks.filter(t => t.success === false).length;
    const inProgressTasks = tasks.filter(t => t.success === null).length;

    console.log(`✅ ${completedTasks}/${tasks.length} tasks completed successfully`);
    if (failedTasks > 0) {
      console.log(`❌ ${failedTasks} tasks failed/incomplete`);
    }
    if (inProgressTasks > 0) {
      console.log(`🔄 ${inProgressTasks} tasks in progress`);
    }

    // Demo-worthy moments
    const demoWorthy = tasks.filter(t => t.relevance > 0.7);
    if (demoWorthy.length > 0) {
      console.log(`🎯 Demo-worthy moments: ${demoWorthy.length}`);
      demoWorthy.forEach(t => {
        console.log(`   - ${t.task_name}`);
      });
    }

    // App time distribution
    console.log('\n📊 App distribution:');
    const appCounts = {};
    screenshots.forEach(s => {
      appCounts[s.app_name] = (appCounts[s.app_name] || 0) + 1;
    });

    const totalDurationSeconds = getDurationInSeconds(session.started_at, session.ended_at);
    const secondsPerScreenshot = totalDurationSeconds / screenshots.length;

    Object.entries(appCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([app, count]) => {
        const percentage = ((count / screenshots.length) * 100).toFixed(0);
        const timeSpent = formatSeconds(count * secondsPerScreenshot);
        console.log(`   - ${app}: ${percentage}% (${timeSpent})`);
      });

    // Suggestions
    console.log('\n💡 Suggestions:');
    if (demoWorthy.length > 0) {
      console.log(`   - ${demoWorthy.length} task${demoWorthy.length > 1 ? 's are' : ' is'} ready for demo export`);
    }
    if (failedTasks > 0) {
      console.log(`   - Review failed tasks for potential improvements`);
    }
    if (inProgressTasks > 0) {
      console.log(`   - Consider completing in-progress tasks`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Next steps
    if (tasks.length > 0) {
      console.log('💡 Next Steps:\n');
      console.log('1. Create virtual sessions for demo-worthy tasks:');
      demoWorthy.forEach(t => {
        console.log(`   node group-session.js "${sessionName}" --search="${t.description}" --create-virtual-session="${t.task_name}"`);
      });
      console.log('\n2. Export virtual sessions as videos:');
      demoWorthy.forEach(t => {
        console.log(`   node export-session.js "${t.task_name}" --hero-only`);
      });
      console.log('');
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

  const diffSeconds = getDurationInSeconds(startTime, endTime);
  return formatSeconds(diffSeconds);
}

function getDurationInSeconds(startTime, endTime) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.floor((end - start) / 1000);
}

function formatSeconds(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function showHelp() {
  console.log(`
📊 Screen Story - Daily Summary

Usage:
  node summarize-day.js <session-name>

Examples:
  node summarize-day.js "feb-11-work"
  node summarize-day.js "monday-session"

This tool provides:
  - Work session duration and statistics
  - Auto-detected tasks with success/failure status
  - Relevance scoring for demo-worthiness
  - App usage distribution
  - Productivity insights
  - Suggestions for next steps

Workflow:
  1. Record continuous session:
     node session-manager.js start "feb-11-work" --continuous

  2. Analyze screenshots:
     node analyze-session.js "feb-11-work"

  3. Generate daily summary:
     node summarize-day.js "feb-11-work"

  4. Create virtual sessions for demos:
     node group-session.js "feb-11-work" --auto-detect-tasks
`);
}

main();
