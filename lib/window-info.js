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
   * Get active window with position and dimensions
   * @returns {Promise<Object>} - { appName, windowTitle, bounds: { x, y, width, height, screenWidth, screenHeight, isFullscreen } }
   */
  static async getActiveWindowBounds() {
    try {
      const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set appName to name of frontApp

          try
            set frontWindow to front window of frontApp
            set windowTitle to name of frontWindow
            set {x, y} to position of frontWindow
            set {w, h} to size of frontWindow

            -- Get screen resolution for fullscreen detection
            tell application "Finder"
              set screenBounds to bounds of window of desktop
              set screenW to item 3 of screenBounds
              set screenH to item 4 of screenBounds
            end tell

            return appName & "|" & windowTitle & "|" & x & "|" & y & "|" & w & "|" & h & "|" & screenW & "|" & screenH
          on error
            return appName & "|" & "" & "|-1|-1|-1|-1|-1|-1"
          end try
        end tell
      `;

      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
      const [appName, windowTitle, x, y, width, height, screenWidth, screenHeight] = stdout.trim().split('|');

      const hasValidBounds = x !== '-1' && width !== '-1';
      const isFullscreen = hasValidBounds && this.isFullscreen(
        { x: parseInt(x), y: parseInt(y), width: parseInt(width), height: parseInt(height) },
        { width: parseInt(screenWidth), height: parseInt(screenHeight) }
      );

      return {
        appName: appName || 'Unknown',
        windowTitle: windowTitle || '',
        bounds: hasValidBounds ? {
          x: parseInt(x),
          y: parseInt(y),
          width: parseInt(width),
          height: parseInt(height),
          screenWidth: parseInt(screenWidth),
          screenHeight: parseInt(screenHeight),
          isFullscreen
        } : null
      };
    } catch (error) {
      console.error('Error getting window bounds:', error.message);
      return {
        appName: 'Unknown',
        windowTitle: '',
        bounds: null
      };
    }
  }

  /**
   * Check if a window is fullscreen
   * @param {Object} window - {x, y, width, height}
   * @param {Object} screen - {width, height}
   * @returns {boolean}
   */
  static isFullscreen(window, screen) {
    const margin = 100; // Account for menu bar (44px) + dock
    return (
      window.width >= screen.width - margin &&
      window.height >= screen.height - margin
    );
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
