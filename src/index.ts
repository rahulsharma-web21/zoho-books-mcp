import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer as createHttpServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { buildTools } from "./tools/registry.js";
import { coreEndpoints } from "./tools/endpoints-core.js";
import { salesEndpoints } from "./tools/endpoints-sales.js";
import { reportEndpoints } from "./tools/endpoints-reports.js";

// Every tool is a Zoho Books GET endpoint — this server is read-only by construction.
const { tools, handlers } = buildTools([...salesEndpoints, ...coreEndpoints, ...reportEndpoints]);

function buildServer() {
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
  return server;
}

function authorized(header: string | undefined, token: string): boolean {
  const given = Buffer.from((header ?? "").replace(/^Bearer /i, ""));
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

async function main() {
  const port = process.env.PORT;
  if (!port) {
    await buildServer().connect(new StdioServerTransport());
    return;
  }

  // HTTP mode (e.g. Render). The bearer token is optional: if MCP_AUTH_TOKEN is unset, the endpoint is open.
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) console.error("WARNING: MCP_AUTH_TOKEN not set - /mcp is unauthenticated");

  createHttpServer(async (req, res) => {
    const path = (req.url ?? "").split("?")[0];
    if (path === "/health") {
      res.writeHead(200).end("ok");
      return;
    }
    if (path !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    if (token && !authorized(req.headers.authorization, token)) {
      res.writeHead(401).end("Unauthorized");
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" }).end();
      return;
    }
    // Stateless: a fresh server + transport per request.
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  }).listen(Number(port), "0.0.0.0", () => console.error(`Listening on ${port}`));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
