#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';

class TaskDetector {
  constructor(apiKey) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY not found in environment');
    }
    this.anthropic = new Anthropic({ apiKey: key });
  }

  /**
   * Detect task boundaries in a session using AI
   * @param {Array} screenshots - All screenshots from session (sorted by timestamp)
   * @returns {Promise<Array>} - Array of task clusters with AI-generated names
   */
  async detectTasks(screenshots) {
    if (screenshots.length === 0) return [];

    // First, do simple clustering by app switches and time gaps
    const simpleClusters = this.simpleCluster(screenshots);

    // Then use AI to analyze each cluster and determine if it's a coherent task
    const tasks = [];

    for (let i = 0; i < simpleClusters.length; i++) {
      const cluster = simpleClusters[i];

      // Skip very small clusters (< 3 screenshots)
      if (cluster.screenshots.length < 3) {
        continue;
      }

      // Use AI to analyze cluster and generate task name
      const taskInfo = await this.analyzeCluster(cluster);

      if (taskInfo.is_coherent_task) {
        tasks.push({
          task_name: taskInfo.task_name,
          description: taskInfo.description,
          screenshots: cluster.screenshots,
          screenshot_count: cluster.screenshots.length,
          start_time: cluster.screenshots[0].timestamp,
          end_time: cluster.screenshots[cluster.screenshots.length - 1].timestamp,
          apps_used: this.getUniqueApps(cluster.screenshots),
          success: taskInfo.success,
          relevance: taskInfo.relevance
        });
      }
    }

    return tasks;
  }

  /**
   * Simple clustering based on time gaps and app switches
   */
  simpleCluster(screenshots, timeGapThreshold = 300, appSwitchWeight = 0.5) {
    if (screenshots.length === 0) return [];

    const clusters = [];
    let currentCluster = { screenshots: [screenshots[0]] };

    for (let i = 1; i < screenshots.length; i++) {
      const prev = screenshots[i - 1];
      const curr = screenshots[i];

      const prevTime = new Date(prev.timestamp).getTime();
      const currTime = new Date(curr.timestamp).getTime();
      const gapSeconds = (currTime - prevTime) / 1000;

      const appChanged = prev.app_name !== curr.app_name;
      const significantGap = gapSeconds > timeGapThreshold;

      // Start new cluster if:
      // 1. Time gap > threshold
      // 2. App changed AND time gap > threshold * appSwitchWeight
      if (significantGap || (appChanged && gapSeconds > timeGapThreshold * appSwitchWeight)) {
        clusters.push(currentCluster);
        currentCluster = { screenshots: [curr] };
      } else {
        currentCluster.screenshots.push(curr);
      }
    }

    clusters.push(currentCluster);
    return clusters;
  }

  /**
   * Analyze a cluster using AI to determine if it's a coherent task
   */
  async analyzeCluster(cluster) {
    try {
      // Sample screenshots from cluster (first, middle, last)
      const samples = this.sampleScreenshots(cluster.screenshots, 5);

      // Build context from samples
      const context = samples.map((s, idx) => {
        return `Screenshot ${idx + 1}:
  Time: ${s.timestamp}
  App: ${s.app_name}
  Summary: ${s.ai_summary || 'No summary'}
  Success: ${s.is_success === 1 ? 'Yes' : s.is_success === 0 ? 'No' : 'Unknown'}
  Tags: ${s.tags || '[]'}`;
      }).join('\n\n');

      const prompt = `You are analyzing a sequence of screenshots to determine if they represent a coherent task.

${context}

Analyze these screenshots and provide a JSON response:
{
  "is_coherent_task": true/false,
  "task_name": "Short task name (e.g., 'booking-coffee-chat', 'debugging-claude-code')",
  "description": "Brief description of what the user was trying to accomplish",
  "success": true/false/null,
  "relevance": 0.0-1.0
}

A coherent task means:
- Screenshots are related to a single goal/objective
- There's a logical flow (setup → action → result)
- NOT just random browsing or app switching
- Could be demo-worthy (interesting automation or workflow)

Respond ONLY with valid JSON, no additional text.`;

      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return this.getDefaultTaskAnalysis();
      }

      const analysis = JSON.parse(jsonMatch[0]);

      return {
        is_coherent_task: analysis.is_coherent_task || false,
        task_name: analysis.task_name || 'unknown-task',
        description: analysis.description || 'Unknown task',
        success: analysis.success,
        relevance: analysis.relevance || 0.5
      };
    } catch (error) {
      console.error('Error analyzing cluster:', error.message);
      return this.getDefaultTaskAnalysis();
    }
  }

  /**
   * Sample screenshots from cluster (evenly distributed)
   */
  sampleScreenshots(screenshots, maxSamples = 5) {
    if (screenshots.length <= maxSamples) {
      return screenshots;
    }

    const samples = [];
    const step = Math.floor(screenshots.length / maxSamples);

    for (let i = 0; i < maxSamples; i++) {
      const idx = i * step;
      samples.push(screenshots[idx]);
    }

    return samples;
  }

  /**
   * Get unique apps from screenshots
   */
  getUniqueApps(screenshots) {
    const apps = new Set();
    screenshots.forEach(s => apps.add(s.app_name));
    return Array.from(apps);
  }

  /**
   * Default task analysis when AI fails
   */
  getDefaultTaskAnalysis() {
    return {
      is_coherent_task: false,
      task_name: 'unknown-task',
      description: 'Unable to determine task',
      success: null,
      relevance: 0.3
    };
  }

  /**
   * Generate summary name for a task cluster
   * @param {Array} screenshots - Screenshots in cluster
   * @returns {string} - Suggested name (e.g., "task-coffee-booking")
   */
  generateTaskName(screenshots) {
    // Extract common keywords from summaries and tags
    const keywords = new Map();

    screenshots.forEach(s => {
      // Extract from tags
      if (s.tags) {
        try {
          const tags = JSON.parse(s.tags);
          tags.forEach(tag => {
            keywords.set(tag, (keywords.get(tag) || 0) + 1);
          });
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Extract from summary
      if (s.ai_summary) {
        const words = s.ai_summary.toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 3 && !this.isStopWord(w));

        words.forEach(word => {
          keywords.set(word, (keywords.get(word) || 0) + 1);
        });
      }
    });

    // Get top 2-3 keywords
    const topKeywords = Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);

    if (topKeywords.length === 0) {
      return 'task-unknown';
    }

    return 'task-' + topKeywords.join('-').replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Check if word is a stop word
   */
  isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'this', 'that', 'from',
      'have', 'has', 'been', 'were', 'was', 'are', 'its'
    ]);
    return stopWords.has(word);
  }
}

export default TaskDetector;
