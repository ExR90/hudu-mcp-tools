import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { HuduClient } from "./hudu-client.js";
import { articleTools, handleArticleTool } from "./tools/articles.js";
import { templateTools, handleTemplateTool } from "./tools/templates.js";
import { folderTools, handleFolderTool } from "./tools/folders.js";

// ─── Boot ─────────────────────────────────────────────────────────────────────

const client = new HuduClient(); // throws early if env vars are missing

const server = new Server(
  { name: "hudu-kb-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─── All tools ────────────────────────────────────────────────────────────────

const allTools = [...articleTools, ...templateTools, ...folderTools];

const articleToolNames: Set<string> = new Set(articleTools.map((t) => t.name));
const templateToolNames: Set<string> = new Set(templateTools.map((t) => t.name));
const folderToolNames: Set<string> = new Set(folderTools.map((t) => t.name));

// ─── Handlers ─────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const safeArgs = (args ?? {}) as Record<string, unknown>;

  if (articleToolNames.has(name)) {
    return handleArticleTool(name, safeArgs, client);
  }
  if (templateToolNames.has(name)) {
    return handleTemplateTool(name, safeArgs, client);
  }
  if (folderToolNames.has(name)) {
    return handleFolderTool(name, safeArgs, client);
  }

  return {
    isError: true,
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
  };
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // All logging must go to stderr — stdout is reserved for MCP JSON-RPC
  process.stderr.write("Hudu KB MCP server running (STDIO)\n");
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error}\n`);
  process.exit(1);
});
