#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'sessions', 'screen_story.db');

class ScreenStoryDB {
  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL'); // Better performance for concurrent access
    this.initSchema();
  }

  initSchema() {
    // Sessions table - Physical recording sessions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY,
        session_name TEXT NOT NULL UNIQUE,
        description TEXT,
        started_at DATETIME NOT NULL,
        ended_at DATETIME,
        status TEXT DEFAULT 'recording',
        screenshot_count INTEGER DEFAULT 0,
        is_continuous BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Virtual Sessions table - Retroactively created task groupings
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS virtual_sessions (
        id INTEGER PRIMARY KEY,
        virtual_session_name TEXT NOT NULL UNIQUE,
        parent_session_id INTEGER NOT NULL,
        search_query TEXT,
        ai_detected BOOLEAN DEFAULT 0,
        description TEXT,
        screenshot_ids TEXT,
        screenshot_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_session_id) REFERENCES sessions(id)
      );
    `);

    // Screenshots table - Individual frames
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS screenshots (
        id INTEGER PRIMARY KEY,
        session_id INTEGER NOT NULL,
        frame_number INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        app_name TEXT NOT NULL,
        window_title TEXT,
        file_path TEXT NOT NULL,
        ocr_text TEXT,
        ai_summary TEXT,
        is_success BOOLEAN,
        relevance_score REAL,
        tags TEXT,
        task_cluster_id INTEGER,
        analyzed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
    `);

    // Add window metadata columns (migration-safe)
    const columns = this.db.prepare("PRAGMA table_info(screenshots)").all();
    const hasWindowBounds = columns.some(col => col.name === 'window_x');

    if (!hasWindowBounds) {
      this.db.exec(`
        ALTER TABLE screenshots ADD COLUMN window_x INTEGER;
        ALTER TABLE screenshots ADD COLUMN window_y INTEGER;
        ALTER TABLE screenshots ADD COLUMN window_width INTEGER;
        ALTER TABLE screenshots ADD COLUMN window_height INTEGER;
        ALTER TABLE screenshots ADD COLUMN screen_width INTEGER;
        ALTER TABLE screenshots ADD COLUMN screen_height INTEGER;
        ALTER TABLE screenshots ADD COLUMN is_fullscreen BOOLEAN DEFAULT 1;
        ALTER TABLE screenshots ADD COLUMN was_cropped BOOLEAN DEFAULT 0;
      `);
    }

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_frame ON screenshots(session_id, frame_number);
      CREATE INDEX IF NOT EXISTS idx_session_analyzed ON screenshots(session_id, analyzed);
      CREATE INDEX IF NOT EXISTS idx_app_name ON screenshots(app_name);
      CREATE INDEX IF NOT EXISTS idx_is_success ON screenshots(is_success);
      CREATE INDEX IF NOT EXISTS idx_task_cluster ON screenshots(task_cluster_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON screenshots(timestamp);

      -- NEW: Performance indexes for filtered queries
      CREATE INDEX IF NOT EXISTS idx_analyzed_relevance
        ON screenshots(analyzed, relevance_score)
        WHERE analyzed = 1;

      CREATE INDEX IF NOT EXISTS idx_analyzed_success
        ON screenshots(analyzed, is_success)
        WHERE analyzed = 1;

      CREATE INDEX IF NOT EXISTS idx_timestamp_app
        ON screenshots(timestamp, app_name);

      CREATE INDEX IF NOT EXISTS idx_timestamp_desc
        ON screenshots(timestamp DESC);

      -- Index for filtering by fullscreen status
      CREATE INDEX IF NOT EXISTS idx_is_fullscreen ON screenshots(is_fullscreen);
    `);

    // Full-text search index
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS screenshots_fts USING fts5(
        app_name,
        window_title,
        ocr_text,
        ai_summary,
        tags,
        content='screenshots',
        content_rowid='id'
      );
    `);

    // Triggers to keep FTS index updated
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS screenshots_ai AFTER INSERT ON screenshots BEGIN
        INSERT INTO screenshots_fts(rowid, app_name, window_title, ocr_text, ai_summary, tags)
        VALUES (new.id, new.app_name, new.window_title, COALESCE(new.ocr_text, ''), COALESCE(new.ai_summary, ''), COALESCE(new.tags, '[]'));
      END;

      CREATE TRIGGER IF NOT EXISTS screenshots_au AFTER UPDATE ON screenshots BEGIN
        INSERT OR REPLACE INTO screenshots_fts(rowid, app_name, window_title, ocr_text, ai_summary, tags)
        VALUES (new.id, new.app_name, new.window_title, COALESCE(new.ocr_text, ''), COALESCE(new.ai_summary, ''), COALESCE(new.tags, '[]'));
      END;

      CREATE TRIGGER IF NOT EXISTS screenshots_ad AFTER DELETE ON screenshots BEGIN
        DELETE FROM screenshots_fts WHERE rowid = old.id;
      END;
    `);
  }

  // Session management
  createSession(sessionName, description = null, isContinuous = false) {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (session_name, description, started_at, is_continuous, status)
      VALUES (?, ?, datetime('now'), ?, 'recording')
    `);
    const result = stmt.run(sessionName, description, isContinuous ? 1 : 0);
    return result.lastInsertRowid;
  }

  stopSession(sessionId) {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET ended_at = datetime('now'), status = 'stopped'
      WHERE id = ? AND status = 'recording'
    `);
    return stmt.run(sessionId);
  }

  getActiveSession() {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions WHERE status = 'recording' ORDER BY started_at DESC LIMIT 1
    `);
    return stmt.get();
  }

  getSessionByName(sessionName) {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions WHERE session_name = ?
    `);
    return stmt.get(sessionName);
  }

  getAllSessions() {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions ORDER BY started_at DESC
    `);
    return stmt.all();
  }

  updateSessionScreenshotCount(sessionId) {
    const stmt = this.db.prepare(`
      UPDATE sessions
      SET screenshot_count = (SELECT COUNT(*) FROM screenshots WHERE session_id = ?)
      WHERE id = ?
    `);
    return stmt.run(sessionId, sessionId);
  }

  // Screenshot management
  /**
   * Add screenshot with optional window bounds
   * @param {number} sessionId
   * @param {number} frameNumber
   * @param {string} timestamp
   * @param {string} appName
   * @param {string} windowTitle
   * @param {string} filePath
   * @param {Object|null} windowBounds - { x, y, width, height, screenWidth, screenHeight, isFullscreen }
   */
  addScreenshot(sessionId, frameNumber, timestamp, appName, windowTitle, filePath, windowBounds = null) {
    const stmt = this.db.prepare(`
      INSERT INTO screenshots (
        session_id, frame_number, timestamp, app_name, window_title, file_path,
        window_x, window_y, window_width, window_height,
        screen_width, screen_height, is_fullscreen, was_cropped
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let result;
    if (windowBounds) {
      result = stmt.run(
        sessionId, frameNumber, timestamp, appName, windowTitle, filePath,
        windowBounds.x, windowBounds.y, windowBounds.width, windowBounds.height,
        windowBounds.screenWidth, windowBounds.screenHeight,
        windowBounds.isFullscreen ? 1 : 0,
        0  // was_cropped always 0 during capture
      );
    } else {
      // Fallback for no bounds (assume fullscreen)
      result = stmt.run(
        sessionId, frameNumber, timestamp, appName, windowTitle, filePath,
        null, null, null, null, null, null, 1, 0
      );
    }

    this.updateSessionScreenshotCount(sessionId);
    return result.lastInsertRowid;
  }

  getScreenshotsBySession(sessionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM screenshots WHERE session_id = ? ORDER BY frame_number ASC
    `);
    return stmt.all(sessionId);
  }

  getUnanalyzedScreenshots(sessionId, limit = null) {
    let query = `SELECT * FROM screenshots WHERE session_id = ? AND analyzed = 0 ORDER BY frame_number ASC`;
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    const stmt = this.db.prepare(query);
    return stmt.all(sessionId);
  }

  updateScreenshotAnalysis(screenshotId, ocrText, aiSummary, isSuccess, relevanceScore, tags) {
    const stmt = this.db.prepare(`
      UPDATE screenshots
      SET ocr_text = ?,
          ai_summary = ?,
          is_success = ?,
          relevance_score = ?,
          tags = ?,
          analyzed = 1
      WHERE id = ?
    `);
    return stmt.run(ocrText, aiSummary, isSuccess, relevanceScore, JSON.stringify(tags), screenshotId);
  }

  // Virtual session management
  createVirtualSession(virtualSessionName, parentSessionId, searchQuery, screenshotIds, description = null, aiDetected = false) {
    const stmt = this.db.prepare(`
      INSERT INTO virtual_sessions (virtual_session_name, parent_session_id, search_query, screenshot_ids, description, ai_detected, screenshot_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      virtualSessionName,
      parentSessionId,
      searchQuery,
      JSON.stringify(screenshotIds),
      description,
      aiDetected ? 1 : 0,
      screenshotIds.length
    );
    return result.lastInsertRowid;
  }

  getVirtualSession(virtualSessionName) {
    const stmt = this.db.prepare(`
      SELECT * FROM virtual_sessions WHERE virtual_session_name = ?
    `);
    return stmt.get(virtualSessionName);
  }

  getAllVirtualSessions() {
    const stmt = this.db.prepare(`
      SELECT * FROM virtual_sessions ORDER BY created_at DESC
    `);
    return stmt.all();
  }

  // Search
  searchScreenshots(query, options = {}) {
    // FTS search
    const stmt = this.db.prepare(`
      SELECT s.*
      FROM screenshots s
      JOIN screenshots_fts fts ON s.id = fts.rowid
      WHERE screenshots_fts MATCH ?
      ORDER BY s.timestamp DESC
      ${options.limit ? `LIMIT ${options.limit}` : ''}
    `);
    return stmt.all(query);
  }

  // Folder/grouping queries for Eagle-style UI
  getAppCounts() {
    const stmt = this.db.prepare(`
      SELECT
        app_name as name,
        COUNT(*) as count
      FROM screenshots
      WHERE app_name IS NOT NULL AND app_name != ''
      GROUP BY app_name
      ORDER BY count DESC, app_name ASC
    `);
    return stmt.all();
  }

  getSessionCounts() {
    const stmt = this.db.prepare(`
      SELECT
        s.id,
        s.session_name as name,
        COUNT(sc.id) as count
      FROM sessions s
      LEFT JOIN screenshots sc ON s.id = sc.session_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    return stmt.all();
  }

  getSuccessCounts() {
    const heroCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM screenshots WHERE relevance_score >= 0.7 AND analyzed = 1
    `).get();

    const successCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM screenshots WHERE is_success = 1 AND analyzed = 1
    `).get();

    return {
      hero: heroCount.count,
      success: successCount.count
    };
  }

  getTimePeriodCounts() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM screenshots WHERE timestamp >= ?
    `);

    return {
      today: stmt.get(today.toISOString()).count,
      yesterday: stmt.get(yesterday.toISOString()).count - stmt.get(today.toISOString()).count,
      week: stmt.get(weekAgo.toISOString()).count,
      month: stmt.get(monthAgo.toISOString()).count
    };
  }

  // Combined folder counts (reduces 7 queries to 2)
  getAllFolderCounts() {
    const query = this.db.prepare(`
      WITH time_boundaries AS (
        SELECT
          datetime('now', 'start of day') as today_start,
          datetime('now', 'start of day', '-1 day') as yesterday_start,
          datetime('now', 'start of day', '-7 days') as week_start,
          datetime('now', 'start of day', '-30 days') as month_start
      ),
      screenshot_data AS (
        SELECT
          app_name,
          timestamp,
          relevance_score,
          is_success,
          analyzed
        FROM screenshots
      )
      SELECT
        -- Time period counts
        SUM(CASE WHEN timestamp >= (SELECT today_start FROM time_boundaries) THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN timestamp >= (SELECT yesterday_start FROM time_boundaries)
                 AND timestamp < (SELECT today_start FROM time_boundaries) THEN 1 ELSE 0 END) as yesterday,
        SUM(CASE WHEN timestamp >= (SELECT week_start FROM time_boundaries) THEN 1 ELSE 0 END) as week,
        SUM(CASE WHEN timestamp >= (SELECT month_start FROM time_boundaries) THEN 1 ELSE 0 END) as month,

        -- Success counts
        SUM(CASE WHEN relevance_score >= 0.7 AND analyzed = 1 THEN 1 ELSE 0 END) as hero,
        SUM(CASE WHEN is_success = 1 AND analyzed = 1 THEN 1 ELSE 0 END) as success,

        -- Total
        COUNT(*) as total
      FROM screenshot_data;
    `);

    const counts = query.get();

    // Get app and session counts separately (still needed for list rendering)
    const apps = this.getAppCounts();
    const sessions = this.getSessionCounts();

    return {
      apps,
      sessions,
      timePeriods: {
        today: counts.today,
        yesterday: counts.yesterday,
        week: counts.week,
        month: counts.month
      },
      success: {
        hero: counts.hero,
        success: counts.success
      },
      total: counts.total
    };
  }

  // Paginated screenshots with filtering
  getScreenshotsPaginated(options = {}) {
    const {
      page = 1,
      limit = 50,
      filter = null,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = options;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let params = [];
    let needsFTSJoin = false;

    // Build filter conditions (NEW: All filters use AND logic by pushing to same array)
    if (filter) {
      // NEW: Text search using FTS5
      if (filter.textSearch) {
        whereConditions.push('screenshots_fts MATCH ?');
        params.push(filter.textSearch);
        needsFTSJoin = true;
      }

      // NEW: Delta sync - only fetch screenshots newer than timestamp
      if (filter.since) {
        whereConditions.push('s.timestamp > ?');
        params.push(filter.since);
      }

      // NEW: Custom date range filter
      if (filter.dateStart) {
        whereConditions.push('s.timestamp >= ?');
        params.push(filter.dateStart + 'T00:00:00.000Z'); // Start of day
      }
      if (filter.dateEnd) {
        whereConditions.push('s.timestamp <= ?');
        params.push(filter.dateEnd + 'T23:59:59.999Z'); // End of day
      }

      // NEW: Multi-app filter
      if (filter.apps && filter.apps.length > 0) {
        const placeholders = filter.apps.map(() => '?').join(',');
        whereConditions.push(`s.app_name IN (${placeholders})`);
        params.push(...filter.apps);
      }

      // EXISTING: Single app filter (from folder navigation)
      if (filter.app) {
        whereConditions.push('s.app_name = ?');
        params.push(filter.app);
      }

      // EXISTING: Session filter
      if (filter.session) {
        whereConditions.push('s.session_id = ?');
        params.push(parseInt(filter.session));
      }

      // EXISTING: Time range filter (preset periods)
      if (filter.timeRange) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate;

        if (filter.timeRange === 'today') {
          startDate = today;
        } else if (filter.timeRange === 'yesterday') {
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 1);
          const endDate = today;
          whereConditions.push('s.timestamp >= ? AND s.timestamp < ?');
          params.push(startDate.toISOString(), endDate.toISOString());
        } else if (filter.timeRange === 'week') {
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
        } else if (filter.timeRange === 'month') {
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 30);
        }

        if (filter.timeRange !== 'yesterday') {
          whereConditions.push('s.timestamp >= ?');
          params.push(startDate.toISOString());
        }
      }

      // EXISTING: Relevance/success filters
      if (filter.minRelevance !== undefined) {
        whereConditions.push('s.relevance_score >= ? AND s.analyzed = 1');
        params.push(filter.minRelevance);
      }
      if (filter.success === 'hero') {
        whereConditions.push('s.relevance_score >= 0.7 AND s.analyzed = 1');
      } else if (filter.success === 'success') {
        whereConditions.push('s.is_success = 1 AND s.analyzed = 1');
      }
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // FTS join only when needed
    const ftsJoin = needsFTSJoin
      ? 'JOIN screenshots_fts ON s.id = screenshots_fts.rowid'
      : '';

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM screenshots s
      ${ftsJoin}
      ${whereClause}
    `;
    const countStmt = this.db.prepare(countSql);
    const { total } = countStmt.get(...params);

    // Get paginated results
    const orderBy = `ORDER BY s.${sortBy} ${sortOrder.toUpperCase()}`;
    const dataSql = `
      SELECT s.*
      FROM screenshots s
      ${ftsJoin}
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    const dataStmt = this.db.prepare(dataSql);
    const rows = dataStmt.all(...params, limit, offset);

    return {
      screenshots: rows,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  // Bulk operations
  bulkUpdateTags(ids, tags) {
    const tagsJson = JSON.stringify(tags);
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE screenshots SET tags = ? WHERE id IN (${placeholders})
    `);
    return stmt.run(tagsJson, ...ids);
  }

  bulkDelete(ids) {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      DELETE FROM screenshots WHERE id IN (${placeholders})
    `);
    return stmt.run(...ids);
  }

  updateScreenshotTags(id, tags) {
    const stmt = this.db.prepare(`
      UPDATE screenshots SET tags = ? WHERE id = ?
    `);
    return stmt.run(JSON.stringify(tags), id);
  }

  getSessionById(sessionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `);
    return stmt.get(sessionId);
  }

  // Close database
  close() {
    this.db.close();
  }
}

export default ScreenStoryDB;
