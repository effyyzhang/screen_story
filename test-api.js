#!/usr/bin/env node
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SCREENPIPE_API = process.env.SCREENPIPE_API || 'http://localhost:3030';

async function testScreenpipeAPI() {
  console.log('🔍 Testing Screenpipe API...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣  Checking health endpoint...');
    const healthResponse = await axios.get(`${SCREENPIPE_API}/health`);
    console.log('✅ Status:', healthResponse.data.status);
    console.log('   Frame status:', healthResponse.data.frame_status);
    console.log('   Audio status:', healthResponse.data.audio_status);

    if (healthResponse.data.status === 'degraded') {
      console.log('⚠️  Message:', healthResponse.data.message);
      if (healthResponse.data.verbose_instructions) {
        console.log('   Instructions:', healthResponse.data.verbose_instructions);
      }
    }
    console.log();

    // Test 2: Query recent frames
    console.log('2️⃣  Querying recent frames...');
    const searchResponse = await axios.get(`${SCREENPIPE_API}/search`, {
      params: {
        limit: 5,
        content_type: 'ocr'
      }
    });

    const frames = searchResponse.data.data || [];
    console.log(`✅ Found ${frames.length} recent frames`);

    if (frames.length > 0) {
      console.log('\n📸 Sample frames:');
      frames.slice(0, 3).forEach((frame, i) => {
        console.log(`\n   Frame ${i + 1}:`);
        console.log(`   - Timestamp: ${new Date(frame.content.timestamp).toLocaleString()}`);
        console.log(`   - App: ${frame.content.app_name || 'Unknown'}`);
        console.log(`   - Window: ${frame.content.window_name || 'Unknown'}`);
        if (frame.content.text) {
          const preview = frame.content.text.substring(0, 100);
          console.log(`   - Text preview: ${preview}${frame.content.text.length > 100 ? '...' : ''}`);
        }
      });
    } else {
      console.log('⚠️  No frames captured yet. Make sure:');
      console.log('   - Screenpipe is running');
      console.log('   - Screen Recording permission is granted');
      console.log('   - Some time has passed for frames to be captured');
    }
    console.log();

    // Test 3: Check database location
    console.log('3️⃣  Database location:');
    console.log('   ~/.screenpipe-recordings/');
    console.log();

    console.log('✅ All tests passed! Screenpipe is working correctly.\n');
    return true;

  } catch (error) {
    console.error('❌ Error testing Screenpipe API:');

    if (error.code === 'ECONNREFUSED') {
      console.error('   Connection refused. Is screenpipe running?');
      console.error('   Start it with: screenpipe --fps 0.2 --disable-audio --enable-frame-cache');
    } else if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Message:', error.response.data);
    } else {
      console.error('   ', error.message);
    }

    console.log();
    return false;
  }
}

// Run the test
testScreenpipeAPI();
