#!/usr/bin/env node

/**
 * JianYing Export Module
 * Creates JianYing-compatible draft projects from Screen Story sessions
 * Can be used standalone or with JianYing MCP server if connected
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class JianyingExport {
  /**
   * Create JianYing draft project from screenshots
   * @param {Array} screenshots - Screenshots with AI analysis
   * @param {string} outputPath - Where to save the draft project
   * @param {Object} options - Project options
   */
  static async createDraftProject(screenshots, outputPath, options = {}) {
    const {
      resolution = '1920:1080',
      fps = 30,
      addCaptions = true,
      addTimestamps = true,
      addTransitions = true,
      transitionType = 'crossfade',
      intelligentPacing = true,
      minDuration = 1.0,
      maxDuration = 3.0
    } = options;

    console.log('🎬 Creating JianYing draft project...\n');

    // Calculate durations for each screenshot based on relevance
    let currentTime = 0;
    const videoSegments = [];
    const textSegments = [];
    const transitions = [];

    screenshots.forEach((screenshot, idx) => {
      // Calculate duration based on relevance (intelligent pacing)
      let duration;
      if (intelligentPacing && screenshot.relevance_score !== null) {
        // relevance_score is 0.0-1.0 in database
        const relevance = screenshot.relevance_score;
        duration = minDuration + (maxDuration - minDuration) * relevance;
        duration = Math.max(minDuration, Math.min(maxDuration, duration));
      } else {
        duration = (minDuration + maxDuration) / 2;
      }

      // Video segment
      videoSegments.push({
        id: `video_${idx}`,
        type: 'video',
        path: screenshot.file_path,
        startTime: currentTime,
        duration: duration,
        track: 0
      });

      // Caption overlay (AI summary)
      if (addCaptions && screenshot.ai_summary) {
        textSegments.push({
          id: `caption_${idx}`,
          type: 'text',
          text: screenshot.ai_summary,
          startTime: currentTime,
          duration: duration,
          position: 'bottom',
          fontSize: 36,
          fontColor: '#FFFFFF',
          backgroundColor: '#000000CC',
          animation: 'fade_in',
          track: 1
        });
      }

      // Timestamp overlay
      if (addTimestamps) {
        const timestamp = new Date(screenshot.timestamp).toLocaleTimeString();
        textSegments.push({
          id: `timestamp_${idx}`,
          type: 'text',
          text: timestamp,
          startTime: currentTime,
          duration: duration,
          position: 'top-left',
          fontSize: 24,
          fontColor: '#FFFFFFB3',
          backgroundColor: 'transparent',
          track: 2
        });
      }

      // Success indicator for hero moments
      if (screenshot.is_success && screenshot.relevance_score >= 0.8) {
        textSegments.push({
          id: `success_${idx}`,
          type: 'text',
          text: '✓ SUCCESS',
          startTime: currentTime,
          duration: duration,
          position: 'top-right',
          fontSize: 32,
          fontColor: '#00FF00',
          backgroundColor: '#000000B3',
          track: 3
        });
      }

      // Transition (between segments)
      if (addTransitions && idx < screenshots.length - 1) {
        transitions.push({
          id: `transition_${idx}`,
          type: transitionType,
          startTime: currentTime + duration - 0.3,
          duration: 0.3
        });
      }

      currentTime += duration;
    });

    // Create JianYing draft structure
    const draft = {
      version: '1.0.0',
      project: {
        name: path.basename(outputPath, '.json'),
        resolution: resolution,
        fps: fps,
        duration: currentTime
      },
      tracks: {
        video: videoSegments,
        text: textSegments,
        transitions: transitions
      },
      metadata: {
        created_by: 'Screen Story',
        created_at: new Date().toISOString(),
        total_screenshots: screenshots.length,
        intelligent_pacing: intelligentPacing
      }
    };

    // Save draft project
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(draft, null, 2));

    console.log(`✅ JianYing draft created: ${outputPath}`);
    console.log(`   Duration: ${currentTime.toFixed(1)}s`);
    console.log(`   Video segments: ${videoSegments.length}`);
    console.log(`   Text overlays: ${textSegments.length}`);
    console.log(`   Transitions: ${transitions.length}\n`);

    return {
      draftPath: outputPath,
      duration: currentTime,
      segments: videoSegments.length
    };
  }

  /**
   * Create instructions for manual import into JianYing
   */
  static generateImportInstructions(draftPath, screenshots) {
    const instructions = `
📋 How to Import into JianYing (剪映)

1. Open JianYing desktop app
2. Create a new project (1920x1080, 30fps recommended)
3. Import all screenshots from the session

Auto-Import Script (if JianYing MCP is connected):
--------------------------------------------------
The draft project has been saved to:
${draftPath}

If you have JianYing MCP server configured, you can use:
  node jianying-import.js "${draftPath}"

Manual Import Steps:
--------------------
1. Drag all screenshots into JianYing timeline
2. Set duration for each based on relevance:
   - High relevance (≥80%): 3 seconds
   - Medium relevance (50-80%): 2 seconds
   - Low relevance (<50%): 1 second

3. Add text overlays for captions (AI summaries)
4. Add timestamps in top-left corner
5. Add success indicators (✓) for hero moments
6. Add crossfade transitions between clips
7. Export as MP4

Intelligent Pacing Info:
------------------------
${screenshots.map((s, i) => {
  const relevance = s.relevance_score || 0.5;
  const duration = 1.0 + (3.0 - 1.0) * relevance;
  return `Frame ${i + 1}: ${duration.toFixed(1)}s (${Math.round(relevance * 100)}% relevance)`;
}).join('\n')}
`;

    return instructions;
  }

  /**
   * Export to multiple formats
   */
  static async exportMultiFormat(screenshots, sessionName, options = {}) {
    const baseDir = path.join(process.cwd(), 'exports', sessionName);
    await fs.mkdir(baseDir, { recursive: true });

    const results = {
      jianyingDraft: null,
      instructions: null,
      manifest: null
    };

    // 1. Create JianYing draft JSON
    const draftPath = path.join(baseDir, 'jianying-draft.json');
    results.jianyingDraft = await this.createDraftProject(screenshots, draftPath, options);

    // 2. Generate import instructions
    const instructionsPath = path.join(baseDir, 'IMPORT_INSTRUCTIONS.txt');
    const instructions = this.generateImportInstructions(draftPath, screenshots);
    await fs.writeFile(instructionsPath, instructions);
    results.instructions = instructionsPath;

    // 3. Create manifest with all metadata
    const manifest = {
      session: sessionName,
      exported_at: new Date().toISOString(),
      total_screenshots: screenshots.length,
      screenshots: screenshots.map((s, i) => ({
        index: i + 1,
        path: s.file_path,
        timestamp: s.timestamp,
        summary: s.ai_summary,
        relevance: s.relevance_score,
        is_success: s.is_success,
        tags: s.tags ? JSON.parse(s.tags) : []
      })),
      export_formats: {
        jianying_draft: path.relative(process.cwd(), draftPath),
        instructions: path.relative(process.cwd(), instructionsPath)
      }
    };

    const manifestPath = path.join(baseDir, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    results.manifest = manifestPath;

    console.log('\n✅ Multi-format export complete!');
    console.log(`\n📁 Export directory: ${baseDir}`);
    console.log(`   - JianYing draft: jianying-draft.json`);
    console.log(`   - Instructions: IMPORT_INSTRUCTIONS.txt`);
    console.log(`   - Manifest: manifest.json\n`);

    return results;
  }
}

export default JianyingExport;
