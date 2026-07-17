import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getDb } from '@skillforge/core';
import { registerTools } from './tools.js';

const server = new McpServer({
  name: 'skillforge-mcp',
  version: '0.1.0',
}, {
  capabilities: {
    tools: {},
  },
  instructions: 'SkillForge MCP server — provides tools for querying skill suggestions and ROI.',
});

const db = getDb();

// Register query tools
registerTools(server, db);

// Startup
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('SkillForge MCP server error:', err);
  process.exit(1);
});
