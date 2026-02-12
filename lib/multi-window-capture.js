#!/usr/bin/env node

/**
 * Multi-Window Capture Module
 * Intelligently captures background app windows for demo videos
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

class MultiWindowCapture {
  /**
   * Get all window IDs for running apps
   * @returns {Promise<Array>} Array of {appName, windowId, windowTitle}
   */
  static async getAllWindows() {
    try {
      // Use AppleScript to get all window information
      const script = `
        tell application "System Events"
          set windowList to {}
          repeat with proc in (every process whose background only is false)
            set procName to name of proc
            try
              tell proc
                repeat with win in windows
                  set windowTitle to name of win
                  set end of windowList to {procName, windowTitle}
                end repeat
              end tell
            end try
          end repeat
          return windowList
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);

      // Parse AppleScript output
      const windows = [];
      const lines = stdout.trim().split(', ');

      for (let i = 0; i < lines.length; i += 2) {
        if (i + 1 < lines.length) {
          windows.push({
            appName: lines[i],
            windowTitle: lines[i + 1]
          });
        }
      }

      return windows;
    } catch (error) {
      console.error('Error getting windows:', error.message);
      return [];
    }
  }

  /**
   * Capture specific app window (brings to front temporarily)
   * @param {string} appName - Name of the app (e.g., "Messages", "Google Chrome")
   * @param {string} outputPath - Where to save screenshot
   * @param {boolean} restoreFocus - Return focus to original app after capture
   */
  static async captureAppWindow(appName, outputPath, restoreFocus = true) {
    try {
      // Get current frontmost app to restore later
      let originalApp = null;
      if (restoreFocus) {
        try {
          const { stdout } = await execAsync(`osascript -e 'tell application "System Events" to return name of first application process whose frontmost is true'`);
          originalApp = stdout.trim();
        } catch (e) {
          // If can't get original app, just proceed without restoring
        }
      }

      // Activate the target app (bring to front)
      await execAsync(`osascript -e 'tell application "${appName}" to activate'`);

      // Wait a moment for window to come to front
      await new Promise(resolve => setTimeout(resolve, 300));

      // Capture the now-active window
      await execAsync(`screencapture -x "${outputPath}"`);

      // Restore original app focus
      if (restoreFocus && originalApp && originalApp !== appName) {
        try {
          await execAsync(`osascript -e 'tell application "${originalApp}" to activate'`);
        } catch (e) {
          // Ignore errors restoring focus
        }
      }

      return outputPath;
    } catch (error) {
      throw new Error(`Failed to capture ${appName}: ${error.message}`);
    }
  }

  /**
   * Capture multiple app windows at once
   * @param {Array<string>} appNames - Array of app names to capture
   * @param {string} outputDir - Directory to save screenshots
   * @param {string} prefix - Filename prefix (e.g., "frame_0001")
   */
  static async captureMultipleWindows(appNames, outputDir, prefix = 'capture') {
    const results = [];

    for (const appName of appNames) {
      try {
        const sanitizedName = appName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const outputPath = path.join(outputDir, `${prefix}_${sanitizedName}.png`);

        await this.captureAppWindow(appName, outputPath);

        results.push({
          appName,
          path: outputPath,
          success: true
        });
      } catch (error) {
        results.push({
          appName,
          error: error.message,
          success: false
        });
      }
    }

    return results;
  }

  /**
   * AI-powered: Predict which apps to monitor based on task description
   * @param {string} taskDescription - Task being performed
   * @returns {Array<string>} App names to monitor
   */
  static predictAppsForTask(taskDescription) {
    const taskLower = taskDescription.toLowerCase();
    const appsToMonitor = new Set();

    // Always monitor terminal if it's a CLI task
    if (taskLower.includes('command') || taskLower.includes('cli') || taskLower.includes('terminal')) {
      appsToMonitor.add('Terminal');
      appsToMonitor.add('iTerm2');
      appsToMonitor.add('ghostty');
    }

    // Messaging apps
    if (taskLower.includes('message') || taskLower.includes('imessage') || taskLower.includes('text')) {
      appsToMonitor.add('Messages');
    }

    if (taskLower.includes('slack')) {
      appsToMonitor.add('Slack');
    }

    if (taskLower.includes('email') || taskLower.includes('mail')) {
      appsToMonitor.add('Mail');
    }

    // Browsers
    if (taskLower.includes('browser') || taskLower.includes('web') || taskLower.includes('chrome') ||
        taskLower.includes('safari') || taskLower.includes('firefox')) {
      appsToMonitor.add('Google Chrome');
      appsToMonitor.add('Safari');
      appsToMonitor.add('Firefox');
    }

    // Development
    if (taskLower.includes('code') || taskLower.includes('debug') || taskLower.includes('develop')) {
      appsToMonitor.add('Visual Studio Code');
      appsToMonitor.add('Cursor');
      appsToMonitor.add('Xcode');
    }

    // Calendar
    if (taskLower.includes('calendar') || taskLower.includes('meeting') || taskLower.includes('event')) {
      appsToMonitor.add('Calendar');
    }

    // Notes
    if (taskLower.includes('note') || taskLower.includes('document')) {
      appsToMonitor.add('Notes');
      appsToMonitor.add('Notion');
    }

    return Array.from(appsToMonitor);
  }

  /**
   * Monitor and capture windows based on task
   * @param {string} taskDescription - What the user is trying to accomplish
   * @param {string} outputDir - Where to save screenshots
   * @param {Object} options - {interval: 5000, duration: 60000, captureActive: true, manualApps: []}
   */
  static async monitorTaskWindows(taskDescription, outputDir, options = {}) {
    const {
      interval = 5000,        // Capture every 5 seconds
      duration = 60000,       // Monitor for 1 minute
      captureActive = true,   // Also capture active window
      onCapture = null,       // Callback when capture happens
      manualApps = null       // Manual app list (overrides prediction)
    } = options;

    // Use manual apps or predict based on task
    const appsToMonitor = manualApps || this.predictAppsForTask(taskDescription);

    console.log('📱 Monitoring apps:', appsToMonitor.join(', '));

    await fs.mkdir(outputDir, { recursive: true });

    let captureCount = 0;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const intervalId = setInterval(async () => {
        captureCount++;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const prefix = `frame_${String(captureCount).padStart(4, '0')}`;

        try {
          // Capture active window (normal screenshot)
          if (captureActive) {
            const activePath = path.join(outputDir, `${prefix}_active.png`);
            await execAsync(`screencapture -x "${activePath}"`);
          }

          // Capture all monitored app windows
          const results = await this.captureMultipleWindows(
            appsToMonitor,
            outputDir,
            prefix
          );

          if (onCapture) {
            onCapture({
              frameNumber: captureCount,
              timestamp,
              results,
              active: captureActive
            });
          }

          // Check if duration exceeded
          if (Date.now() - startTime >= duration) {
            clearInterval(intervalId);
            resolve({
              totalCaptures: captureCount,
              appsMonitored: appsToMonitor,
              duration: Date.now() - startTime
            });
          }
        } catch (error) {
          console.error('Capture error:', error.message);
        }
      }, interval);
    });
  }

  /**
   * Smart capture: Only capture when window content changes
   * Uses image comparison to avoid duplicate frames
   */
  static async captureOnChange(appName, outputDir, options = {}) {
    const {
      checkInterval = 2000,   // Check every 2 seconds
      similarity = 0.95,      // 95% similar = no capture
      maxDuration = 300000    // 5 minutes max
    } = options;

    // TODO: Implement using sharp for image comparison
    // This would compare consecutive screenshots and only save if different
    throw new Error('Not implemented yet - requires image comparison library');
  }

  /**
   * Get currently running apps (visible ones)
   */
  static async getRunningApps() {
    try {
      const script = `
        tell application "System Events"
          return name of every process whose background only is false
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
      return stdout.trim().split(', ');
    } catch (error) {
      console.error('Error getting running apps:', error.message);
      return [];
    }
  }

  /**
   * Manual mode: User specifies exact apps to capture
   * Usage: multiWindowCapture.manualCapture(['Messages', 'Chrome'], './output')
   */
  static async manualCapture(appNames, outputDir) {
    const timestamp = Date.now();
    const results = await this.captureMultipleWindows(appNames, outputDir, `manual_${timestamp}`);

    console.log('📸 Manual capture results:');
    results.forEach(r => {
      if (r.success) {
        console.log(`  ✓ ${r.appName}: ${r.path}`);
      } else {
        console.log(`  ✗ ${r.appName}: ${r.error}`);
      }
    });

    return results;
  }
}

export default MultiWindowCapture;
