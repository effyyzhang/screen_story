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
import VideoAssembly from './lib/video-assembly.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import sharp from 'sharp';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));

// Thumbnail generation middleware (must be BEFORE static middleware)
const THUMBNAIL_DIR = path.join(__dirname, 'sessions', '.thumbnails');

// Ensure thumbnail directory exists
await fs.mkdir(THUMBNAIL_DIR, { recursive: true }).catch(() => {});

// Thumbnail middleware - intercepts /screenshots/:session/:filename requests
app.get('/screenshots/:session/:filename', async (req, res, next) => {
  const { session, filename } = req.params;
  const { size } = req.query; // ?size=thumb|medium|full

  // If no size or size=full, serve original
  if (!size || size === 'full') {
    return next(); // Let express.static handle it
  }

  const originalPath = path.join(__dirname, 'sessions', session, filename);
  const thumbFilename = `${session}_${filename.replace('.png', `_${size}.webp`)}`;
  const thumbPath = path.join(THUMBNAIL_DIR, thumbFilename);

  try {
    // Check if thumbnail exists and is fresh
    try {
      const [thumbStat, origStat] = await Promise.all([
        fs.stat(thumbPath),
        fs.stat(originalPath)
      ]);

      if (thumbStat.mtime > origStat.mtime) {
        // Cached thumbnail is fresh
        return res.sendFile(thumbFilename, { root: THUMBNAIL_DIR });
      }
    } catch (err) {
      // Thumbnail doesn't exist, will generate below
    }

    // Generate thumbnail
    const sizeConfig = {
      thumb: { width: 400, height: 260, quality: 80 },
      medium: { width: 800, height: 520, quality: 85 }
    };

    const config = sizeConfig[size] || sizeConfig.thumb;

    await sharp(originalPath)
      .resize(config.width, config.height, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: config.quality })
      .toFile(thumbPath);

    res.sendFile(thumbFilename, { root: THUMBNAIL_DIR });
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    next(); // Fallback to original image
  }
});

// Serve screenshot images (fallback for full-size)
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

