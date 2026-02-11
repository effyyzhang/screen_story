#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

class VideoEditor {
  /**
   * Create video from screenshots with intelligent pacing
   * @param {Array} screenshots - Array of screenshot objects with file_path, relevance_score, duration
   * @param {string} outputPath - Output video file path
   * @param {Object} options - Video options
   * @returns {Promise<string>} - Path to created video
   */
  static async createVideo(screenshots, outputPath, options = {}) {
    const {
      fps = 1,                    // Base frames per second (1 = 1 screenshot per second)
      transition = 'fade',        // Transition type: 'none', 'fade', 'dissolve'
      transitionDuration = 0.3,   // Transition duration in seconds
      minDuration = 0.5,          // Minimum duration per frame
      maxDuration = 3.0,          // Maximum duration per frame
      intelligentPacing = true,   // Use relevance scores to adjust duration
      format = 'mp4',             // Output format
      codec = 'libx264',          // Video codec
      quality = 23,               // CRF quality (lower = better, 23 is good default)
      scale = null                // Scale output (e.g., '1920:1080' or '1280:-1')
    } = options;

    if (screenshots.length === 0) {
      throw new Error('No screenshots provided');
    }

    console.log(`🎬 Creating video with ${screenshots.length} frames...\n`);

    // Calculate duration for each frame based on relevance
    const framesWithDuration = screenshots.map((s, idx) => {
      let duration;

      if (intelligentPacing && s.relevance_score !== null) {
        // Higher relevance = longer duration
        // Scale: 0.5s (low relevance) to 3.0s (high relevance)
        const relevance = s.relevance_score || 0.5;
        duration = minDuration + (maxDuration - minDuration) * relevance;
      } else {
        duration = 1.0 / fps; // Default duration
      }

      return {
        ...s,
        duration: Math.max(minDuration, Math.min(maxDuration, duration))
      };
    });

    // Create temporary directory for FFmpeg inputs
    const tmpDir = path.join('/tmp', `screen-story-video-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Method 1: Use FFmpeg concat demuxer with duration filter
    const concatFilePath = path.join(tmpDir, 'concat.txt');
    const concatContent = framesWithDuration.map(s => {
      return `file '${s.file_path}'\nduration ${s.duration}`;
    }).join('\n') + `\nfile '${framesWithDuration[framesWithDuration.length - 1].file_path}'`;

    await fs.writeFile(concatFilePath, concatContent);

    // Debug: Also save to a persistent location
    const debugConcatPath = path.join(path.dirname(outputPath), 'debug-concat.txt');
    await fs.writeFile(debugConcatPath, concatContent);
    console.log(`Debug: Concat file saved to ${debugConcatPath}`);

    // Build FFmpeg command
    let ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${concatFilePath}"`;

    // Add video filters
    const filters = [];

    // Scale filter with forced even dimensions for H.264 compatibility
    if (scale) {
      // Force dimensions to be divisible by 2 for H.264
      // Use -2 instead of -1 for auto-scaling to ensure even numbers
      const scaleParts = scale.split(':');
      const adjustedScale = scaleParts.map(part => {
        if (part === '-1') return '-2';  // Force even dimensions
        return part;
      }).join(':');
      filters.push(`scale=${adjustedScale}`);
    }

    // Note: Fade transitions with concat demuxer are tricky
    // Simple global fade in/out causes issues with variable frame durations
    // For now, skip fade transitions when using concat demuxer
    // TODO: Implement proper per-frame fades using xfade filter

    // Format filter (ensure proper pixel format for compatibility)
    filters.push('format=yuv420p');

    if (filters.length > 0) {
      ffmpegCmd += ` -vf "${filters.join(',')}"`;
    }

    // Output options
    ffmpegCmd += ` -c:v ${codec} -crf ${quality}`;
    // Note: Don't use -r with concat demuxer when durations are specified
    // The duration values in concat.txt control timing
    ffmpegCmd += ` -y "${outputPath}"`;

    console.log('🎥 FFmpeg command:', ffmpegCmd.substring(0, 150) + '...\n');

    try {
      const { stdout, stderr } = await execAsync(ffmpegCmd);

      // Debug: log FFmpeg output
      if (stderr) {
        console.log('FFmpeg output:', stderr.substring(stderr.length - 500));
      }

      // Clean up temp files
      await fs.rm(tmpDir, { recursive: true, force: true });

      // Get video info
      const stats = await fs.stat(outputPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log(`✅ Video created successfully!`);
      console.log(`   Output: ${outputPath}`);
      console.log(`   Size: ${sizeInMB} MB`);
      console.log(`   Frames: ${screenshots.length}`);
      console.log(`   Total duration: ~${framesWithDuration.reduce((sum, s) => sum + s.duration, 0).toFixed(1)}s\n`);

      return outputPath;
    } catch (error) {
      // Clean up temp files even on error
      await fs.rm(tmpDir, { recursive: true, force: true });
      throw new Error(`FFmpeg error: ${error.message}`);
    }
  }

  /**
   * Create video with advanced transitions using xfade filter
   * More complex but produces smoother transitions
   */
  static async createVideoWithXfade(screenshots, outputPath, options = {}) {
    const {
      transitionType = 'fade',    // xfade types: fade, wipeleft, wiperight, slideup, slidedown, etc.
      transitionDuration = 0.5,
      format = 'mp4',
      codec = 'libx264',
      quality = 23,
      scale = null
    } = options;

    if (screenshots.length === 0) {
      throw new Error('No screenshots provided');
    }

    if (screenshots.length === 1) {
      // Single frame, no transitions needed
      return this.createVideo(screenshots, outputPath, options);
    }

    console.log(`🎬 Creating video with xfade transitions (${screenshots.length} frames)...\n`);

    // Calculate frame durations
    const framesWithDuration = screenshots.map((s, idx) => ({
      ...s,
      duration: s.relevance_score
        ? 0.5 + (2.5 * s.relevance_score)
        : 1.5
    }));

    // Build complex filter graph for xfade
    let filterComplex = '';
    let currentLabel = '[0:v]';
    let offset = 0;

    for (let i = 0; i < framesWithDuration.length - 1; i++) {
      const currentDuration = framesWithDuration[i].duration;
      offset += currentDuration - transitionDuration;

      const nextLabel = i === framesWithDuration.length - 2 ? 'out' : `v${i + 1}`;

      filterComplex += `${currentLabel}[${i + 1}:v]xfade=transition=${transitionType}:duration=${transitionDuration}:offset=${offset}[${nextLabel}];`;
      currentLabel = `[${nextLabel}]`;
    }

    // Remove trailing semicolon
    filterComplex = filterComplex.slice(0, -1);

    // Build input files
    const inputs = framesWithDuration.map(s => `-loop 1 -t ${s.duration} -i "${s.file_path}"`).join(' ');

    // Build FFmpeg command
    let ffmpegCmd = `ffmpeg ${inputs} -filter_complex "${filterComplex}" -c:v ${codec} -crf ${quality} -pix_fmt yuv420p -y "${outputPath}"`;

    console.log('🎥 Creating video with xfade transitions...\n');

    try {
      await execAsync(ffmpegCmd);

      const stats = await fs.stat(outputPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log(`✅ Video created with smooth transitions!`);
      console.log(`   Output: ${outputPath}`);
      console.log(`   Size: ${sizeInMB} MB\n`);

      return outputPath;
    } catch (error) {
      throw new Error(`FFmpeg xfade error: ${error.message}`);
    }
  }

  /**
   * Add text overlay to video (timestamps, captions, action labels)
   */
  static async addTextOverlay(inputVideo, outputVideo, overlays, options = {}) {
    const {
      fontFamily = 'Arial',
      fontSize = 24,
      fontColor = 'white',
      backgroundColor = 'black@0.7',
      position = 'bottom',        // top, bottom, center
      padding = 10
    } = options;

    // Build drawtext filter
    const filters = overlays.map(overlay => {
      const { text, startTime, duration } = overlay;
      let y = fontSize + padding;

      if (position === 'bottom') {
        y = `h-th-${padding}`;
      } else if (position === 'center') {
        y = '(h-th)/2';
      }

      return `drawtext=text='${text}':fontfile=/System/Library/Fonts/Helvetica.ttc:fontsize=${fontSize}:fontcolor=${fontColor}:box=1:boxcolor=${backgroundColor}:boxborderw=${padding}:x=(w-tw)/2:y=${y}:enable='between(t,${startTime},${startTime + duration})'`;
    }).join(',');

    const ffmpegCmd = `ffmpeg -i "${inputVideo}" -vf "${filters}" -c:v libx264 -crf 23 -pix_fmt yuv420p -y "${outputVideo}"`;

    await execAsync(ffmpegCmd);
    return outputVideo;
  }

  /**
   * Apply smart zoom to region of interest
   * Uses OCR bounds to zoom into relevant text areas
   */
  static async addSmartZoom(inputVideo, outputVideo, zoomRegions, options = {}) {
    const {
      zoomDuration = 0.5,
      zoomFactor = 1.5
    } = options;

    // Build zoompan filter
    const filters = zoomRegions.map(region => {
      const { startTime, duration, x, y, width, height } = region;

      // Calculate zoom parameters
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      return `zoompan=z='if(between(t,${startTime},${startTime + duration}),${zoomFactor},1)':x='${centerX}':y='${centerY}':d=${duration * 30}`;
    }).join(',');

    const ffmpegCmd = `ffmpeg -i "${inputVideo}" -vf "${filters}" -c:v libx264 -crf 23 -pix_fmt yuv420p -y "${outputVideo}"`;

    await execAsync(ffmpegCmd);
    return outputVideo;
  }

  /**
   * Blur specific regions for sensitive data redaction
   */
  static async blurRegions(inputVideo, outputVideo, regions, options = {}) {
    const {
      blurStrength = 20
    } = options;

    // Build complex filter with multiple blur boxes
    const filters = regions.map((region, idx) => {
      const { startTime, duration, x, y, width, height } = region;

      return `[0:v]crop=${width}:${height}:${x}:${y},boxblur=${blurStrength}[blur${idx}];[0:v][blur${idx}]overlay=${x}:${y}:enable='between(t,${startTime},${startTime + duration})'`;
    }).join(';');

    const ffmpegCmd = `ffmpeg -i "${inputVideo}" -filter_complex "${filters}" -c:v libx264 -crf 23 -pix_fmt yuv420p -y "${outputVideo}"`;

    await execAsync(ffmpegCmd);
    return outputVideo;
  }

  /**
   * Get video information
   */
  static async getVideoInfo(videoPath) {
    const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
    const { stdout } = await execAsync(cmd);
    return JSON.parse(stdout);
  }
}

export default VideoEditor;
