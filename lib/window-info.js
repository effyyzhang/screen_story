#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class WindowInfo {
  /**
   * Get active window information using AppleScript
   * @returns {Promise<Object>} - {appName, windowTitle}
   */
  static async getActiveWindow() {
    try {
      const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set appName to name of frontApp

          try
            set windowTitle to name of front window of frontApp
          on error
            set windowTitle to ""
          end try

          return appName & "|DELIMITER|" & windowTitle
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
      const [appName, windowTitle] = stdout.trim().split('|DELIMITER|');

      return {
        appName: appName || 'Unknown',
        windowTitle: windowTitle || ''
      };
    } catch (error) {
      console.error('Error getting active window:', error.message);
      return {
        appName: 'Unknown',
        windowTitle: ''
      };
    }
  }

  /**
   * Monitor for app switches
   * Calls callback when active app changes
   * @param {Function} callback - Called with (newAppName, newWindowTitle)
   * @param {number} pollInterval - How often to check (ms)
   * @returns {Object} - {stop} function to stop monitoring
   */
  static monitorAppSwitches(callback, pollInterval = 1000) {
    let lastAppName = null;
    let isRunning = true;

    const check = async () => {
      if (!isRunning) return;

      try {
        const { appName, windowTitle } = await this.getActiveWindow();

        if (appName !== lastAppName && lastAppName !== null) {
          // App switch detected
          callback(appName, windowTitle);
        }

        lastAppName = appName;
      } catch (error) {
        console.error('Error monitoring app switches:', error.message);
      }

      if (isRunning) {
        setTimeout(check, pollInterval);
      }
    };

    // Start monitoring
    check();

    return {
      stop: () => {
        isRunning = false;
      }
    };
  }

  /**
   * Get list of running applications
   * @returns {Promise<Array<string>>} - Array of app names
   */
  static async getRunningApps() {
    try {
      const script = `
        tell application "System Events"
          set appList to name of every application process whose background only is false
          return appList
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
      const apps = stdout.trim().split(', ').filter(Boolean);
      return apps;
    } catch (error) {
      console.error('Error getting running apps:', error.message);
      return [];
    }
  }

  /**
   * Check if a specific app is running
   * @param {string} appName - Name of the app to check
   * @returns {Promise<boolean>}
   */
  static async isAppRunning(appName) {
    try {
      const script = `
        tell application "System Events"
          set isRunning to exists (application process "${appName}")
          return isRunning
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
      return stdout.trim() === 'true';
    } catch (error) {
      return false;
    }
  }
}

export default WindowInfo;
