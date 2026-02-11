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

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_frame ON screenshots(session_id, frame_number);
      CREATE INDEX IF NOT EXISTS idx_session_analyzed ON screenshots(session_id, analyzed);
      CREATE INDEX IF NOT EXISTS idx_app_name ON screenshots(app_name);
      CREATE INDEX IF NOT EXISTS idx_is_success ON screenshots(is_success);
      CREATE INDEX IF NOT EXISTS idx_task_cluster ON screenshots(task_cluster_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON screenshots(timestamp);
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
  addScreenshot(sessionId, frameNumber, timestamp, appName, windowTitle, filePath) {
    const stmt = this.db.prepare(`
      INSERT INTO screenshots (session_id, frame_number, timestamp, app_name, window_title, file_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(sessionId, frameNumber, timestamp, appName, windowTitle, filePath);
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

  // Close database
  close() {
    this.db.close();
  }
}

export default ScreenStoryDB;
