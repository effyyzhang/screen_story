# Quick Start Guide

## Step 1: Grant Screen Recording Permission ⚠️

**This is required for screenpipe to capture your screen!**

1. Open **System Settings**
2. Go to **Privacy & Security** → **Screen Recording**
3. Find **screenpipe** in the list and toggle it ON
4. If it's not in the list, click **"+"** and navigate to `~/.local/bin/screenpipe`

## Step 2: Configure API Key

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your Anthropic API key
# Get one from: https://console.anthropic.com/
```

## Step 3: Start Screenpipe

```bash
# In a separate terminal, start screenpipe
screenpipe --fps 0.2 --disable-audio --enable-frame-cache
```

This will:
- Capture 1 frame every 5 seconds (0.2 FPS)
- Disable audio recording (we only need screen)
- Enable frame cache for better performance

## Step 4: Test Connection

```bash
npm test
```

You should see:
- ✅ Health check passed
- ✅ Recent frames found
- 📸 Sample frame data

## Step 5: Let Screenpipe Capture Some Activity

**Wait 5-10 minutes** while you use your computer normally. Screenpipe will capture frames in the background.

## Step 6: Export Screenshots with AI Summaries

```bash
# Export last 5 minutes with AI summaries
npm run export -- --duration=5 --summarize --limit=20
```

This will:
- Fetch the last 5 minutes of activity
- Generate AI summaries for each frame
- Create an export folder with metadata + subtitles

## Step 7: Create a Video

```bash
# Create a vertical video (TikTok/Reels style)
npm run video -- --input=./exports/[timestamp] --output=my-video.mp4 --format=vertical --fps=2
```

Replace `[timestamp]` with the actual export folder name.

## Troubleshooting

### "Connection refused" error
- Make sure screenpipe is running: `screenpipe --fps 0.2 --disable-audio --enable-frame-cache`

### "No frames found"
- Check that Screen Recording permission is granted
- Wait a few minutes for frames to be captured
- Check screenpipe logs for errors

### "ANTHROPIC_API_KEY not found"
- Make sure you created `.env` file from `.env.example`
- Add your API key from https://console.anthropic.com/

### Video creation fails
- Make sure FFmpeg is installed: `brew install ffmpeg`
- Check that frames were exported successfully

## Usage Examples

### Quick 2-minute video
```bash
npm run export -- --duration=2 --summarize --limit=10
npm run video -- --input=./exports/[timestamp] --output=quick.mp4
```

### Square format for Instagram
```bash
npm run video -- --input=./exports/[timestamp] --output=insta.mp4 --format=square
```

### Horizontal format for YouTube
```bash
npm run video -- --input=./exports/[timestamp] --output=youtube.mp4 --format=horizontal
```

### Export without AI summaries (faster, free)
```bash
npm run export -- --duration=10 --limit=50
```

## What's Next?

Check out the main [README.md](README.md) for more advanced usage and customization options.