// Get active recording session (must be BEFORE :id route)
app.get('/api/sessions/active', (req, res) => {
  try {
    const activeSession = db.getActiveSession();

    res.json({
      hasActiveSession: Boolean(activeSession),
      session: activeSession || null
    });
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
    const db = new ScreenStoryDB();
    const activeSession = db.getActiveSession();
    db.close();

    res.json({
      running: !!activeSession,
      session: activeSession ? activeSession.session_name : null,
      sessionId: activeSession ? activeSession.id : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start capture
app.post('/api/capture/start', async (req, res) => {
  try {
    const { sessionName, description } = req.body;

    if (!sessionName) {
      return res.status(400).json({ error: 'Session name is required' });
    }

    const db = new ScreenStoryDB();
    const sessionId = db.createSession(sessionName, description || 'Screen recording session', false);
    db.close();

    res.json({
      success: true,
      session: sessionName,
      sessionId,
      message: 'Session created - daemon will start capturing automatically'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop capture
app.post('/api/capture/stop', async (req, res) => {
  try {
    const db = new ScreenStoryDB();
    const activeSession = db.getActiveSession();

    if (!activeSession) {
      db.close();
      return res.status(400).json({ error: 'No active session to stop' });
    }

    db.stopSession(activeSession.id);
    db.close();

    res.json({
      success: true,
      session: activeSession.session_name,
      message: 'Session stopped'
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

// AI-Powered Video Assembly
app.post('/api/video/assemble', async (req, res) => {
  try {
    const { sessionName, mode = 'hero', autoCrop = true, format = 'mp4' } = req.body;

    if (!sessionName) {
      return res.status(400).json({ error: 'Session name is required' });
    }

    const assembly = new VideoAssembly(db);

    // Select and prepare frames
    const frames = await assembly.selectFrames(sessionName, {
      mode,
      applyCropping: autoCrop
    });

    if (frames.length === 0) {
      return res.json({
        success: false,
        error: 'No frames selected. Session may have no analyzed frames with sufficient relevance.'
      });
    }

    const tempDir = path.join(__dirname, 'temp', `export_${Date.now()}`);
    const prepared = await assembly.prepareFrames(frames, tempDir);

    // Get stats
    const stats = assembly.getStats(prepared);

    let result;
    if (format === 'jianying') {
      // JianYing export (falls back to manual for now)
      const outputPath = path.join(__dirname, 'exports', `${sessionName}_jianying.json`);
      result = {
        success: false,
        message: 'JianYing MCP integration is experimental. Use MP4 format for now.',
        outputPath,
        stats
      };
    } else {
      // Use existing FFmpeg export
      const outputPath = path.join(__dirname, 'exports', `${sessionName}.mp4`);

      // Build command based on mode
      const heroFlag = (mode === 'hero' || mode === 'super-hero') ? '--hero-only' : '';
      const cmd = `node create-enhanced-video.js "${sessionName}" ${heroFlag}`.trim();

      try {
        const { stdout } = await execAsync(cmd);
        result = {
          success: true,
          outputPath,
          output: stdout,
          stats
        };
      } catch (error) {
        result = {
          success: false,
          error: `FFmpeg export failed: ${error.message}`,
          stats
        };
      }
    }

    // Cleanup temp files
    await assembly.cleanup(tempDir);

    res.json(result);
  } catch (error) {
    console.error('Video assembly error:', error);
    res.status(500).json({ success: false, error: error.message });
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

// ==================== Eagle-Style UI Endpoints ====================

// Get folder counts for apps
app.get('/api/folders/apps', (req, res) => {
  try {
    const apps = db.getAppCounts();
    res.json({ apps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get folder counts for sessions
app.get('/api/folders/sessions', (req, res) => {
  try {
    const sessions = db.getSessionCounts();
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get folder counts for time periods
app.get('/api/folders/time-periods', (req, res) => {
  try {
    const timePeriods = db.getTimePeriodCounts();
    res.json(timePeriods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get folder counts for success/hero
app.get('/api/folders/success', (req, res) => {
  try {
    const counts = db.getSuccessCounts();
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Combined folder counts endpoint (reduces 4 API calls to 1)
app.get('/api/folders/all', (req, res) => {
  try {
    const counts = db.getAllFolderCounts();
    res.json(counts);
  } catch (error) {
    console.error('Failed to get folder counts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get paginated screenshots with filtering
app.get('/api/screenshots', (req, res) => {
  try {
    const { page, limit, folder, sort, q, dateStart, dateEnd, apps, since } = req.query;

    // Parse folder parameter (format: "type:value")
    let filter = null;
    if (folder && folder !== 'all') {
      const [type, value] = folder.split(':');
      if (type === 'app') {
        filter = { app: value };
      } else if (type === 'session') {
        filter = { session: value };
      } else if (type === 'time') {
        filter = { timeRange: value };
      } else if (type === 'success') {
        filter = { success: value };
      }
    }

    // Apply advanced filters (only when folder='all' or no folder specified)
    if (!filter || folder === 'all') {
      filter = filter || {};

      // Text search filter
      if (q) {
        filter.textSearch = q;
      }

      // Date range filters
      if (dateStart) {
        filter.dateStart = dateStart;
      }
      if (dateEnd) {
        filter.dateEnd = dateEnd;
      }

      // Multi-app filter (comma-separated string to array)
      if (apps) {
        filter.apps = apps.split(',').map(a => a.trim()).filter(a => a);
      }

      // Delta sync: only fetch screenshots newer than timestamp
      if (since) {
        filter.since = since;
      }
    }

    // Parse sort parameter
    let sortBy = 'timestamp';
    let sortOrder = 'desc';
    if (sort) {
      const [field, order] = sort.split('-');
      sortBy = field;
      sortOrder = order;
    }

    const result = db.getScreenshotsPaginated({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      filter,
      sortBy,
      sortOrder
    });

    // Add window info and normalize relevance scores for display
    result.screenshots = result.screenshots.map(s => ({
      ...s,
      relevance_display: s.relevance_score !== null ? Math.round(s.relevance_score * 100) : null,
      window_info: s.window_width ? {
        dimensions: `${s.window_width}×${s.window_height}`,
        position: `(${s.window_x}, ${s.window_y})`,
        isFullscreen: Boolean(s.is_fullscreen),
        wasCropped: Boolean(s.was_cropped)
      } : null
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk tag screenshots
app.post('/api/screenshots/bulk-tag', async (req, res) => {
  try {
    const { ids, tags } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ error: 'tags array is required' });
    }

    db.bulkUpdateTags(ids, tags);

    res.json({
      success: true,
      message: `Updated tags for ${ids.length} screenshot(s)`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete screenshots
app.post('/api/screenshots/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    db.bulkDelete(ids);

    res.json({
      success: true,
      message: `Deleted ${ids.length} screenshot(s)`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update single screenshot tags
app.patch('/api/screenshots/:id/tags', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { tags } = req.body;

    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ error: 'tags array is required' });
    }

    db.updateScreenshotTags(id, tags);

    res.json({
      success: true,
      message: 'Tags updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Start Server ====================

app.listen(PORT, () => {
  console.log(`
🎬 Screen Story Web UI (Eagle-Style)

Server running at: http://localhost:${PORT}
API available at: http://localhost:${PORT}/api

Available routes:
  GET  /api/sessions               - List all sessions
  GET  /api/sessions/:id           - Get session details
  GET  /api/search?q=...           - Search screenshots
  GET  /api/capture/status         - Get capture status
  POST /api/capture/start          - Start capture
  POST /api/capture/stop           - Stop capture
  POST /api/analyze/:session       - Analyze session
  POST /api/export/video           - Create video
  GET  /api/stats                  - Get overall stats

  Eagle-Style UI:
  GET  /api/folders/apps           - Get app folder counts
  GET  /api/folders/sessions       - Get session folder counts
  GET  /api/folders/time-periods   - Get time period counts
  GET  /api/folders/success        - Get success/hero counts
  GET  /api/screenshots            - Get paginated screenshots (with filters)
  POST /api/screenshots/bulk-tag   - Bulk tag screenshots
  POST /api/screenshots/bulk-delete - Bulk delete screenshots
  PATCH /api/screenshots/:id/tags  - Update screenshot tags

Press Ctrl+C to stop
`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
