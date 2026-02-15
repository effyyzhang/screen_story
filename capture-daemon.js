#!/usr/bin/env node
import ScreenStoryDB from './lib/database.js';
import ScreenshotCapture from './lib/screenshot.js';
import WindowInfo from './lib/window-info.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CAPTURE_INTERVAL = 10 * 1000; // 10 seconds
const CHECK_SESSION_INTERVAL = 5 * 1000; // Check for active session every 5 seconds

class CaptureDaemon {
  constructor() {
    this.db = new ScreenStoryDB();
    this.isCapturing = false;
    this.currentSession = null;
    this.captureTimer = null;
    this.appMonitor = null;
    this.frameNumber = 0;
  }

  async start() {
    console.log('🎬 Screen Story - Capture Daemon\n');
    console.log('🔍 Monitoring for active recording sessions...');
    console.log('   (Daemon will capture screenshots when a session is active)\n');

    // Check screenshot capability
    const isAvailable = await ScreenshotCapture.isAvailable();
    if (!isAvailable) {
      console.error('❌ screencapture command not found (macOS only)');
      process.exit(1);
    }

    // Start monitoring for sessions
    this.checkForActiveSession();

    // Keep process alive
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  async checkForActiveSession() {
    try {
      const activeSession = this.db.getActiveSession();

      // Session started
      if (activeSession && !this.isCapturing) {
        await this.startCapturing(activeSession);
      }

      // Session stopped
      if (!activeSession && this.isCapturing) {
        await this.stopCapturing();
      }

      // Update current session if changed
      if (activeSession && this.currentSession && activeSession.id !== this.currentSession.id) {
        await this.stopCapturing();
        await this.startCapturing(activeSession);
      }
    } catch (error) {
      console.error('❌ Error checking session:', error.message);
    }

    // Check again after interval
    setTimeout(() => this.checkForActiveSession(), CHECK_SESSION_INTERVAL);
  }

  async startCapturing(session) {
    this.currentSession = session;
    this.isCapturing = true;
    this.frameNumber = session.screenshot_count;

    console.log(`🔴 Started capturing: ${session.session_name}`);
    console.log(`   Mode: ${session.is_continuous ? 'Continuous' : 'Task-Focused'}`);
    console.log(`   Interval: ${CAPTURE_INTERVAL / 1000}s\n`);

    // Start timer-based capture
    this.captureTimer = setInterval(() => this.captureScreenshot(), CAPTURE_INTERVAL);

    // Start app switch monitoring
    this.appMonitor = WindowInfo.monitorAppSwitches(async (appName, windowTitle) => {
      console.log(`🔄 App switch detected: ${appName}`);
      await this.captureScreenshot('App Switch');
    });

    // Take first screenshot immediately
    await this.captureScreenshot('Initial');
  }

  async stopCapturing() {
    if (!this.isCapturing) return;

    console.log(`🛑 Stopped capturing: ${this.currentSession.session_name}\n`);
    console.log('🔍 Monitoring for active recording sessions...\n');

    this.isCapturing = false;
    this.currentSession = null;
    this.frameNumber = 0;

    if (this.captureTimer) {
      clearInterval(this.captureTimer);
      this.captureTimer = null;
    }

    if (this.appMonitor) {
      this.appMonitor.stop();
      this.appMonitor = null;
    }
  }

  async captureScreenshot(trigger = 'Timer') {
    if (!this.isCapturing || !this.currentSession) return;

    try {
      this.frameNumber++;

      // Get session directory
      const sessionDir = path.join(__dirname, 'sessions', this.currentSession.session_name);

      // Get active window info WITH bounds
      const windowInfo = await WindowInfo.getActiveWindowBounds();

      // Capture full screenshot (NO cropping during capture)
      const { path: screenshotPath, timestamp } = await ScreenshotCapture.capture(sessionDir, this.frameNumber);

      // Save to database with window bounds metadata
      this.db.addScreenshot(
        this.currentSession.id,
        this.frameNumber,
        timestamp,
        windowInfo.appName,
        windowInfo.windowTitle,
        screenshotPath,
        windowInfo.bounds // Store bounds, but don't crop yet
      );

      // Enhanced logging with window info
      const time = new Date(timestamp).toLocaleTimeString();
      const windowStatus = windowInfo.bounds
        ? (windowInfo.bounds.isFullscreen
            ? 'Fullscreen'
            : `${windowInfo.bounds.width}×${windowInfo.bounds.height} window`)
        : 'Unknown';

      console.log(`📸 [${trigger}] Frame ${this.frameNumber} - ${windowInfo.appName} - ${windowStatus} - ${time}`);
    } catch (error) {
      console.error(`❌ Error capturing screenshot: ${error.message}`);
    }
  }

  stop() {
    console.log('\n🛑 Shutting down capture daemon...');
    this.stopCapturing();
    this.db.close();
    process.exit(0);
  }
}

// Start daemon
const daemon = new CaptureDaemon();
daemon.start();
