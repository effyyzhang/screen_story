#!/bin/bash
# Check Screen Story daemon and session status

cd "$(dirname "$0")"

echo "📊 Screen Story Status"
echo "====================="
echo ""

# Check if daemon is running
if pgrep -f "capture-daemon.js" > /dev/null; then
    echo "🟢 Daemon: RUNNING"
    ps aux | grep capture-daemon.js | grep -v grep | awk '{print "   PID:", $2, "| CPU:", $3"%", "| Memory:", $4"%"}'
    echo ""

    # Show current session status
    node session-manager.js status
else
    echo "🔴 Daemon: NOT RUNNING"
    echo ""
    echo "Start with: ./start.sh"
    echo ""
fi

# Show recent sessions
echo "━━━ Recent Sessions ━━━"
node session-manager.js list | head -n 20
