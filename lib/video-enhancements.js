#!/usr/bin/env node

/**
 * Video Enhancement Module
 * Adds professional editing features: zoom, text overlays, blur, highlights
 * Based on 2026 YouTube/demo video best practices
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const execAsync = promisify(exec);

class VideoEnhancements {
  /**
   * Add text overlay to video with professional styling
   * @param {string} inputPath - Input video path
   * @param {string} outputPath - Output video path
   * @param {Array} textOverlays - Array of {text, startTime, duration, position, style}
   */
  static async addTextOverlays(inputPath, outputPath, textOverlays = []) {
    if (textOverlays.length === 0) return inputPath;

    // Build drawtext filters for FFmpeg
    const filters = textOverlays.map(overlay => {
      const {
        text,
        startTime = 0,
        duration = null,
        position = 'bottom', // 'top', 'bottom', 'center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'
        fontSize = 48,
        fontColor = 'white',
        backgroundColor = 'black@0.7',
        padding = 20
      } = overlay;

      // Position coordinates
      let x, y;
      switch (position) {
        case 'top':
          x = '(w-text_w)/2';
          y = padding;
          break;
        case 'bottom':
          x = '(w-text_w)/2';
          y = `h-text_h-${padding}`;
          break;
        case 'center':
          x = '(w-text_w)/2';
          y = '(h-text_h)/2';
          break;
        case 'top-left':
          x = padding;
          y = padding;
          break;
        case 'top-right':
          x = `w-text_w-${padding}`;
          y = padding;
          break;
        case 'bottom-left':
          x = padding;
          y = `h-text_h-${padding}`;
          break;
        case 'bottom-right':
          x = `w-text_w-${padding}`;
          y = `h-text_h-${padding}`;
          break;
        default:
          x = '(w-text_w)/2';
          y = `h-text_h-${padding}`;
      }

      // Escape special characters in text
      const escapedText = text.replace(/:/g, '\\:').replace(/'/g, "\\\\'");

      // Build drawtext filter
      let filter = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${fontColor}:` +
        `box=1:boxcolor=${backgroundColor}:boxborderw=10:x=${x}:y=${y}`;

      // Add timing if specified
      if (duration !== null) {
        filter += `:enable='between(t,${startTime},${startTime + duration})'`;
      } else if (startTime > 0) {
        filter += `:enable='gte(t,${startTime})'`;
      }

      return filter;
    });

    const filterChain = filters.join(',');
    const cmd = `ffmpeg -i "${inputPath}" -vf "${filterChain}" -c:a copy -y "${outputPath}"`;

    await execAsync(cmd);
    return outputPath;
  }

  /**
   * Add zoom effect to highlight specific areas
   * @param {string} inputPath - Input video path
   * @param {string} outputPath - Output video path
   * @param {Array} zoomRegions - Array of {startTime, duration, x, y, width, height, zoomFactor}
   */
  static async addSmartZoom(inputPath, outputPath, zoomRegions = []) {
    if (zoomRegions.length === 0) return inputPath;

    // For now, implement a simple zoom to a region
    // Advanced version would use zoompan filter with OCR bounds
    const firstRegion = zoomRegions[0];
    const {
      startTime = 0,
      duration = 2,
      x = 'iw/2',
      y = 'ih/2',
      zoomFactor = 1.5
    } = firstRegion;

    // Use zoompan filter for smooth zoom
    const filter = `zoompan=z='if(between(time,${startTime},${startTime + duration}),${zoomFactor},1)':` +
      `d=1:x='${x}-iw/2':y='${y}-ih/2':s=1920x1080`;

    const cmd = `ffmpeg -i "${inputPath}" -vf "${filter}" -c:a copy -y "${outputPath}"`;

    await execAsync(cmd);
    return outputPath;
  }

  /**
   * Blur sensitive regions in video (privacy protection)
   * @param {string} inputPath - Input video path
   * @param {string} outputPath - Output video path
   * @param {Array} blurRegions - Array of {x, y, width, height, startTime, duration}
   * @param {string} method - 'blur' (gaussian) or 'block' (solid mask, more secure)
   */
  static async blurSensitiveData(inputPath, outputPath, blurRegions = [], method = 'block') {
    if (blurRegions.length === 0) return inputPath;

    const filters = blurRegions.map((region, idx) => {
      const {
        x,
        y,
        width,
        height,
        startTime = 0,
        duration = null,
        blurAmount = 20
      } = region;

      if (method === 'block') {
        // Solid color block (most secure per 2026 best practices)
        let filter = `drawbox=x=${x}:y=${y}:w=${width}:h=${height}:color=black:thickness=fill`;

        if (duration !== null) {
          filter += `:enable='between(t,${startTime},${startTime + duration})'`;
        } else if (startTime > 0) {
          filter += `:enable='gte(t,${startTime})'`;
        }

        return filter;
      } else {
        // Gaussian blur (less secure but looks better)
        // Create a mask and apply blur only to that region
        // This is more complex and requires multiple filter passes
        return `crop=${width}:${height}:${x}:${y},boxblur=${blurAmount}:${blurAmount}[blurred${idx}];` +
          `[0:v][blurred${idx}]overlay=${x}:${y}`;
      }
    });

    const filterChain = filters.join(',');
    const cmd = `ffmpeg -i "${inputPath}" -vf "${filterChain}" -c:a copy -y "${outputPath}"`;

    await execAsync(cmd);
    return outputPath;
  }

  /**
   * Add highlight circles/boxes to draw attention
   * @param {string} inputPath - Input video path
   * @param {string} outputPath - Output video path
   * @param {Array} highlights - Array of {x, y, radius, startTime, duration, color}
   */
  static async addHighlights(inputPath, outputPath, highlights = []) {
    if (highlights.length === 0) return inputPath;

    const filters = highlights.map(highlight => {
      const {
        x,
        y,
        radius = 50,
        startTime = 0,
        duration = 1,
        color = 'yellow@0.5',
        thickness = 5
      } = highlight;

      // Draw a circle using drawbox with transparency
      return `drawbox=x=${x - radius}:y=${y - radius}:w=${radius * 2}:h=${radius * 2}:` +
        `color=${color}:thickness=${thickness}:` +
        `enable='between(t,${startTime},${startTime + duration})'`;
    });

    const filterChain = filters.join(',');
    const cmd = `ffmpeg -i "${inputPath}" -vf "${filterChain}" -c:a copy -y "${outputPath}"`;

    await execAsync(cmd);
    return outputPath;
  }

  /**
   * Add progress bar to video
   * @param {string} inputPath - Input video path
   * @param {string} outputPath - Output video path
   * @param {Object} options - {position, height, color}
   */
  static async addProgressBar(inputPath, outputPath, options = {}) {
    const {
      position = 'bottom', // 'top' or 'bottom'
      height = 5,
      color = 'orange',
      backgroundColor = 'black@0.3'
    } = options;

    const y = position === 'top' ? 0 : `h-${height}`;

    // Draw background bar
    const bgFilter = `drawbox=x=0:y=${y}:w=iw:h=${height}:color=${backgroundColor}:thickness=fill`;

    // Draw progress bar that grows over time
    const progressFilter = `drawbox=x=0:y=${y}:w='iw*t/duration':h=${height}:color=${color}:thickness=fill`;

    const filterChain = `${bgFilter},${progressFilter}`;
    const cmd = `ffmpeg -i "${inputPath}" -vf "${filterChain}" -c:a copy -y "${outputPath}"`;

    await execAsync(cmd);
    return outputPath;
  }

  /**
   * Detect sensitive data regions using OCR text bounds
   * Returns array of regions to blur
   */
  static async detectSensitiveRegions(imagePath, ocrResult) {
    const sensitivePatterns = [
      /api[_-]?key/i,
      /password/i,
      /secret/i,
      /token/i,
      /sk-[a-zA-Z0-9-]+/, // API keys like Anthropic
      /\d{3}-\d{2}-\d{4}/, // SSN
      /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/, // Credit card
      /\$[\d,]+\.\d{2}/, // Currency amounts
    ];

    const regions = [];

    // Check OCR text for sensitive patterns
    if (ocrResult && ocrResult.text) {
      const lines = ocrResult.text.split('\n');
      lines.forEach((line, idx) => {
        for (const pattern of sensitivePatterns) {
          if (pattern.test(line)) {
            // If we have OCR bounds, use them; otherwise use approximate regions
            if (ocrResult.bounds && ocrResult.bounds[idx]) {
              regions.push(ocrResult.bounds[idx]);
            }
          }
        }
      });
    }

    return regions;
  }

  /**
   * Auto-detect app-specific regions to blur
   * Banks, finance apps, password managers, etc.
   */
  static getAppBlurRegions(appName, windowSize) {
    const appRules = {
      'Bank of America': [
        { x: 0, y: 0, width: windowSize.width, height: 100 }, // Top bar with account numbers
      ],
      'Chase': [
        { x: 0, y: 0, width: windowSize.width, height: 100 },
      ],
      '1Password': [
        { x: 0, y: 0, width: windowSize.width, height: windowSize.height }, // Blur entire app
      ],
      'LastPass': [
        { x: 0, y: 0, width: windowSize.width, height: windowSize.height },
      ],
      'Bitwarden': [
        { x: 0, y: 0, width: windowSize.width, height: windowSize.height },
      ],
    };

    return appRules[appName] || [];
  }

  /**
   * Generate automatic text overlays from AI summaries
   * @param {Array} screenshots - Screenshots with AI analysis
   * @param {number} videoDuration - Total video duration
   */
  static generateAutoTextOverlays(screenshots, videoDuration) {
    const overlays = [];
    let currentTime = 0;

    screenshots.forEach((screenshot, idx) => {
      const duration = screenshot.duration || 2.0;

      // Add summary as caption
      if (screenshot.ai_summary) {
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

      // Add timestamp in top-left
      overlays.push({
        text: new Date(screenshot.timestamp).toLocaleTimeString(),
        startTime: currentTime,
        duration: duration,
        position: 'top-left',
        fontSize: 24,
        fontColor: 'white@0.7',
        backgroundColor: 'transparent'
      });

      // Add success indicator for hero moments
      if (screenshot.is_success && screenshot.relevance_score >= 0.8) {
        overlays.push({
          text: '✓ Success',
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

    return overlays;
  }
}

export default VideoEnhancements;
