#!/usr/bin/env node
// Demo script for Phase 3 - Shows search and grouping capabilities

import SearchEngine from './lib/search-engine.js';
import ScreenStoryDB from './lib/database.js';

console.log('🎬 Screen Story - Phase 3 Demo\n');
console.log('This demo shows the search and retroactive grouping capabilities\n');

const db = new ScreenStoryDB();
const searchEngine = new SearchEngine();

// Create demo data
console.log('📦 Creating demo session with sample data...\n');

// Create a demo session
const sessionId = db.createSession(
  'demo-continuous-work',
  'Full work day with multiple tasks',
  true // continuous
);

console.log(`✅ Created session: demo-continuous-work (ID: ${sessionId})\n`);

// Add sample screenshots with different characteristics
const sampleScreenshots = [
  // Task 1: Coffee booking (9:14-9:22 AM)
  {
    frameNumber: 1,
    timestamp: '2026-02-11 09:14:00',
    appName: 'Notion',
    windowTitle: 'Tasks',
    ocrText: 'Book coffee chat with John\nSchedule for this Friday 2pm',
    aiSummary: 'Reading task from Notion dashboard',
    isSuccess: null,
    relevanceScore: 0.6,
    tags: ['notion', 'task', 'planning']
  },
  {
    frameNumber: 2,
    timestamp: '2026-02-11 09:15:30',
    appName: 'Terminal',
    windowTitle: 'zsh',
    ocrText: 'claude-agent run schedule-meeting',
    aiSummary: 'Running Claude Agent SDK to automate calendar booking',
    isSuccess: null,
    relevanceScore: 0.8,
    tags: ['terminal', 'automation', 'claude']
  },
  {
    frameNumber: 3,
    timestamp: '2026-02-11 09:17:00',
    appName: 'Google Chrome',
    windowTitle: 'Google Calendar',
    ocrText: 'Error: Permission denied\nCalendar API requires authentication',
    aiSummary: 'Calendar API error - permission denied',
    isSuccess: 0,
    relevanceScore: 0.9,
    tags: ['error', 'calendar', 'retry']
  },
  {
    frameNumber: 4,
    timestamp: '2026-02-11 09:19:00',
    appName: 'Terminal',
    windowTitle: 'zsh',
    ocrText: 'Authenticating with Google Calendar API...\nAuthentication successful',
    aiSummary: 'Successfully authenticated with Calendar API',
    isSuccess: null,
    relevanceScore: 0.7,
    tags: ['terminal', 'authentication', 'success']
  },
  {
    frameNumber: 5,
    timestamp: '2026-02-11 09:22:00',
    appName: 'Google Chrome',
    windowTitle: 'Google Calendar',
    ocrText: 'Event created successfully\nCoffee Chat with John\nFriday, Feb 14 2:00 PM',
    aiSummary: 'Calendar event created successfully for coffee chat',
    isSuccess: 1,
    relevanceScore: 1.0,
    tags: ['calendar', 'success', 'automation', 'coffee']
  },

  // Task 2: Email responses (10:00-10:15 AM) - scattered
  {
    frameNumber: 6,
    timestamp: '2026-02-11 10:00:00',
    appName: 'Gmail',
    windowTitle: 'Inbox',
    ocrText: 'Inbox (23)\nRe: Q4 Report\nMeeting tomorrow?',
    aiSummary: 'Checking email inbox',
    isSuccess: null,
    relevanceScore: 0.3,
    tags: ['email', 'routine']
  },
  {
    frameNumber: 7,
    timestamp: '2026-02-11 10:05:00',
    appName: 'Gmail',
    windowTitle: 'Compose',
    ocrText: 'Re: Meeting tomorrow?\nYes, 10am works for me.',
    aiSummary: 'Composing email response',
    isSuccess: null,
    relevanceScore: 0.2,
    tags: ['email', 'routine']
  },

  // Task 3: Claude Code debugging (2:00-2:15 PM)
  {
    frameNumber: 8,
    timestamp: '2026-02-11 14:00:00',
    appName: 'Terminal',
    windowTitle: 'Claude Code',
    ocrText: 'Error: Module not found\nCannot find module ./lib/utils',
    aiSummary: 'Claude Code showing module not found error',
    isSuccess: 0,
    relevanceScore: 0.9,
    tags: ['error', 'debugging', 'claude-code']
  },
  {
    frameNumber: 9,
    timestamp: '2026-02-11 14:05:00',
    appName: 'VSCode',
    windowTitle: 'lib/utils.js',
    ocrText: 'export function formatDate()',
    aiSummary: 'Editing utils.js file to fix import path',
    isSuccess: null,
    relevanceScore: 0.7,
    tags: ['vscode', 'debugging', 'code']
  },
  {
    frameNumber: 10,
    timestamp: '2026-02-11 14:15:00',
    appName: 'Terminal',
    windowTitle: 'Claude Code',
    ocrText: 'Task completed successfully\nAll tests passing',
    aiSummary: 'Claude Code task completed - debugging fixed',
    isSuccess: 1,
    relevanceScore: 1.0,
    tags: ['success', 'debugging', 'claude-code', 'tests']
  }
];

