#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JianYing project paths
const JIANYING_ROOT = path.join(process.env.HOME, 'Movies/JianyingPro/User Data/Projects/com.lveditor.draft');

class JianyingMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'jianying',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'import_draft',
          description: 'Import Screen Story draft to JianYing. Creates a new project from exported jianying-draft.json',
          inputSchema: {
            type: 'object',
            properties: {
              draftPath: {
                type: 'string',
                description: 'Path to jianying-draft.json file from Screen Story export',
              },
              projectName: {
                type: 'string',
                description: 'Name for the new JianYing project (optional, defaults to session name)',
              },
              openInApp: {
                type: 'boolean',
                description: 'Whether to open JianYing app after import (default: false)',
              },
            },
            required: ['draftPath'],
          },
        },
        {
          name: 'list_projects',
          description: 'List all JianYing projects',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === 'import_draft') {
          return await this.importDraft(args.draftPath, args.projectName, args.openInApp);
        } else if (name === 'list_projects') {
          return await this.listProjects();
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async importDraft(draftPath, projectName, openInApp = false) {
    // Read the Screen Story draft
    const draftContent = await fs.readFile(draftPath, 'utf-8');
    const draft = JSON.parse(draftContent);

    // Generate project name
    const finalProjectName = projectName || draft.project?.name || `screen-story-${Date.now()}`;

    // Create project directory
    const projectDir = path.join(JIANYING_ROOT, finalProjectName);
    await fs.mkdir(projectDir, { recursive: true });
    await fs.mkdir(path.join(projectDir, 'Resources'), { recursive: true });
    await fs.mkdir(path.join(projectDir, 'common_attachment'), { recursive: true });

    // Generate unique IDs
    const projectId = this.generateUUID();
    const canvasId = this.generateUUID();

    // Convert Screen Story draft to JianYing format
    const jianyingDraft = await this.convertToJianyingFormat(draft, projectId, canvasId, projectDir);

    // Write draft files
    await fs.writeFile(
      path.join(projectDir, 'draft_info.json'),
      JSON.stringify(jianyingDraft.draftInfo, null, 2)
    );

    await fs.writeFile(
      path.join(projectDir, 'draft_meta_info.json'),
      JSON.stringify(jianyingDraft.metaInfo, null, 2)
    );

    // Create other required files
    await this.createRequiredFiles(projectDir, projectId);

    // Open in app if requested
    if (openInApp) {
      await execAsync('open -a "JianyingPro"');
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ Successfully imported to JianYing!\n\nProject: ${finalProjectName}\nLocation: ${projectDir}\nVideos: ${draft.tracks?.video?.length || 0}\nTexts: ${draft.tracks?.text?.length || 0}\n\n${openInApp ? 'JianYing app opened!' : 'Open JianYing to see your project.'}`,
        },
      ],
    };
  }

  async convertToJianyingFormat(screenStoryDraft, projectId, canvasId, projectDir) {
    const videoTracks = screenStoryDraft.tracks?.video || [];
    const textTracks = screenStoryDraft.tracks?.text || [];
    const transitions = screenStoryDraft.tracks?.transitions || [];

    // Calculate total duration in microseconds
    const totalDuration = videoTracks.reduce((sum, v) => sum + (v.duration * 1000000), 0);

    // Copy video materials to project Resources
    const materials = [];
    const videoSegments = [];

    for (let i = 0; i < videoTracks.length; i++) {
      const video = videoTracks[i];
      const materialId = this.generateUUID();
      const segmentId = this.generateUUID();

      // Copy screenshot to project Resources
      const filename = path.basename(video.path);
      const destPath = path.join(projectDir, 'Resources', filename);
      await fs.copyFile(video.path, destPath);

      // Add material
      materials.push({
        id: materialId,
        type: 'video',
        path: destPath,
        material_name: filename,
        width: 1920,
        height: 1080,
        duration: video.duration * 1000000,
        has_audio: false,
        local_material_id: materialId,
        category_name: 'local',
        source: 0,
      });

      // Add video segment
      videoSegments.push({
        id: segmentId,
        material_id: materialId,
        target_timerange: {
          start: video.startTime * 1000000,
          duration: video.duration * 1000000,
        },
        source_timerange: {
          start: 0,
          duration: video.duration * 1000000,
        },
        speed: 1.0,
        volume: 1.0,
        clip: {
          alpha: 1.0,
          rotation: 0.0,
          scale: { x: 1.0, y: 1.0 },
          transform: { x: 0.0, y: 0.0 },
          flip: { horizontal: false, vertical: false },
        },
        enable_adjust: true,
        visible: true,
        extra_material_refs: [],
      });
    }

    // Create text segments
    const textSegments = [];
    for (const text of textTracks) {
      const textId = this.generateUUID();
      const segmentId = this.generateUUID();

      textSegments.push({
        id: segmentId,
        material_id: textId,
        target_timerange: {
          start: text.startTime * 1000000,
          duration: text.duration * 1000000,
        },
        text: text.text,
        fontSize: text.fontSize || 36,
        fontColor: text.fontColor || '#FFFFFF',
        position: text.position || 'bottom',
        visible: true,
      });
    }

    // Build draft_info.json
    const draftInfo = {
      id: projectId,
      canvas_config: {
        width: 1920,
        height: 1080,
        ratio: 'original',
      },
      duration: totalDuration,
      fps: 30.0,
      materials: {
        videos: materials,
        canvases: [
          {
            id: canvasId,
            type: 'canvas_color',
            color: '',
          },
        ],
      },
      tracks: [
        {
          id: this.generateUUID(),
          type: 'video',
          segments: videoSegments,
        },
      ],
    };

    // Build draft_meta_info.json
    const now = Date.now() * 1000; // microseconds
    const metaInfo = {
      draft_id: projectId,
      draft_name: screenStoryDraft.project?.name || 'Screen Story Import',
      draft_fold_path: projectDir,
      draft_root_path: JIANYING_ROOT,
      tm_draft_create: now,
      tm_draft_modified: now,
      tm_duration: totalDuration,
      draft_materials: [
        {
          type: 0,
          value: materials.map(m => ({
            id: m.local_material_id,
            file_Path: m.path,
            type: 0,
            metetype: 'video',
            duration: m.duration,
            width: m.width,
            height: m.height,
            create_time: Math.floor(now / 1000000),
            import_time: Math.floor(now / 1000000),
          })),
        },
      ],
    };

    return { draftInfo, metaInfo };
  }

  async createRequiredFiles(projectDir, projectId) {
    // Create minimal required files
    await fs.writeFile(path.join(projectDir, 'draft_virtual_store.json'), JSON.stringify({
      draft_id: projectId,
      draft_store: [],
    }));

    await fs.writeFile(path.join(projectDir, 'draft_biz_config.json'), '');

    await fs.writeFile(path.join(projectDir, 'draft_agency_config.json'), JSON.stringify({
      agency_upload: false,
    }));

    await fs.writeFile(path.join(projectDir, 'performance_opt_info.json'), JSON.stringify({
      optimize: false,
    }));

    await fs.writeFile(path.join(projectDir, 'timeline_layout.json'), JSON.stringify({
      scale: 1.0,
      offset: 0,
    }));
  }

  async listProjects() {
    try {
      const entries = await fs.readdir(JIANYING_ROOT, { withFileTypes: true });
      const projects = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metaPath = path.join(JIANYING_ROOT, entry.name, 'draft_meta_info.json');
          try {
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            const meta = JSON.parse(metaContent);
            projects.push({
              name: meta.draft_name || entry.name,
              path: entry.name,
              created: new Date(meta.tm_draft_create / 1000).toISOString(),
              modified: new Date(meta.tm_draft_modified / 1000).toISOString(),
              duration: `${(meta.tm_duration / 1000000).toFixed(1)}s`,
            });
          } catch (e) {
            // Skip invalid projects
          }
        }
      }

      const projectList = projects
        .map(p => `- ${p.name} (${p.duration}) - Modified: ${p.modified}`)
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${projects.length} JianYing projects:\n\n${projectList}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing projects: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16).toUpperCase();
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('JianYing MCP server running on stdio');
  }
}

const server = new JianyingMCPServer();
server.run().catch(console.error);
