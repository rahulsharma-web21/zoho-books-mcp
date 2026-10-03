import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer as createHttpServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import express from "express";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createProvider } from "./oauth.js";
import { zohoUser } from "./zoho.js";
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

// Hosted mode with per-user Zoho sign-in. Needs ZOHO_OAUTH_CLIENT_ID/SECRET (a server-based Zoho app).
function startOAuthServer(port: number) {
  const base = process.env.PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL;
  if (!base) throw new Error("Set PUBLIC_URL to this server's public https URL");
  const publicUrl = base.replace(/\/$/, "");
  const provider = createProvider(publicUrl);
  const app = express();
  app.set("trust proxy", 1);

  app.get("/health", (_req, res) => void res.send("ok"));
  app.use(mcpAuthRouter({ provider, issuerUrl: new URL(publicUrl), resourceServerUrl: new URL(`${publicUrl}/mcp`) }));
  app.get("/oauth/zoho/callback", (req, res) => void provider.callback(req, res));

  app.post(
    "/mcp",
    requireBearerAuth({ verifier: provider, resourceMetadataUrl: `${publicUrl}/.well-known/oauth-protected-resource/mcp` }),
    express.json({ limit: "4mb" }),
    async (req, res) => {
      // Stateless: a fresh server + transport per request, running as the signed-in Zoho user.
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      const refreshToken = (req as any).auth.extra.zrt as string;
      await zohoUser.run({ refreshToken }, async () => {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      });
    }
  );
  app.all("/mcp", (_req, res) => void res.status(405).set("Allow", "POST").end());

  app.listen(port, "0.0.0.0", () => console.error(`Listening on ${port} (Zoho OAuth sign-in)`));
}

async function main() {
  const port = process.env.PORT;
  if (!port) {
    await buildServer().connect(new StdioServerTransport());
    return;
  }

  if (process.env.ZOHO_OAUTH_CLIENT_ID) {
    startOAuthServer(Number(port));
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