// Insert screenshots
console.log('📸 Adding sample screenshots...\n');

sampleScreenshots.forEach(s => {
  const screenshotId = db.addScreenshot(
    sessionId,
    s.frameNumber,
    s.timestamp,
    s.appName,
    s.windowTitle,
    `sessions/demo-continuous-work/frame_${String(s.frameNumber).padStart(4, '0')}.png`
  );

  db.updateScreenshotAnalysis(
    screenshotId,
    s.ocrText,
    s.aiSummary,
    s.isSuccess,
    s.relevanceScore,
    s.tags
  );
});

console.log(`✅ Added ${sampleScreenshots.length} sample screenshots\n`);

// Update session end time
db.stopSession(sessionId);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Demo 1: Search functionality
console.log('🔍 Demo 1: Full-Text Search\n');

const coffeeResults = searchEngine.search('coffee calendar', {
  sessionId,
  limit: 100
});

console.log(`✅ Search for "coffee calendar" found ${coffeeResults.length} results:\n`);
coffeeResults.forEach((s, idx) => {
  const time = new Date(s.timestamp).toLocaleTimeString();
  const successIcon = s.is_success === 1 ? '✅' : s.is_success === 0 ? '❌' : '🔄';
  console.log(`${idx + 1}. ${successIcon} [${time}] ${s.app_name}`);
  console.log(`   ${s.ai_summary}`);
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Demo 2: Time-based clustering
console.log('🕐 Demo 2: Time-Based Clustering\n');

const allScreenshots = db.getScreenshotsBySession(sessionId);
const clusters = searchEngine.clusterByTime(allScreenshots, 600); // 10 min gap

console.log(`✅ Detected ${clusters.length} time-based clusters:\n`);

clusters.forEach((cluster, idx) => {
  const startTime = new Date(cluster.startTime).toLocaleTimeString();
  const endTime = new Date(cluster.endTime).toLocaleTimeString();

  console.log(`Cluster ${idx + 1}: ${startTime} - ${endTime} (${cluster.duration.formatted})`);
  console.log(`├─ ${cluster.screenshots.length} screenshots`);

  if (cluster.screenshots[0].ai_summary) {
    console.log(`├─ Start: ${cluster.screenshots[0].ai_summary}`);
  }
  if (cluster.screenshots.length > 1) {
    const last = cluster.screenshots[cluster.screenshots.length - 1];
    if (last.ai_summary) {
      console.log(`└─ End: ${last.ai_summary}`);
    }
  }
  console.log('');
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Demo 3: Search statistics
console.log('📊 Demo 3: Session Statistics\n');

const stats = searchEngine.getSearchStats(allScreenshots);

console.log(`Total screenshots: ${stats.total}`);
console.log(`Success screens: ${stats.success_count}`);
console.log(`Error screens: ${stats.error_count}`);
console.log(`Avg relevance: ${(stats.avg_relevance * 100).toFixed(0)}%`);
console.log(`Time span: ${stats.time_span.formatted}\n`);

console.log('Apps used:');
stats.apps.forEach(app => {
  console.log(`  - ${app.name}: ${app.count} screenshots`);
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Demo 4: Virtual session creation
console.log('🗂️  Demo 4: Virtual Session Creation\n');

const coffeeIds = coffeeResults.map(s => s.id);

const virtualId = db.createVirtualSession(
  'task-coffee-booking',
  sessionId,
  'coffee calendar',
  coffeeIds,
  'Virtual session for coffee booking automation'
);

console.log(`✅ Created virtual session: task-coffee-booking`);
console.log(`   ID: ${virtualId}`);
console.log(`   Parent: demo-continuous-work`);
console.log(`   Screenshots: ${coffeeIds.length}`);
console.log(`   Query: "coffee calendar"\n`);

// List virtual sessions
const virtualSessions = db.getAllVirtualSessions();
console.log(`📋 Total virtual sessions: ${virtualSessions.length}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Summary
console.log('🎉 Phase 3 Demo Complete!\n');

console.log('✅ Full-text search working');
console.log('✅ Time-based clustering working');
console.log('✅ Search statistics working');
console.log('✅ Virtual session creation working\n');

console.log('💡 Try these commands:\n');
console.log('   node search.js "coffee" --session="demo-continuous-work"');
console.log('   node search.js "error" --session="demo-continuous-work"');
console.log('   node search.js "claude" --session="demo-continuous-work" --success-only');
console.log('   node group-session.js "demo-continuous-work"');
console.log('   node session-manager.js list --virtual\n');

searchEngine.close();
db.close();
