#!/usr/bin/env node

/**
 * Demo Recording Tool
 * Intelligently captures multiple windows for creating demo videos
 */

import MultiWindowCapture from './lib/multi-window-capture.js';
import ScreenStoryDB from './lib/database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  const mode = args[0];

  if (mode === 'list-apps') {
    // List currently running apps
    console.log('🔍 Currently running apps:\n');
    const apps = await MultiWindowCapture.getRunningApps();
    apps.forEach((app, idx) => {
      console.log(`  ${idx + 1}. ${app}`);
    });
    console.log();

  } else if (mode === 'list-windows') {
    // List all windows
    console.log('🪟 All open windows:\n');
    const windows = await MultiWindowCapture.getAllWindows();
    windows.forEach((win, idx) => {
      console.log(`  ${idx + 1}. ${win.appName}: ${win.windowTitle}`);
    });
    console.log();

  } else if (mode === 'capture-app') {
    // Capture specific app
    const appName = args[1];
    if (!appName) {
      console.error('❌ Error: Please specify app name');
      console.log('Usage: node demo-record.js capture-app "Messages"');
      process.exit(1);
    }

    const outputPath = path.join(__dirname, 'videos', `${appName.replace(/\s/g, '_')}_${Date.now()}.png`);

    try {
      await MultiWindowCapture.captureAppWindow(appName, outputPath);
      console.log(`✅ Captured ${appName} to ${outputPath}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }

  } else if (mode === 'smart-record') {
    // Smart recording based on task description
    const taskDescription = args.slice(1).join(' ');
    if (!taskDescription) {
      console.error('❌ Error: Please provide task description');
      console.log('Usage: node demo-record.js smart-record "Send iMessage to John"');
      process.exit(1);
    }

    const sessionName = `demo_${Date.now()}`;
    const outputDir = path.join(__dirname, 'sessions', sessionName);

    console.log(`🎬 Smart Recording Mode`);
    console.log(`Task: ${taskDescription}`);
    console.log(`Output: ${outputDir}\n`);

    // Predict and show apps
    const predictedApps = MultiWindowCapture.predictAppsForTask(taskDescription);
    console.log('📱 Predicted apps to monitor:');
    predictedApps.forEach(app => console.log(`   • ${app}`));
    console.log();

    console.log('🔴 Recording for 30 seconds...\n');

    const result = await MultiWindowCapture.monitorTaskWindows(
      taskDescription,
      outputDir,
      {
        interval: 5000,
        duration: 30000,
        captureActive: true,
        onCapture: (info) => {
          const successCount = info.results.filter(r => r.success).length;
          console.log(`  Frame ${info.frameNumber}: Active + ${successCount}/${info.results.length} background apps`);
        }
      }
    );

    console.log('\n✅ Recording complete!');
    console.log(`   Total frames: ${result.totalCaptures}`);
    console.log(`   Apps monitored: ${result.appsMonitored.join(', ')}`);
    console.log(`   Output: ${outputDir}\n`);

    console.log('💡 Next steps:');
    console.log(`   1. Analyze: node analyze-session.js ${sessionName}`);
    console.log(`   2. Create video: node create-video.js ${sessionName}`);

  } else if (mode === 'manual-record') {
    // Manual recording with specified apps
    const apps = args.slice(1);
    if (apps.length === 0) {
      console.error('❌ Error: Please specify apps to capture');
      console.log('Usage: node demo-record.js manual-record "Messages" "Google Chrome"');
      process.exit(1);
    }

    const sessionName = `demo_${Date.now()}`;
    const outputDir = path.join(__dirname, 'sessions', sessionName);

    console.log(`🎬 Manual Recording Mode`);
    console.log(`Apps: ${apps.join(', ')}`);
    console.log(`Output: ${outputDir}\n`);

    console.log('🔴 Recording for 30 seconds...\n');

    const result = await MultiWindowCapture.monitorTaskWindows(
      '', // No task description
      outputDir,
      {
        interval: 5000,
        duration: 30000,
        captureActive: true,
        onCapture: (info) => {
          const successCount = info.results.filter(r => r.success).length;
          console.log(`  Frame ${info.frameNumber}: Active + ${successCount}/${apps.length} apps`);
        }
      }
    );

    // Override predicted apps with manual list
    console.log('\n✅ Recording complete!');
    console.log(`   Total frames: ${result.totalCaptures}`);
    console.log(`   Output: ${outputDir}\n`);

  } else {
    console.error(`❌ Unknown mode: ${mode}`);
    showHelp();
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
🎬 Screen Story - Demo Recording Tool

Intelligently capture multiple windows for demo videos

Usage:
  node demo-record.js <mode> [options]

Modes:

  list-apps
    List all currently running apps
    Example: node demo-record.js list-apps

  list-windows
    List all open windows with titles
    Example: node demo-record.js list-windows

  capture-app <app-name>
    Capture a single app window (one-time snapshot)
    Example: node demo-record.js capture-app "Messages"
    Example: node demo-record.js capture-app "Google Chrome"

  smart-record <task-description>
    AI-powered recording that predicts which apps to monitor based on your task
    Example: node demo-record.js smart-record "Send iMessage to John"
    Example: node demo-record.js smart-record "Debug web application in Chrome"
    Example: node demo-record.js smart-record "Create calendar event and notify team"

  manual-record <app1> <app2> ...
    Manually specify which apps to monitor during recording
    Example: node demo-record.js manual-record "Messages" "Terminal"
    Example: node demo-record.js manual-record "Chrome" "VSCode" "iTerm2"

How Smart Record Works:

  1. Analyzes your task description
  2. Predicts relevant apps (e.g., "send iMessage" → Terminal + Messages)
  3. Captures both active window + background app windows every 5 seconds
  4. Saves all screenshots for video creation

Task Keywords:
  - "message/imessage" → Monitors Messages app
  - "slack" → Monitors Slack
  - "email/mail" → Monitors Mail app
  - "browser/web/chrome" → Monitors Chrome, Safari, Firefox
  - "code/debug" → Monitors VSCode, Cursor, Xcode
  - "terminal/cli/command" → Monitors Terminal, iTerm2, ghostty
  - "calendar/meeting" → Monitors Calendar
  - "note/document" → Monitors Notes, Notion

Examples:

  # Demo: Agent sends iMessage
  node demo-record.js smart-record "Use AI agent to send iMessage"
  → Captures: Terminal (agent command) + Messages (result)

  # Demo: Web debugging
  node demo-record.js smart-record "Debug React app in Chrome DevTools"
  → Captures: VSCode (code) + Chrome (app) + Terminal (logs)

  # Manual control: Specific apps
  node demo-record.js manual-record "Slack" "Notion" "Calendar"
  → Captures: Active window + Slack + Notion + Calendar every 5s
`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
