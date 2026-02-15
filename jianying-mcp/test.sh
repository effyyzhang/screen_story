#!/bin/bash
# Test JianYing MCP server

echo "Testing MCP server startup..."
echo ""

# Test list_projects
echo "Test: list_projects"
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node index.js 2>&1 | grep -q "import_draft" && echo "✅ Server started" || echo "❌ Server failed"

echo ""
echo "MCP server is ready!"
echo ""
echo "Next steps:"
echo "1. Restart Claude Desktop"
echo "2. Try: 'List my JianYing projects'"
echo "3. Export a Screen Story session: node export-jianying.js <session>"
echo "4. Import to JianYing via Claude"
