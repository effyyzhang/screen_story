#!/usr/bin/env node

/**
 * Screen Story Web UI Server
 * Simple HTTP server for browsing and searching screenshots
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import ScreenStoryDB from './lib/database.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));

// Serve screenshot images
app.use('/screenshots', express.static(path.join(__dirname, 'sessions')));
app.use('/videos', express.static(path.join(__dirname, 'videos')));

// Database instance
const db = new ScreenStoryDB();

// ==================== API Routes ====================

// Get all sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = db.db.prepare(`
      SELECT
        s.*,
        COUNT(DISTINCT sc.id) as screenshot_count,
        COUNT(CASE WHEN sc.analyzed = 1 THEN 1 END) as analyzed_count,
        AVG(CASE WHEN sc.relevance_score IS NOT NULL THEN sc.relevance_score ELSE 0 END) as avg_relevance
      FROM sessions s
      LEFT JOIN screenshots sc ON s.id = sc.session_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).all();

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get session details with screenshots
app.get('/api/sessions/:id', (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const session = db.getSessionById(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const screenshots = db.getScreenshotsBySession(sessionId);

    res.json({
      ...session,
      screenshots: screenshots.map(s => ({
        ...s,
        // Normalize relevance score to 0-100 for display
        relevance_display: s.relevance_score !== null ? Math.round(s.relevance_score * 100) : null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search screenshots
app.get('/api/search', (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const results = db.searchScreenshots(query);

    res.json(results.map(s => ({
      ...s,
      relevance_display: s.relevance_score !== null ? Math.round(s.relevance_score * 100) : null
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get capture status
app.get('/api/capture/status', async (req, res) => {
  try {
    const { stdout } = await execAsync('node capture-daemon.js status');
    const isRunning = stdout.includes('✅ Capture daemon is running');

    let currentSession = null;
    if (isRunning) {
      const match = stdout.match(/Session: (.+)/);
      if (match) {
        currentSession = match[1].trim();
      }
    }

    res.json({
      running: isRunning,
      session: currentSession,
      output: stdout
    });
  } catch (error) {
    res.json({ running: false, session: null });
  }
});

// Start capture
app.post('/api/capture/start', async (req, res) => {
  try {
    const { sessionName, description } = req.body;

    if (!sessionName) {
      return res.status(400).json({ error: 'Session name is required' });
    }

    const { stdout } = await execAsync(
      `node capture-daemon.js start "${sessionName}" "${description || 'Screen recording session'}"`
    );

    res.json({
      success: true,
      output: stdout,
      session: sessionName
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop capture
app.post('/api/capture/stop', async (req, res) => {
  try {
    const { stdout } = await execAsync('node capture-daemon.js stop');
    res.json({
      success: true,
      output: stdout
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze session
app.post('/api/analyze/:sessionName', async (req, res) => {
  try {
    const { sessionName } = req.params;

    // Start analysis in background
    exec(`node analyze-session.js "${sessionName}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('Analysis error:', error);
      }
    });

    res.json({
      success: true,
      message: 'Analysis started in background'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create video
app.post('/api/export/video', async (req, res) => {
  try {
    const { sessionName, heroOnly = false } = req.body;

    if (!sessionName) {
      return res.status(400).json({ error: 'Session name is required' });
    }

    const cmd = heroOnly
      ? `node create-video.js "${sessionName}" --hero-only`
      : `node create-video.js "${sessionName}"`;

    const { stdout } = await execAsync(cmd);

    res.json({
      success: true,
      output: stdout
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.db.prepare(`
      SELECT
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(sc.id) as total_screenshots,
        COUNT(CASE WHEN sc.analyzed = 1 THEN 1 END) as analyzed_screenshots,
        AVG(CASE WHEN sc.relevance_score IS NOT NULL THEN sc.relevance_score ELSE 0 END) as avg_relevance
      FROM sessions s
      LEFT JOIN screenshots sc ON s.id = sc.session_id
    `).get();

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Start Server ====================

app.listen(PORT, () => {
  console.log(`
🎬 Screen Story Web UI

Server running at: http://localhost:${PORT}
API available at: http://localhost:${PORT}/api

Available routes:
  GET  /api/sessions          - List all sessions
  GET  /api/sessions/:id      - Get session details
  GET  /api/search?q=...      - Search screenshots
  GET  /api/capture/status    - Get capture status
  POST /api/capture/start     - Start capture
  POST /api/capture/stop      - Stop capture
  POST /api/analyze/:session  - Analyze session
  POST /api/export/video      - Create video
  GET  /api/stats             - Get overall stats

Press Ctrl+C to stop
`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
