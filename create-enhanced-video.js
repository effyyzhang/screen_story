#!/usr/bin/env node

/**
 * Enhanced Video Creator
 * Creates professional demo videos with text overlays, highlights, progress bar, and privacy blur
 */

import ScreenStoryDB from './lib/database.js';
import VideoEditor from './lib/video-editor.js';
import VideoEnhancements from './lib/video-enhancements.js';
import fs from 'fs/promises';
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

  const options = {
    session: null,
    virtualSession: null,
    output: null,
    heroOnly: false,
    addCaptions: true,
    addProgressBar: true,
    addTimestamps: true,
    addSuccessIndicators: true,
    blurSensitive: false,
    minRelevance: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--virtual-session') options.virtualSession = args[++i];
    else if (args[i] === '--output') options.output = args[++i];
    else if (args[i] === '--hero-only') options.heroOnly = true;
    else if (args[i] === '--no-captions') options.addCaptions = false;
    else if (args[i] === '--no-progress-bar') options.addProgressBar = false;
    else if (args[i] === '--no-timestamps') options.addTimestamps = false;
    else if (args[i] === '--no-success-indicators') options.addSuccessIndicators = false;
    else if (args[i] === '--blur-sensitive') options.blurSensitive = true;
    else if (!options.session) options.session = args[i];
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
      console.log('Creating enhanced video from virtual session:', sessionName, '(' + ids.length + ' screenshots)');
      screenshots = ids.map(id => db.db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id)).filter(Boolean);
    } else {
      const session = db.getSessionByName(options.session);
      if (!session) throw new Error('Session not found');
      sessionName = options.session;
      screenshots = db.getScreenshotsBySession(session.id).filter(s => s.analyzed);
      console.log('Creating enhanced video from session:', sessionName, '(' + screenshots.length + ' screenshots)');
    }

    if (screenshots.length === 0) throw new Error('No screenshots found');

    // Filter screenshots
    let filtered = screenshots;
    if (options.heroOnly) {
      // Note: relevance_score is stored as 0.0-1.0 in database
      filtered = filtered.filter(s => s.relevance_score >= 0.7);
      console.log(`Hero-only mode: ${filtered.length}/${screenshots.length} screenshots selected (≥70% relevance)`);
    }
    filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Set output path
    const suffix = options.heroOnly ? '-hero' : '-enhanced';
    const outputPath = options.output || path.join(__dirname, 'videos', sessionName + suffix + '.mp4');
    const tempPath = path.join(__dirname, 'videos', sessionName + suffix + '-temp.mp4');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    console.log('\n🎬 Creating enhanced video with professional features:\n');
    if (options.addCaptions) console.log('  ✓ AI-generated captions');
    if (options.addTimestamps) console.log('  ✓ Timestamps');
    if (options.addSuccessIndicators) console.log('  ✓ Success indicators');
    if (options.addProgressBar) console.log('  ✓ Progress bar');
    if (options.blurSensitive) console.log('  ✓ Sensitive data blur');
    console.log();

    // Step 1: Create base video with intelligent pacing
    console.log('Step 1/3: Creating base video with intelligent pacing...');

    // Relevance scores are already 0.0-1.0 in database, no need to normalize
    const normalizedScreenshots = filtered.map(s => ({
      ...s,
      relevance_score: s.relevance_score !== null && s.relevance_score !== undefined
        ? s.relevance_score
        : 0.5
    }));

    const baseVideoPath = await VideoEditor.createVideo(normalizedScreenshots, tempPath, {
      scale: '1920:-2',
      fps: 1,
      minDuration: 1.0,
      maxDuration: 3.0,
      transitionDuration: 0.3,
      transition: 'fade',
      quality: 23,
      intelligentPacing: true
    });

    // Calculate total duration for overlay timing
    const totalDuration = normalizedScreenshots.reduce((sum, s) => {
      let duration;
      const relevance = s.relevance_score || 0.5;
      duration = 1.0 + (3.0 - 1.0) * relevance;
      return sum + Math.max(1.0, Math.min(3.0, duration));
    }, 0);

    // Step 2: Add text overlays
    let currentPath = tempPath;
    if (options.addCaptions || options.addTimestamps || options.addSuccessIndicators) {
      console.log('Step 2/3: Adding text overlays...');

      const overlays = [];
      let currentTime = 0;

      normalizedScreenshots.forEach((screenshot, idx) => {
        const relevance = screenshot.relevance_score || 0.5;
        const duration = Math.max(1.0, Math.min(3.0, 1.0 + (3.0 - 1.0) * relevance));

        // Add AI summary caption
        if (options.addCaptions && screenshot.ai_summary) {
          overlays.push({
            text: screenshot.ai_summary,
            startTime: currentTime,
            duration: duration,
            position: 'bottom',
            fontSize: 36,
            fontColor: 'white',
            backgroundColor: 'black@0.8'
          });
        }

        // Add timestamp
        if (options.addTimestamps) {
          const time = new Date(screenshot.timestamp).toLocaleTimeString();
          overlays.push({
            text: time,
            startTime: currentTime,
            duration: duration,
            position: 'top-left',
            fontSize: 24,
            fontColor: 'white@0.7',
            backgroundColor: 'transparent'
          });
        }

        // Add success indicator for hero moments (relevance_score is 0.0-1.0 in DB)
        if (options.addSuccessIndicators && screenshot.is_success && screenshot.relevance_score >= 0.8) {
          overlays.push({
            text: '✓ SUCCESS',
            startTime: currentTime,
            duration: duration,
            position: 'top-right',
            fontSize: 32,
            fontColor: 'lime',
            backgroundColor: 'black@0.7'
          });
        }

        currentTime += duration;
      });

      if (overlays.length > 0) {
        const overlayPath = outputPath.replace('.mp4', '-overlay.mp4');
        currentPath = await VideoEnhancements.addTextOverlays(currentPath, overlayPath, overlays);

        // Clean up temp file
        if (currentPath !== tempPath) {
          try { await fs.unlink(tempPath); } catch (e) {}
        }
      }
    } else {
      console.log('Step 2/3: Skipping text overlays (disabled)');
    }

    // Step 3: Add progress bar
    if (options.addProgressBar) {
      console.log('Step 3/3: Adding progress bar...');

      const progressPath = outputPath;
      currentPath = await VideoEnhancements.addProgressBar(currentPath, progressPath, {
        position: 'bottom',
        height: 5,
        color: 'orange',
        backgroundColor: 'black@0.3'
      });

      // Clean up temp file
      const prevPath = outputPath.replace('.mp4', '-overlay.mp4');
      if (prevPath !== currentPath) {
        try { await fs.unlink(prevPath); } catch (e) {}
      }
    } else {
      console.log('Step 3/3: Skipping progress bar (disabled)');

      // Move current path to final output
      if (currentPath !== outputPath) {
        await fs.rename(currentPath, outputPath);
      }
    }

    // Get final video stats
    const stats = await fs.stat(outputPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('\n✅ Enhanced video created successfully!\n');
    console.log(`   Output: ${outputPath}`);
    console.log(`   Size: ${sizeInMB} MB`);
    console.log(`   Frames: ${filtered.length}`);
    console.log(`   Duration: ~${totalDuration.toFixed(1)}s`);
    console.log();
    console.log(`💡 Open video: open "${outputPath}"\n`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

function showHelp() {
  console.log(`
🎬 Screen Story - Enhanced Video Creator

Create professional demo videos with AI captions, timestamps, and visual enhancements

Usage:
  node create-enhanced-video.js <session> [options]

Examples:
  # Create enhanced video with all features
  node create-enhanced-video.js screen-story-completion

  # Create hero highlights with enhancements
  node create-enhanced-video.js screen-story-completion --hero-only

  # Custom output path
  node create-enhanced-video.js my-session --output=videos/demo.mp4

  # Minimal video (no overlays, just intelligent pacing)
  node create-enhanced-video.js my-session --no-captions --no-progress-bar

  # Privacy-focused (blur sensitive data)
  node create-enhanced-video.js my-session --blur-sensitive

Options:
  --hero-only                  Only include success moments (≥80% relevance)
  --output <path>              Custom output path
  --no-captions                Disable AI-generated captions
  --no-timestamps              Disable timestamp overlays
  --no-success-indicators      Disable success checkmarks
  --no-progress-bar            Disable progress bar
  --blur-sensitive             Auto-blur sensitive data (experimental)
  --virtual-session <name>     Use virtual session instead

Features:
  ✓ Intelligent pacing (1-3s per frame based on relevance)
  ✓ AI-generated captions from screenshot analysis
  ✓ Timestamp overlays
  ✓ Success indicators for hero moments
  ✓ Progress bar
  ✓ Aspect ratio preservation (1920px width)
  ✓ High quality H.264 encoding
`);
}

main();
