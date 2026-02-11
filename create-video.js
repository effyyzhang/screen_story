#!/usr/bin/env node
import ScreenStoryDB from './lib/database.js';
import VideoEditor from './lib/video-editor.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help')) {
    console.log('Usage: node create-video.js <session|--virtual-session=name> [options]');
    process.exit(0);
  }

  const options = { session: null, virtualSession: null, output: null, heroOnly: false, minRelevance: null };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--virtual-session') options.virtualSession = args[++i];
    else if (args[i] === '--output') options.output = args[++i];
    else if (args[i] === '--hero-only') options.heroOnly = true;
    else if (!options.session) options.session = args[i];
  }

  const db = new ScreenStoryDB();
  try {
    let screenshots = [];
    let sessionName = '';

    if (options.virtualSession) {
      const vs = db.getVirtualSession(options.virtualSession);
      if (!vs) throw new Error('Virtual session not found: ' + options.virtualSession);
      sessionName = options.virtualSession;
      const ids = JSON.parse(vs.screenshot_ids);
      console.log('Creating video from virtual session:', sessionName, '(' + ids.length + ' screenshots)');
      screenshots = ids.map(id => db.db.prepare('SELECT * FROM screenshots WHERE id = ?').get(id)).filter(Boolean);
    } else {
      const session = db.getSessionByName(options.session);
      if (!session) throw new Error('Session not found');
      sessionName = options.session;
      screenshots = db.getScreenshotsBySession(session.id).filter(s => s.analyzed);
      console.log('Creating video from session:', sessionName, '(' + screenshots.length + ' screenshots)');
    }

    if (screenshots.length === 0) throw new Error('No screenshots found');

    let filtered = screenshots;
    if (options.heroOnly) filtered = filtered.filter(s => s.relevance_score >= 0.8);
    filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const outputPath = options.output || path.join(__dirname, 'videos', sessionName + '.mp4');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Normalize relevance scores from 0-100 to 0.0-1.0
    const normalizedScreenshots = filtered.map(s => ({
      ...s,
      relevance_score: s.relevance_score !== null && s.relevance_score !== undefined
        ? s.relevance_score / 100
        : 0.5
    }));

    await VideoEditor.createVideo(normalizedScreenshots, outputPath, {
      scale: '1920:-1',        // 1920px width, maintain aspect ratio
      fps: 1,
      minDuration: 1.0,
      maxDuration: 3.0,
      transitionDuration: 0.3,
      transition: 'fade',
      quality: 23,
      intelligentPacing: true
    });

    console.log('Video created:', outputPath);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
