import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { buildTools } from "./tools/registry.js";
import { coreEndpoints } from "./tools/endpoints-core.js";
import { salesEndpoints } from "./tools/endpoints-sales.js";
import { reportEndpoints } from "./tools/endpoints-reports.js";

// Every tool is a Zoho Books GET endpoint — this server is read-only by construction.
const { tools, handlers } = buildTools([...salesEndpoints, ...coreEndpoints, ...reportEndpoints]);

const server = new Server(
  { name: "zoho-books-mcp", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const handler = handlers[request.params.name];
  if (!handler) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }
  try {
    const result = await handler(request.params.arguments ?? {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err.message ?? String(err)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
