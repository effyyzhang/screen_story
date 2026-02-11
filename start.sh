#!/bin/bash
# Start Screen Story capture daemon

echo "🎬 Starting Screen Story Daemon..."

# Check if already running
if pgrep -f "capture-daemon.js" > /dev/null; then
    echo "⚠️  Capture daemon is already running"
    ps aux | grep capture-daemon.js | grep -v grep
    exit 1
fi

# Start daemon in background
cd "$(dirname "$0")"
nohup node capture-daemon.js > ~/screen-story-daemon.log 2>&1 &

sleep 2

# Verify it started
if pgrep -f "capture-daemon.js" > /dev/null; then
    echo "✅ Capture daemon started successfully!"
    echo ""
    echo "📝 Logs: tail -f ~/screen-story-daemon.log"
    echo ""
    echo "Next steps:"
    echo "  1. Start a recording session:"
    echo "     node session-manager.js start \"my-session\""
    echo ""
    echo "  2. Check status:"
    echo "     node session-manager.js status"
else
    echo "❌ Failed to start capture daemon"
    tail ~/screen-story-daemon.log
    exit 1
fi
