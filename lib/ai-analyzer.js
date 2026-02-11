#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';

class AIAnalyzer {
  constructor(apiKey) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY not found in environment');
    }
    this.anthropic = new Anthropic({
      apiKey: key
    });
  }

  /**
   * Analyze screenshot with Claude Vision API
   * @param {string} imagePath - Path to screenshot
   * @param {Object} context - Additional context {sessionDescription, frameNumber, totalFrames, appName, windowTitle, ocrText}
   * @returns {Promise<Object>} - Analysis result
   */
  async analyzeScreenshot(imagePath, context = {}) {
    try {
      // Read image as base64
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Detect image type
      const ext = path.extname(imagePath).toLowerCase();
      const mediaType = ext === '.png' ? 'image/png' : 'image/jpeg';

      // Build prompt with context
      const prompt = this.buildAnalysisPrompt(context);

      // Call Claude Vision API
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      });

      // Parse JSON response
      const responseText = message.content[0].text;
      const analysis = this.parseAnalysisResponse(responseText);

      return analysis;
    } catch (error) {
      console.error('AI analysis error:', error.message);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Build analysis prompt with context
   */
  buildAnalysisPrompt(context) {
    const {
      sessionDescription = 'Unknown task',
      frameNumber = 0,
      totalFrames = 0,
      appName = 'Unknown',
      windowTitle = '',
      ocrText = ''
    } = context;

    return `You are analyzing a screenshot from an AI automation demo session.

**Session Context:**
- Goal: ${sessionDescription}
- Current frame: ${frameNumber} of ${totalFrames}
- App: ${appName}
- Window: ${windowTitle}
${ocrText ? `- OCR Text: ${ocrText.substring(0, 1000)}` : ''}

**Your Task:**
Analyze this screenshot and provide a JSON response with the following structure:

{
  "summary": "Brief description of what's happening (1 sentence)",
  "is_success": true/false/null,
  "success_indicators": ["List of success signals you see"],
  "error_indicators": ["List of error/failure signals you see"],
  "relevance_score": 0.0-1.0,
  "action_type": "cli_command" | "browser_interaction" | "app_switch" | "result_shown" | "idle",
  "tags": ["tag1", "tag2", "tag3"],
  "screen_type": "hero" | "supporting" | "error" | "transition" | "idle"
}

**Field Definitions:**
- is_success: true if task completed successfully, false if error/retry, null if in progress
- relevance_score: How important is this frame for a demo video? (0=skip, 1=critical)
- action_type: What kind of action is happening?
- screen_type: "hero"=key success moment, "supporting"=important context, "error"=failure/retry, "transition"=app switch, "idle"=no activity
- tags: Keywords describing this screen (e.g., ["calendar", "automation", "success"])

**Focus on:**
- Success indicators: Confirmation messages, "Success", checkmarks, completed states, green indicators
- Error indicators: Error messages, "Failed", "Error", red indicators, retry buttons
- Key moments: Would this frame help tell the story in a 30-second demo video?

**Important:** Respond ONLY with valid JSON, no additional text.`;
  }

  /**
   * Parse Claude's JSON response
   */
  parseAnalysisResponse(responseText) {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getDefaultAnalysis();
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Validate and normalize
      return {
        summary: analysis.summary || 'Unknown activity',
        is_success: analysis.is_success === true ? 1 : (analysis.is_success === false ? 0 : null),
        success_indicators: Array.isArray(analysis.success_indicators) ? analysis.success_indicators : [],
        error_indicators: Array.isArray(analysis.error_indicators) ? analysis.error_indicators : [],
        relevance_score: typeof analysis.relevance_score === 'number'
          ? Math.max(0, Math.min(1, analysis.relevance_score))
          : 0.5,
        action_type: analysis.action_type || 'idle',
        tags: Array.isArray(analysis.tags) ? analysis.tags : [],
        screen_type: analysis.screen_type || 'supporting'
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error.message);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Default analysis when AI fails
   */
  getDefaultAnalysis() {
    return {
      summary: 'Screenshot captured',
      is_success: null,
      success_indicators: [],
      error_indicators: [],
      relevance_score: 0.5,
      action_type: 'idle',
      tags: [],
      screen_type: 'supporting'
    };
  }

  /**
   * Batch analyze multiple screenshots with progress tracking
   * @param {Array} screenshots - Array of {id, imagePath, context}
   * @param {Function} onProgress - Progress callback (current, total)
   * @returns {Promise<Array>} - Array of analysis results
   */
  async batchAnalyze(screenshots, onProgress = null) {
    const results = [];

    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];

      if (onProgress) {
        onProgress(i + 1, screenshots.length);
      }

      const analysis = await this.analyzeScreenshot(screenshot.imagePath, screenshot.context);
      results.push({
        screenshotId: screenshot.id,
        ...analysis
      });

      // Small delay to avoid rate limits
      if (i < screenshots.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }
}

export default AIAnalyzer;
