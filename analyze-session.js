#!/usr/bin/env node
import ScreenStoryDB from './lib/database.js';
import OCR from './lib/ocr.js';
import AIAnalyzer from './lib/ai-analyzer.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Load .env manually (dotenv has issues with ES modules sometimes)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');

try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
} catch (error) {
  console.error('❌ Could not load .env file');
  process.exit(1);
}

// Verify API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not found in .env file');
  console.error('   Please add your API key to .env');
  process.exit(1);
}

const db = new ScreenStoryDB();
const analyzer = new AIAnalyzer(process.env.ANTHROPIC_API_KEY);

// Parse command line arguments
const sessionName = process.argv[2];
const limitFlag = process.argv.find(arg => arg.startsWith('--limit='));
const limit = limitFlag ? parseInt(limitFlag.split('=')[1]) : null;
const skipOcrFlag = process.argv.includes('--skip-ocr');

if (!sessionName) {
  console.error('❌ Usage: node analyze-session.js <session-name> [--limit=N] [--skip-ocr]');
  console.error('');
  console.error('Examples:');
  console.error('  node analyze-session.js "test-session"');
  console.error('  node analyze-session.js "feb-11-work" --limit=10  # Analyze first 10 only');
  console.error('  node analyze-session.js "test-session" --skip-ocr  # Skip OCR, use AI only');
  process.exit(1);
}

async function analyzeSession() {
  console.log('🔍 Screen Story - Session Analysis\n');

  try {
    // Get session
    const session = db.getSessionByName(sessionName);
    if (!session) {
      console.error(`❌ Session "${sessionName}" not found`);
      process.exit(1);
    }

    // Get unanalyzed screenshots
    const screenshots = db.getUnanalyzedScreenshots(session.id, limit);

    if (screenshots.length === 0) {
      console.log('✅ All screenshots already analyzed!');
      console.log(`   Run with --limit to re-analyze specific frames\n`);
      process.exit(0);
    }

    console.log(`📝 Session: ${session.session_name}`);
    if (session.description) {
      console.log(`📋 Description: ${session.description}`);
    }
    console.log(`📸 Screenshots to analyze: ${screenshots.length}`);
    console.log('');

    // Check OCR availability
    if (!skipOcrFlag) {
      const ocrAvailable = await OCR.isAvailable();
      if (!ocrAvailable) {
        console.error('⚠️  macOS Vision API not available, skipping OCR');
        console.error('   (OCR requires macOS 10.15+)');
        console.log('');
      }
    }

    // Process each screenshot
    let processedCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      const progress = `[${i + 1}/${screenshots.length}]`;

      // Extract OCR text
      let ocrText = '';
      if (!skipOcrFlag) {
        try {
          process.stdout.write(`\r🔤 ${progress} Extracting text from frame ${screenshot.frame_number}...`);
          ocrText = await OCR.extractText(screenshot.file_path);
        } catch (error) {
          // OCR failed, continue without it
        }
      }

      // AI Analysis
      process.stdout.write(`\r🤖 ${progress} Analyzing frame ${screenshot.frame_number} with Claude...     `);

      const context = {
        sessionDescription: session.description || 'Unknown task',
        frameNumber: screenshot.frame_number,
        totalFrames: session.screenshot_count,
        appName: screenshot.app_name,
        windowTitle: screenshot.window_title,
        ocrText: ocrText
      };

      const analysis = await analyzer.analyzeScreenshot(screenshot.file_path, context);

      // Update database
      db.updateScreenshotAnalysis(
        screenshot.id,
        ocrText,
        analysis.summary,
        analysis.is_success,
        analysis.relevance_score,
        analysis.tags
      );

      processedCount++;

      // Show result
      const successIcon = analysis.is_success === 1 ? '✅' : (analysis.is_success === 0 ? '❌' : '🔄');
      const relevanceBar = '█'.repeat(Math.round(analysis.relevance_score * 10));
      process.stdout.write(`\r${successIcon} ${progress} Frame ${screenshot.frame_number}: ${analysis.summary.substring(0, 60)}...\n`);
      console.log(`   📊 Relevance: ${relevanceBar} ${(analysis.relevance_score * 100).toFixed(0)}% | Type: ${analysis.screen_type} | Tags: ${analysis.tags.join(', ')}`);
      console.log('');

      // Small delay to avoid rate limits
      if (i < screenshots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Analysis Complete!\n');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📸 Analyzed: ${processedCount} screenshots`);

    // Show statistics
    const allScreenshots = db.getScreenshotsBySession(session.id);
    const analyzedScreenshots = allScreenshots.filter(s => s.analyzed);
    const successCount = analyzedScreenshots.filter(s => s.is_success === 1).length;
    const errorCount = analyzedScreenshots.filter(s => s.is_success === 0).length;
    const avgRelevance = analyzedScreenshots.reduce((sum, s) => sum + (s.relevance_score || 0), 0) / analyzedScreenshots.length;

    console.log('');
    console.log('━━━ Session Statistics ━━━');
    console.log(`✅ Success screens: ${successCount}`);
    console.log(`❌ Error screens: ${errorCount}`);
    console.log(`📊 Average relevance: ${(avgRelevance * 100).toFixed(0)}%`);
    console.log(`🔍 Analyzed: ${analyzedScreenshots.length}/${allScreenshots.length} screenshots`);
    console.log('');

    // Show next steps
    console.log('💡 Next steps:');
    if (session.is_continuous) {
      console.log(`   node group-session.js "${sessionName}" --auto-detect-tasks`);
      console.log(`   node summarize-day.js "${sessionName}"`);
    } else {
      console.log(`   node export-session.js "${sessionName}" --hero-only`);
      console.log(`   node create-video.js --session="${sessionName}"`);
    }
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    db.close();
  }
}

analyzeSession();
