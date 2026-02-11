# Screen Story

Turn your screen activity into shareable short-form videos with AI-powered summaries.

## What it does

1. **Captures** your screen every 5-10 seconds using screenpipe
2. **Analyzes** screenshots with Claude Haiku to generate summaries
3. **Compiles** frames into professional videos with subtitles
4. **Exports** in multiple formats (vertical 9:16, square 1:1, horizontal 16:9)

## Setup

### Prerequisites

- macOS with Screenpipe installed
- FFmpeg: `brew install ffmpeg`
- Node.js 18+
- Anthropic API key

### Installation

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start screenpipe (in separate terminal)
screenpipe --fps 0.2 --disable-audio --enable-frame-cache
```

### Grant Permissions

1. Open **System Settings** → **Privacy & Security** → **Screen Recording**
2. Enable **screenpipe**

## Usage

### Test screenpipe connection
```bash
npm test
```

### Export screenshots with AI summaries
```bash
npm run export
```

### Create video
```bash
npm run video
```

## Project Structure

```
screen_story/
├── test-api.js              # Test screenpipe connection
├── export-screenshots.js    # Export & summarize screenshots
├── create-video.js          # Generate videos with FFmpeg
├── package.json
└── .env                     # API keys (not committed)
```

## Cost

- Screenpipe: **Free** (open source)
- Claude Haiku API: ~**$5-10/month** (very affordable)
- Total: Much cheaper than Screenpipe Pro ($29/mo)

## License

MIT
