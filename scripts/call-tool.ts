/**
 * Call one of the connector's functions from the terminal, without Claude.
 * Starts the built server (dist/index.js) and talks to it as an MCP client.
 *
 *   npm run build                                        (once, and after code changes)
 *   npx tsx scripts/call-tool.ts list                    list every function name
 *   npx tsx scripts/call-tool.ts list_organizations
 *   npx tsx scripts/call-tool.ts list_invoices status=overdue page=1
 *   npx tsx scripts/call-tool.ts get_invoice invoice_id=123456
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [name, ...pairs] = process.argv.slice(2);
if (!name) {
  console.error("Usage: npx tsx scripts/call-tool.ts <list | function_name> [key=value ...]");
  process.exit(1);
}

const args: Record<string, string> = {};
for (const pair of pairs) {
  const i = pair.indexOf("=");
  if (i < 1) {
    console.error(`Expected key=value, got "${pair}"`);
    process.exit(1);
  }
  args[pair.slice(0, i)] = pair.slice(i + 1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const client = new Client({ name: "call-tool", version: "0.1.0" });
await client.connect(
  new StdioClientTransport({ command: process.execPath, args: [resolve(root, "dist", "index.js")] })
);

try {
  if (name === "list") {
    const { tools } = await client.listTools();
    console.log(`${tools.length} functions\n` + tools.map((t) => t.name).join("\n"));
  } else {
    const result: any = await client.callTool({ name, arguments: args });
    for (const part of result.content ?? []) {
      if (part.type === "text") console.log(part.text);
    }
    if (result.isError) process.exitCode = 1;
  }
} finally {
  await client.close();
}
