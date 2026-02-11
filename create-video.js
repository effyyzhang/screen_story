#!/usr/bin/env node
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const inputDir = args.find(arg => arg.startsWith('--input='))?.split('=')[1];
const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1] || 'output.mp4';
const format = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'vertical'; // vertical, square, horizontal
const fps = parseInt(args.find(arg => arg.startsWith('--fps='))?.split('=')[1] || '2');

if (!inputDir) {
  console.error('❌ Usage: node create-video.js --input=<export-directory> [--output=<filename>] [--format=vertical|square|horizontal] [--fps=2]');
  process.exit(1);
}

// Video format presets
const formats = {
  vertical: { width: 1080, height: 1920 }, // 9:16 for TikTok/Instagram Reels/YouTube Shorts
  square: { width: 1080, height: 1080 },   // 1:1 for Instagram/Twitter
  horizontal: { width: 1920, height: 1080 } // 16:9 for YouTube
};

async function createVideo() {
  console.log('🎬 Screen Story - Video Creator\n');

  try {
    // Read metadata
    const metadataPath = path.join(inputDir, 'frames_metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

    console.log(`📸 Processing ${metadata.length} frames`);
    console.log(`📐 Format: ${format} (${formats[format].width}x${formats[format].height})`);
    console.log(`🎞️  FPS: ${fps}\n`);

    // Check if we have frame images (we'll copy from screenpipe storage)
    const framesDir = path.join(inputDir, 'frames');
    await fs.mkdir(framesDir, { recursive: true });

    console.log('📥 Copying frame images...');
    for (let i = 0; i < metadata.length; i++) {
      const frame = metadata[i];
      if (frame.file_path) {
        try {
          const sourcePath = path.expandTilde(frame.file_path);
          const destPath = path.join(framesDir, `frame_${String(i + 1).padStart(4, '0')}.png`);

          // Try to read from screenpipe storage
          // The file_path from screenpipe API should point to the actual frame
          const homeDir = process.env.HOME;
          const actualPath = frame.file_path.replace('~', homeDir);

          await fs.copyFile(actualPath, destPath);
          console.log(`   ✅ Frame ${i + 1}/${metadata.length}`);
        } catch (error) {
          console.log(`   ⚠️  Frame ${i + 1}: ${error.message}`);
        }
      }
    }

    console.log();

    // Check for subtitle file
    const subtitlePath = path.join(inputDir, 'subtitles.srt');
    const hasSubtitles = await fs.access(subtitlePath).then(() => true).catch(() => false);

    // Generate video
    console.log('🎥 Creating video...\n');

    const outputPath = path.join(__dirname, outputFile);
    const selectedFormat = formats[format];

    return new Promise((resolve, reject) => {
      let command = ffmpeg()
        .input(path.join(framesDir, 'frame_%04d.png'))
        .inputFPS(fps)
        .videoCodec('libx264')
        .outputOptions([
          '-pix_fmt yuv420p',
          '-preset slow',
          '-crf 18'
        ]);

      // Add video filters
      const filters = [];

      // Scale and pad to target format
      filters.push(
        `scale=${selectedFormat.width}:${selectedFormat.height}:force_original_aspect_ratio=decrease`,
        `pad=${selectedFormat.width}:${selectedFormat.height}:(ow-iw)/2:(oh-ih)/2:black`
      );

      // Add subtitles if available
      if (hasSubtitles) {
        console.log('📝 Adding subtitles...');
        const escapedSubPath = subtitlePath.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
        filters.push(
          `subtitles=${escapedSubPath}:force_style='FontName=Arial,FontSize=32,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=3,Outline=2,Shadow=1,MarginV=50'`
        );
      }

      command.videoFilters(filters);

      command
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
          console.log();
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            process.stdout.write(`\r🎬 Progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          console.log('\n\n✅ Video created successfully!');
          console.log(`📹 Output: ${outputPath}\n`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('\n❌ Error creating video:', err.message);
          reject(err);
        })
        .run();
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Helper to expand ~ in paths
path.expandTilde = (filePath) => {
  if (filePath.startsWith('~/')) {
    return path.join(process.env.HOME, filePath.slice(2));
  }
  return filePath;
};

createVideo().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
