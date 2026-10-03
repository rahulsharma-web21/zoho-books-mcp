import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { assertAccountsHost, disallowedScopes } from "./hosts.js";
import { zohoAppCredentials, zohoBooksGet, zohoUser } from "./zoho.js";

// Hosted sign-in: Claude/ChatGPT send each user to Zoho's own consent screen. Only people whose Zoho
// login can reach a Books organization get through. Everything this server hands out (client ids,
// codes, tokens) is an encrypted, expiring blob, so nothing is stored and a restart logs nobody out.

const ACCOUNTS = assertAccountsHost(process.env.ZOHO_ACCOUNTS_DOMAIN ?? "accounts.zoho.com");
const SCOPES =
  process.env.ZOHO_OAUTH_SCOPES ??
  [
    "contacts", "invoices", "estimates", "salesorders", "creditnotes", "customerpayments", "bills",
    "vendorcredits", "vendorpayments", "purchaseorders", "expenses", "items", "settings",
    "accountants", "banking", "projects",
  ].map((m) => `ZohoBooks.${m}.READ`).join(",");

const key = createHash("sha256")
  .update(`mcp-oauth:${process.env.OAUTH_SECRET ?? process.env.ZOHO_OAUTH_CLIENT_SECRET ?? ""}`)
  .digest();

type Kind = "client" | "state" | "code" | "access" | "refresh";
const MINUTE = 60_000;
const TTL: Record<Kind, number> = {
  client: 365 * 24 * 60 * MINUTE,
  state: 10 * MINUTE,
  code: 5 * MINUTE,
  access: 60 * MINUTE,
  refresh: 90 * 24 * 60 * MINUTE,
};

function seal(kind: Kind, data: Record<string, unknown>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify({ ...data, k: kind, exp: Date.now() + TTL[kind] })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

function open(kind: Kind, blob: string): any {
  const raw = Buffer.from(blob, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  const data = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString());
  if (data.k !== kind || data.exp < Date.now()) throw new Error(`Invalid or expired ${kind}`);
  return data;
}

const clientsStore: OAuthRegisteredClientsStore = {
  getClient(clientId) {
    try {
      const { k, exp, ...meta } = open("client", clientId);
      return { ...meta, client_id: clientId };
    } catch {
      return undefined;
    }
  },
  registerClient(client) {
    const client_id = seal("client", client);
    return { ...client, client_id, client_id_issued_at: Math.floor(Date.now() / 1000) };
  },
};

export function createProvider(publicUrl: string): OAuthServerProvider & { callback: (req: Request, res: Response) => Promise<void> } {
  const zohoRedirect = `${publicUrl}/oauth/zoho/callback`;
  const tokens = (zrt: string, clientId: string): OAuthTokens => ({
    access_token: seal("access", { zrt, cid: clientId }),
    token_type: "Bearer",
    expires_in: TTL.access / 1000,
    refresh_token: seal("refresh", { zrt, cid: clientId }),
  });

  return {
    get clientsStore() {
      return clientsStore;
    },

    async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
      const url = new URL(`https://${ACCOUNTS}/oauth/v2/auth`);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", zohoAppCredentials().clientId);
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("redirect_uri", zohoRedirect);
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set(
        "state",
        seal("state", { cid: client.client_id, ru: params.redirectUri, cc: params.codeChallenge, st: params.state })
      );
      res.redirect(url.toString());
    },

    // Zoho redirects the user back here after they approve (or refuse) on its consent screen.
    async callback(req, res) {
      try {
        const state = open("state", String(req.query.state ?? ""));
        const back = (params: Record<string, string>) => {
          const url = new URL(state.ru);
          for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
          if (state.st) url.searchParams.set("state", state.st);
          res.redirect(url.toString());
        };
        if (req.query.error || !req.query.code) {
          return back({ error: "access_denied", error_description: String(req.query.error ?? "Zoho sign-in was not completed") });
        }

        const { clientId, clientSecret } = zohoAppCredentials();
        const form = new URLSearchParams({
          grant_type: "authorization_code",
          code: String(req.query.code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: zohoRedirect,
        });
        const zres = await fetch(`https://${ACCOUNTS}/oauth/v2/token`, { method: "POST", body: form });
        const z: any = await zres.json();
        if (!z.refresh_token) {
          return back({ error: "access_denied", error_description: `Zoho did not return a refresh token: ${z.error ?? "unknown error"}` });
        }
        const bad = disallowedScopes(z.scope);
        if (bad.length) return back({ error: "access_denied", error_description: `Refused scopes: ${bad.join(", ")}` });

        // The gate: this Zoho login must be able to reach at least one (allowed) Books organization.
        const orgs = await zohoUser.run({ refreshToken: z.refresh_token }, () => zohoBooksGet("/organizations"));
        if (!orgs?.organizations?.length) {
          return back({ error: "access_denied", error_description: "This Zoho account has no access to a Zoho Books organization" });
        }

        back({ code: seal("code", { zrt: z.refresh_token, cid: state.cid, ru: state.ru, cc: state.cc }) });
      } catch (err: any) {
        console.error("Zoho callback failed:", err);
        res.status(400).type("text").send("Sign-in failed. Close this window and try connecting again.");
      }
    },

    async challengeForAuthorizationCode(_client, code) {
      return open("code", code).cc;
    },

    async exchangeAuthorizationCode(client, code, _verifier, redirectUri) {
      const data = open("code", code);
      if (data.cid !== client.client_id || (redirectUri && redirectUri !== data.ru)) {
        throw new Error("Authorization code does not match this client");
      }
      return tokens(data.zrt, client.client_id);
    },

    async exchangeRefreshToken(client, refreshToken) {
      const data = open("refresh", refreshToken);
      if (data.cid !== client.client_id) throw new Error("Refresh token does not match this client");
      return tokens(data.zrt, client.client_id);
    },

    async verifyAccessToken(token): Promise<AuthInfo> {
      let data;
      try {
        data = open("access", token);
      } catch {
        throw new InvalidTokenError("Invalid or expired access token");
      }
      return { token, clientId: data.cid, scopes: [], expiresAt: Math.floor(data.exp / 1000), extra: { zrt: data.zrt } };
    },
  };
}
