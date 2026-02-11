#!/usr/bin/env node
import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENPIPE_API = process.env.SCREENPIPE_API || 'http://localhost:3030';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not found in .env file');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// Parse command line arguments
const args = process.argv.slice(2);
const durationMinutes = parseInt(args.find(arg => arg.startsWith('--duration='))?.split('=')[1] || '5');
const summarize = args.includes('--summarize');
const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '50');

async function exportScreenshots() {
  console.log('📸 Exporting screenshots from screenpipe...\n');

  try {
    // Query screenpipe for recent frames
    console.log(`🔍 Fetching last ${durationMinutes} minutes of activity (max ${limit} frames)...`);

    const response = await axios.get(`${SCREENPIPE_API}/search`, {
      params: {
        limit: limit,
        content_type: 'ocr',
        start_time: new Date(Date.now() - durationMinutes * 60 * 1000).toISOString(),
        end_time: new Date().toISOString()
      }
    });

    const frames = response.data.data || [];

    if (frames.length === 0) {
      console.log('⚠️  No frames found. Make sure screenpipe is running and capturing.');
      return;
    }

    console.log(`✅ Found ${frames.length} frames\n`);

    // Create export directory
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const exportDir = path.join(__dirname, 'exports', timestamp);
    await fs.mkdir(exportDir, { recursive: true });

    // Process frames
    const frameData = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const frameNum = String(i + 1).padStart(4, '0');

      console.log(`📸 Frame ${frameNum}/${frames.length}:`);
      console.log(`   Time: ${new Date(frame.content.timestamp).toLocaleString()}`);
      console.log(`   App: ${frame.content.app_name || 'Unknown'}`);
      console.log(`   Window: ${frame.content.window_name || 'Unknown'}`);

      // Extract text content
      const textContent = frame.content.text || '';
      const textPreview = textContent.substring(0, 100);
      console.log(`   Text: ${textPreview}${textContent.length > 100 ? '...' : ''}`);

      const frameInfo = {
        id: frame.content.frame_id || `frame_${frameNum}`,
        timestamp: frame.content.timestamp,
        app_name: frame.content.app_name,
        window_name: frame.content.window_name,
        file_path: frame.content.file_path,
        ocr_text: textContent,
        frame_number: i + 1
      };

      // Generate AI summary if requested
      if (summarize && textContent.length > 10) {
        try {
          console.log('   🤖 Generating AI summary...');

          const message = await anthropic.messages.create({
            model: 'claude-haiku-4-20250122',
            max_tokens: 100,
            messages: [{
              role: 'user',
              content: `Summarize this screen capture in 1-2 sentences. Focus on what the user is doing.\n\nApp: ${frame.content.app_name}\nWindow: ${frame.content.window_name}\nText on screen: ${textContent.substring(0, 1000)}`
            }]
          });

          const summary = message.content[0].text;
          frameInfo.ai_summary = summary;
          console.log(`   ✅ Summary: ${summary}`);

        } catch (error) {
          console.log(`   ⚠️  AI summary failed: ${error.message}`);
          frameInfo.ai_summary = null;
        }
      }

      frameData.push(frameInfo);
      console.log();
    }

    // Save metadata to JSON
    const metadataPath = path.join(exportDir, 'frames_metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(frameData, null, 2));

    console.log(`✅ Exported ${frameData.length} frames to: ${exportDir}`);
    console.log(`📄 Metadata saved to: ${metadataPath}\n`);

    // Generate subtitle file if summaries were created
    if (summarize) {
      await generateSubtitles(frameData, exportDir);
    }

    return { exportDir, frameData };

  } catch (error) {
    console.error('❌ Error exporting screenshots:');

    if (error.code === 'ECONNREFUSED') {
      console.error('   Screenpipe is not running. Start it with:');
      console.error('   screenpipe --fps 0.2 --disable-audio --enable-frame-cache');
    } else if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Message:', error.response.data);
    } else {
      console.error('   ', error.message);
    }

    throw error;
  }
}

async function generateSubtitles(frameData, exportDir) {
  console.log('📝 Generating SRT subtitle file...\n');

  const srtLines = [];
  const framesWithSummaries = frameData.filter(f => f.ai_summary);

  framesWithSummaries.forEach((frame, index) => {
    const frameNumber = index + 1;

    // Calculate timing (assuming 5 seconds per frame)
    const startSeconds = index * 5;
    const endSeconds = (index + 1) * 5;

    const startTime = formatSRTTime(startSeconds);
    const endTime = formatSRTTime(endSeconds);

    // SRT format
    srtLines.push(frameNumber);
    srtLines.push(`${startTime} --> ${endTime}`);
    srtLines.push(frame.ai_summary);
    srtLines.push(''); // Empty line between entries
  });

  const srtPath = path.join(exportDir, 'subtitles.srt');
  await fs.writeFile(srtPath, srtLines.join('\n'));

  console.log(`✅ Subtitles saved to: ${srtPath}\n`);
}

function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

// Run the export
console.log('🎬 Screen Story - Screenshot Export\n');
console.log(`Duration: ${durationMinutes} minutes`);
console.log(`Max frames: ${limit}`);
console.log(`AI Summaries: ${summarize ? 'Enabled ✅' : 'Disabled'}\n`);

exportScreenshots().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
