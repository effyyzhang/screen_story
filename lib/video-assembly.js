#!/usr/bin/env node
import Database from './database.js';
import ScreenshotCapture from './screenshot.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Intelligent video assembly service
 * Selects frames, applies cropping, prepares for export
 */
export class VideoAssembly {
  constructor(db) {
    this.db = db;
  }

  /**
   * Select frames for video assembly
   * @param {string} sessionName - Session to export
   * @param {Object} options
   * @param {string} options.mode - 'all' | 'hero' | 'super-hero' | 'custom'
   * @param {number} options.minRelevance - Custom threshold (0.0-1.0)
   * @param {boolean} options.applyCropping - Crop windowed frames
   * @returns {Array} Selected frames with metadata
   */
  async selectFrames(sessionName, options = {}) {
    const { mode = 'hero', minRelevance = 0.7, applyCropping = true } = options;

    // Query based on mode
    let threshold;
    switch (mode) {
      case 'super-hero':
        threshold = 0.8;
        break;
      case 'hero':
        threshold = 0.7;
        break;
      case 'all':
        threshold = 0.0;
        break;
      case 'custom':
        threshold = minRelevance;
        break;
      default:
        threshold = 0.7;
    }

    // Get session screenshots filtered by relevance
    const session = this.db.getSessionByName(sessionName);
    if (!session) {
      throw new Error(`Session not found: ${sessionName}`);
    }

    const screenshots = this.db.getScreenshotsBySession(session.id);
    const filtered = screenshots.filter(s =>
      s.analyzed && (s.relevance_score || 0) >= threshold
    );

    console.log(`Selected ${filtered.length}/${screenshots.length} frames (mode: ${mode}, threshold: ${threshold})`);

    // Sort chronologically
    filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Apply intelligent pacing (use relevance for duration)
    const prepared = filtered.map(s => ({
      ...s,
      duration: this.calculateDuration(s.relevance_score),
      needsCropping: applyCropping && !s.is_fullscreen && s.window_width
    }));

    return prepared;
  }

  /**
   * Calculate frame duration based on relevance
   * Higher relevance = longer duration
   * @param {number} relevance - Relevance score (0.0-1.0)
   * @returns {number} Duration in seconds
   */
  calculateDuration(relevance) {
    const minDuration = 1.0;  // seconds
    const maxDuration = 3.0;  // seconds
    return minDuration + (maxDuration - minDuration) * (relevance || 0.5);
  }

  /**
   * Prepare frames for export (apply cropping if needed)
   * @param {Array} frames - Selected frames from selectFrames()
   * @param {string} tempDir - Temp directory for cropped images
   * @returns {Array} Frames with cropped paths
   */
  async prepareFrames(frames, tempDir) {
    await fs.mkdir(tempDir, { recursive: true });

    const prepared = [];
    let croppedCount = 0;

    for (const frame of frames) {
      if (frame.needsCropping) {
        // Crop to window bounds
        const croppedPath = path.join(tempDir, `cropped_${frame.id}.png`);
        const bounds = {
          x: frame.window_x,
          y: frame.window_y,
          width: frame.window_width,
          height: frame.window_height,
          screenWidth: frame.screen_width,
          screenHeight: frame.screen_height
        };

        try {
          await ScreenshotCapture.cropToWindow(frame.file_path, bounds, croppedPath);
          prepared.push({ ...frame, exportPath: croppedPath, wasCropped: true });
          croppedCount++;
        } catch (error) {
          console.warn(`Crop failed for frame ${frame.id}, using original:`, error.message);
          prepared.push({ ...frame, exportPath: frame.file_path, wasCropped: false });
        }
      } else {
        // Use original
        prepared.push({ ...frame, exportPath: frame.file_path, wasCropped: false });
      }
    }

    console.log(`Prepared ${prepared.length} frames (${croppedCount} cropped)`);
    return prepared;
  }

  /**
   * Clean up temp cropped files
   * @param {string} tempDir - Temp directory to remove
   */
  async cleanup(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log(`Cleaned up temp directory: ${tempDir}`);
    } catch (error) {
      console.warn(`Failed to cleanup temp directory: ${error.message}`);
    }
  }

  /**
   * Get statistics about selected frames
   * @param {Array} frames - Prepared frames
   * @returns {Object} Statistics
   */
  getStats(frames) {
    const totalDuration = frames.reduce((sum, f) => sum + f.duration, 0);
    const croppedCount = frames.filter(f => f.wasCropped).length;
    const avgRelevance = frames.reduce((sum, f) => sum + (f.relevance_score || 0), 0) / frames.length;

    return {
      frameCount: frames.length,
      totalDuration: totalDuration.toFixed(2),
      croppedCount,
      avgRelevance: (avgRelevance * 100).toFixed(1),
      minRelevance: Math.min(...frames.map(f => f.relevance_score || 0)) * 100,
      maxRelevance: Math.max(...frames.map(f => f.relevance_score || 0)) * 100
    };
  }
}

export default VideoAssembly;
