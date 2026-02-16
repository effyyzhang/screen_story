#!/bin/bash

# Screen Story - Stop Script
# Stops all running services

echo "🛑 Stopping Screen Story services..."
echo ""

# Stop frontend (port 3000)
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "Stopping frontend server (port 3000)..."
    lsof -ti:3000 | xargs kill 2>/dev/null || true
else
    echo "Frontend server not running"
fi

# Stop backend (port 4000)
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "Stopping backend server (port 4000)..."
    lsof -ti:4000 | xargs kill 2>/dev/null || true
else
    echo "Backend server not running"
fi

# Stop capture daemon
if pgrep -f "capture-daemon.js" > /dev/null ; then
    echo "Stopping capture daemon..."
    pkill -f "capture-daemon.js" 2>/dev/null || true
else
    echo "Capture daemon not running"
fi

sleep 2

echo ""
echo "✅ All services stopped!"
