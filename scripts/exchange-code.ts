/**
 * One-time use: exchange the short-lived authorization code (from the
 * Zoho API Console's "Generate Code" tab, under your Self Client) for a
 * long-lived refresh token.
 *
 * The code expires within minutes, so run this immediately after
 * generating it:
 *
 *   ZOHO_CLIENT_ID=... ZOHO_CLIENT_SECRET=... ZOHO_ACCOUNTS_DOMAIN=accounts.zoho.com \
 *     npx tsx scripts/exchange-code.ts <generated-code>
 *
 * Saves the refresh_token into .env.local as ZOHO_REFRESH_TOKEN (it is not printed).
 */
import dotenv from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setEnvValue } from "../src/env-file.js";
import { assertAccountsHost, disallowedScopes } from "../src/hosts.js";
const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
dotenv.config({ path: envPath });

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error("Usage: npx tsx scripts/exchange-code.ts <generated-code>");
    process.exit(1);
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const accountsDomain = process.env.ZOHO_ACCOUNTS_DOMAIN ?? "accounts.zoho.com";

  if (!clientId || !clientSecret) {
    console.error("Missing ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET (set in .env.local or the environment).");
    process.exit(1);
  }

  const url = new URL(`https://${assertAccountsHost(accountsDomain)}/oauth/v2/token`);
  url.searchParams.set("code", code);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url, { method: "POST" });
  const body = await res.json();

  if (!res.ok || !body.refresh_token) {
    console.error("Exchange failed:", JSON.stringify(body, null, 2));
    process.exit(1);
  }

  const bad = disallowedScopes(body.scope);
  if (bad.length) {
    console.error(
      `Refusing this token: it carries scopes outside Zoho Books READ-only: ${bad.join(", ")}.\n` +
        "Generate a new code with only ZohoBooks.<module>.READ scopes."
    );
    process.exit(1);
  }

  // Save straight into .env.local so the long-lived token is never printed or copied around.
  const current = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  writeFileSync(envPath, setEnvValue(current, "ZOHO_REFRESH_TOKEN", body.refresh_token));
  console.log("\nSuccess. ZOHO_REFRESH_TOKEN was saved to .env.local (the token itself is not shown).");
  console.log("Granted scopes:", body.scope ?? "(Zoho did not report them)");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
