#!/bin/bash

# Screen Story - Startup Script
# Launches backend server, capture daemon, and frontend dev server

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🎬 Starting Screen Story..."
echo ""

# Check if processes are already running
if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Backend server already running on port 4000"
    read -p "Kill existing process and restart? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping existing backend..."
        lsof -ti:4000 | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        echo "Exiting. Stop the existing server first."
        exit 1
    fi
fi

if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Frontend server already running on port 3000"
    read -p "Kill existing process and restart? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping existing frontend..."
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        echo "Exiting. Stop the existing server first."
        exit 1
    fi
fi

# Kill any hanging capture-daemon processes
echo "🧹 Cleaning up old capture-daemon processes..."
pkill -f "capture-daemon.js" 2>/dev/null || true
sleep 1

# Create logs directory
mkdir -p logs

# Start capture daemon
echo "🎥 Starting capture daemon..."
nohup node capture-daemon.js > logs/daemon.log 2>&1 &
DAEMON_PID=$!
echo "   Daemon PID: $DAEMON_PID"

# Wait for daemon to initialize
sleep 2

# Start backend server
echo "🚀 Starting backend server (port 4000)..."
nohup node server.js > logs/server.log 2>&1 &
SERVER_PID=$!
echo "   Server PID: $SERVER_PID"

# Wait for backend to start
sleep 2

# Start frontend dev server
echo "⚡ Starting frontend dev server (port 3000)..."
cd ui-redesign
nohup npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

cd ..

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Process Summary:"
echo "   Capture Daemon: PID $DAEMON_PID (logs/daemon.log)"
echo "   Backend Server: PID $SERVER_PID (logs/server.log)"
echo "   Frontend Dev:   PID $FRONTEND_PID (logs/frontend.log)"
echo ""
echo "🌐 Access your app at: http://localhost:3000"
echo ""
echo "📝 Useful commands:"
echo "   View daemon logs:   tail -f logs/daemon.log"
echo "   View server logs:   tail -f logs/server.log"
echo "   View frontend logs: tail -f logs/frontend.log"
echo "   Stop all services:  ./stop.sh"
echo ""
echo "Press Ctrl+C to stop monitoring (services will continue in background)"
echo ""

# Monitor logs (can be interrupted with Ctrl+C)
tail -f logs/daemon.log logs/server.log logs/frontend.log
