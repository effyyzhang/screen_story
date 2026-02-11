#!/bin/bash
# Stop Screen Story capture daemon

echo "🛑 Stopping Screen Story Daemon..."

if ! pgrep -f "capture-daemon.js" > /dev/null; then
    echo "⚠️  Capture daemon is not running"
    exit 0
fi

# Stop daemon
pkill -f "capture-daemon.js"

sleep 1

# Verify it stopped
if pgrep -f "capture-daemon.js" > /dev/null; then
    echo "⚠️  Daemon is still running, forcing stop..."
    pkill -9 -f "capture-daemon.js"
    sleep 1
fi

if ! pgrep -f "capture-daemon.js" > /dev/null; then
    echo "✅ Daemon stopped successfully!"
else
    echo "❌ Failed to stop daemon"
    exit 1
fi
