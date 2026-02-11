#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

class ScreenshotCapture {
  /**
   * Capture full screen screenshot using macOS native screencapture
   * @param {string} outputPath - Full path where screenshot should be saved
   * @returns {Promise<string>} - Path to saved screenshot
   */
  static async captureFullScreen(outputPath) {
    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });

      // screencapture options:
      // -x: no shutter sound
      // -t png: PNG format
      // outputPath: where to save
      await execAsync(`screencapture -x -t png "${outputPath}"`);

      // Verify file was created
      try {
        await fs.access(outputPath);
        return outputPath;
      } catch (error) {
        throw new Error(`Screenshot was not created at ${outputPath}`);
      }
    } catch (error) {
      throw new Error(`Failed to capture screenshot: ${error.message}`);
    }
  }

  /**
   * Generate screenshot filename with timestamp
   * @param {string} sessionDir - Directory for session screenshots
   * @param {number} frameNumber - Sequential frame number
   * @returns {string} - Full path for screenshot
   */
  static getScreenshotPath(sessionDir, frameNumber) {
    const filename = `frame_${String(frameNumber).padStart(4, '0')}.png`;
    return path.join(sessionDir, filename);
  }

  /**
   * Get current timestamp in ISO format
   * @returns {string} - ISO timestamp
   */
  static getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Capture screenshot and save with sequential naming
   * @param {string} sessionDir - Directory for session screenshots
   * @param {number} frameNumber - Sequential frame number
   * @returns {Promise<Object>} - Screenshot metadata {path, timestamp}
   */
  static async capture(sessionDir, frameNumber) {
    const screenshotPath = this.getScreenshotPath(sessionDir, frameNumber);
    const timestamp = this.getTimestamp();

    await this.captureFullScreen(screenshotPath);

    return {
      path: screenshotPath,
      timestamp: timestamp,
      frameNumber: frameNumber
    };
  }

  /**
   * Check if screencapture is available (macOS only)
   * @returns {Promise<boolean>}
   */
  static async isAvailable() {
    try {
      await execAsync('which screencapture');
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default ScreenshotCapture;
