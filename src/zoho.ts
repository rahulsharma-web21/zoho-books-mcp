import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertAccountsHost, assertApiHost, assertBooksReadOnlyScopes } from "./hosts.js";
// Read .env.local from the project root, not the caller's working directory:
// Claude launches this server from whatever folder it happens to be open in.
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const {
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN,
  ZOHO_ORG_ID,
  ZOHO_ACCOUNTS_DOMAIN = "accounts.zoho.com",
  ZOHO_API_DOMAIN = "www.zohoapis.com",
} = process.env;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token;
  }

  const clientId = requireEnv("ZOHO_CLIENT_ID", ZOHO_CLIENT_ID);
  const clientSecret = requireEnv("ZOHO_CLIENT_SECRET", ZOHO_CLIENT_SECRET);
  const refreshToken = requireEnv("ZOHO_REFRESH_TOKEN", ZOHO_REFRESH_TOKEN);

  const url = new URL(`https://${assertAccountsHost(ZOHO_ACCOUNTS_DOMAIN)}/oauth/v2/token`);
  url.searchParams.set("refresh_token", refreshToken);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "refresh_token");

  const res = await fetch(url, { method: "POST" });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new Error(`Zoho token refresh failed: ${JSON.stringify(body)}`);
  }
  // Refuse a token that is not Books-only and read-only before it is cached or used.
  assertBooksReadOnlyScopes(body.scope);
  if (!body.scope) console.error("Zoho did not report this token's scopes, so they could not be checked as Books READ-only.");

  cachedAccessToken = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cachedAccessToken.token;
}

// ---- organizations -------------------------------------------------------------------------
// One Zoho login can reach many organizations (client companies). Every request must name one;
// it is checked against the live list Zoho returns for this token, and optionally narrowed by
// ZOHO_ALLOWED_ORG_IDS (comma-separated). ZOHO_ORG_ID, if set, is only the default.

const ALLOWED_ORG_IDS = new Set(
  (process.env.ZOHO_ALLOWED_ORG_IDS ?? "").split(",").map((v) => v.trim()).filter(Boolean)
);

type Org = { organization_id: string; name: string };
let orgCache: { orgs: Org[]; at: number } | null = null;

async function accessibleOrganizations(): Promise<Org[]> {
  if (!orgCache || Date.now() - orgCache.at > 10 * 60_000) {
    const body = await request("/organizations", {}, undefined);
    const orgs: Org[] = (body.organizations ?? []).map((o: any) => ({
      organization_id: String(o.organization_id),
      name: String(o.name ?? "").trim(),
    }));
    orgCache = { orgs, at: Date.now() };
  }
  return ALLOWED_ORG_IDS.size ? orgCache.orgs.filter((o) => ALLOWED_ORG_IDS.has(o.organization_id)) : orgCache.orgs;
}

const describeOrgs = (orgs: Org[]) => orgs.map((o) => `${o.name} (${o.organization_id})`).join("; ");

async function resolveOrganization(choice?: string): Promise<Org> {
  const orgs = await accessibleOrganizations();
  const wanted = (choice ?? ZOHO_ORG_ID ?? "").trim();
  if (!wanted) {
    throw new Error(`Say which organization to use: pass "organization" (a name or an id). Available: ${describeOrgs(orgs)}`);
  }
  const byId = orgs.find((o) => o.organization_id === wanted);
  if (byId) return byId;
  const lower = wanted.toLowerCase();
  const exact = orgs.filter((o) => o.name.toLowerCase() === lower);
  if (exact.length === 1) return exact[0];
  const partial = orgs.filter((o) => o.name.toLowerCase().includes(lower));
  if (partial.length === 1) return partial[0];
  const why = exact.length > 1 || partial.length > 1 ? "matches more than one organization" : "is not an organization this connector may use";
  throw new Error(`Organization "${wanted}" ${why}. Available: ${describeOrgs(orgs)}`);
}

// ---- requests ------------------------------------------------------------------------------

async function request(
  path: string,
  params: Record<string, string | number | undefined>,
  organizationId: string | undefined
): Promise<any> {
  const apiHost = assertApiHost(ZOHO_API_DOMAIN);
  const accessToken = await getAccessToken();

  const url = new URL(`https://${apiHost}/books/v3${path}`);
  if (!url.pathname.startsWith("/books/v3/")) throw new Error("Refusing a request outside the Zoho Books API");
  if (organizationId) url.searchParams.set("organization_id", organizationId);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Zoho Books API error (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

/** The only way the connector reads Zoho Books data: a GET, for one named organization. */
export async function zohoBooksGet(
  path: string,
  params: Record<string, string | number | undefined> = {},
  organization?: string
): Promise<any> {
  // The organization list (and lookups under it) need no organization to be chosen first.
  if (/^\/organizations(\/user|\/\d+)?$/.test(path)) {
    const body = await request(path, params, ZOHO_ORG_ID);
    if (ALLOWED_ORG_IDS.size && Array.isArray(body?.organizations)) {
      body.organizations = body.organizations.filter((o: any) => ALLOWED_ORG_IDS.has(String(o.organization_id)));
    }
    return body;
  }

  const org = await resolveOrganization(organization);
  const body = await request(path, params, org.organization_id);
  // Say which organization answered, so a result can never be mistaken for another client's.
  if (body && typeof body === "object" && !Array.isArray(body)) {
    body._organization = { organization_id: org.organization_id, name: org.name };
  }
  return body;
}
