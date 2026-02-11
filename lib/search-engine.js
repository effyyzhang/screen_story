#!/usr/bin/env node
import ScreenStoryDB from './database.js';

class SearchEngine {
  constructor() {
    this.db = new ScreenStoryDB();
  }

  /**
   * Search screenshots using full-text search
   * @param {string} query - Search query (supports FTS5 syntax)
   * @param {Object} filters - Additional filters {sessionId, appName, successOnly, minRelevance, startDate, endDate}
   * @returns {Array} - Matching screenshots
   */
  search(query, filters = {}) {
    const {
      sessionId = null,
      appName = null,
      successOnly = false,
      minRelevance = null,
      startDate = null,
      endDate = null,
      limit = 100
    } = filters;

    // Build WHERE conditions
    const conditions = [];
    const params = [];

    // Full-text search
    if (query) {
      conditions.push('screenshots_fts MATCH ?');
      params.push(query);
    }

    // Session filter
    if (sessionId) {
      conditions.push('s.session_id = ?');
      params.push(sessionId);
    }

    // App filter
    if (appName) {
      conditions.push('s.app_name = ?');
      params.push(appName);
    }

    // Success filter
    if (successOnly) {
      conditions.push('s.is_success = 1');
    }

    // Relevance filter
    if (minRelevance !== null) {
      conditions.push('s.relevance_score >= ?');
      params.push(minRelevance);
    }

    // Date range filter
    if (startDate) {
      conditions.push('s.timestamp >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('s.timestamp <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT s.*
      FROM screenshots s
      ${query ? 'JOIN screenshots_fts fts ON s.id = fts.rowid' : ''}
      ${whereClause}
      ORDER BY s.timestamp DESC
      LIMIT ?
    `;

    params.push(limit);

    const stmt = this.db.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Group search results by time proximity (for task clustering)
   * @param {Array} screenshots - Search results
   * @param {number} gapThreshold - Max gap in seconds to consider same cluster (default: 5 minutes)
   * @returns {Array} - Array of clusters [{screenshots: [], startTime, endTime, duration}]
   */
  clusterByTime(screenshots, gapThreshold = 300) {
    if (screenshots.length === 0) return [];

    const clusters = [];
    let currentCluster = {
      screenshots: [screenshots[0]],
      startTime: screenshots[0].timestamp,
      endTime: screenshots[0].timestamp
    };

    for (let i = 1; i < screenshots.length; i++) {
      const prev = screenshots[i - 1];
      const curr = screenshots[i];

      const prevTime = new Date(prev.timestamp).getTime();
      const currTime = new Date(curr.timestamp).getTime();
      const gapSeconds = Math.abs(currTime - prevTime) / 1000;

      if (gapSeconds <= gapThreshold) {
        // Same cluster
        currentCluster.screenshots.push(curr);
        currentCluster.endTime = curr.timestamp;
      } else {
        // New cluster
        currentCluster.duration = this.calculateDuration(currentCluster.startTime, currentCluster.endTime);
        clusters.push(currentCluster);
        currentCluster = {
          screenshots: [curr],
          startTime: curr.timestamp,
          endTime: curr.timestamp
        };
      }
    }

    // Add last cluster
    currentCluster.duration = this.calculateDuration(currentCluster.startTime, currentCluster.endTime);
    clusters.push(currentCluster);

    return clusters;
  }

  /**
   * Calculate duration between two timestamps
   */
  calculateDuration(startTime, endTime) {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const diffSeconds = Math.floor((end - start) / 1000);

    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;

    return {
      total_seconds: diffSeconds,
      formatted: minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
    };
  }

  /**
   * Get statistics for search results
   * @param {Array} screenshots - Search results
   * @returns {Object} - Statistics
   */
  getSearchStats(screenshots) {
    if (screenshots.length === 0) {
      return {
        total: 0,
        apps: [],
        success_count: 0,
        error_count: 0,
        avg_relevance: 0,
        time_span: null
      };
    }

    // Count apps
    const appCounts = {};
    let successCount = 0;
    let errorCount = 0;
    let totalRelevance = 0;
    let relevanceCount = 0;

    screenshots.forEach(s => {
      appCounts[s.app_name] = (appCounts[s.app_name] || 0) + 1;
      if (s.is_success === 1) successCount++;
      if (s.is_success === 0) errorCount++;
      if (s.relevance_score !== null) {
        totalRelevance += s.relevance_score;
        relevanceCount++;
      }
    });

    const apps = Object.entries(appCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const timestamps = screenshots.map(s => new Date(s.timestamp).getTime()).sort((a, b) => a - b);
    const timeSpan = this.calculateDuration(
      new Date(timestamps[0]).toISOString(),
      new Date(timestamps[timestamps.length - 1]).toISOString()
    );

    return {
      total: screenshots.length,
      apps,
      success_count: successCount,
      error_count: errorCount,
      avg_relevance: relevanceCount > 0 ? (totalRelevance / relevanceCount) : 0,
      time_span: timeSpan
    };
  }

  /**
   * Format search results for display
   * @param {Array} screenshots - Search results
   * @param {Array} clusters - Time-based clusters
   * @returns {string} - Formatted output
   */
  formatSearchResults(screenshots, clusters) {
    const stats = this.getSearchStats(screenshots);

    let output = `\n━━━ Search Results ━━━\n`;
    output += `Total: ${stats.total} screenshots\n`;
    output += `Time span: ${stats.time_span.formatted}\n`;
    output += `Success screens: ${stats.success_count}\n`;
    output += `Error screens: ${stats.error_count}\n`;
    output += `Avg relevance: ${(stats.avg_relevance * 100).toFixed(0)}%\n`;
    output += `\nApps used:\n`;
    stats.apps.forEach(app => {
      output += `  - ${app.name}: ${app.count} screenshots\n`;
    });

    output += `\n━━━ Clusters ━━━\n`;
    output += `Found ${clusters.length} time-based clusters:\n\n`;

    clusters.forEach((cluster, idx) => {
      const startTime = new Date(cluster.startTime).toLocaleTimeString();
      const endTime = new Date(cluster.endTime).toLocaleTimeString();

      output += `Cluster ${idx + 1}: ${startTime} - ${endTime} (${cluster.duration.formatted})\n`;
      output += `├─ ${cluster.screenshots.length} screenshots\n`;

      // Show first and last screenshot summary
      if (cluster.screenshots[0].ai_summary) {
        output += `├─ Start: ${cluster.screenshots[0].ai_summary}\n`;
      }
      if (cluster.screenshots.length > 1 && cluster.screenshots[cluster.screenshots.length - 1].ai_summary) {
        output += `└─ End: ${cluster.screenshots[cluster.screenshots.length - 1].ai_summary}\n`;
      }
      output += '\n';
    });

    return output;
  }

  close() {
    this.db.close();
  }
}

export default SearchEngine;
