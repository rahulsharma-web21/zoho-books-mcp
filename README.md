# Zoho Books MCP (read-only)

An MCP server that lets Claude **read** Zoho Books data and build reports from it. It cannot create, edit or delete anything in Books.

- **224 functions**, all `list_` or `get_` calls to the Zoho Books API v3 (invoices, bills, contacts, payments, banking, journals, taxes, projects and more).
- **7 dashboard reports:** Profit and Loss, Balance Sheet, Cash Flow, General Ledger, Trial Balance, Journal, Account Transactions (any period, cash or accrual).
- **Multi-organization:** every function takes an optional `organization` (name or id); results state which organization answered. `list_organizations` shows what the connected Zoho account can reach.
- Audit of every function and its Zoho scope: [AUDIT.md](AUDIT.md). Data types and limits: [DATA_TYPES.md](DATA_TYPES.md).

## How it stays read-only

1. One helper (`zohoBooksGet` in `src/zoho.ts`) sends GET requests only. The only POST is the Zoho login-token request.
2. All function names start with `list_` or `get_`.
3. The Zoho token must carry only `ZohoBooks.<module>.READ` scopes; the server refuses any other token (`src/hosts.ts`).
4. Credentials and requests go only to Zoho's own domains, and only to `/books/v3`.
5. The scopes are the real guarantee: with READ-only scopes, Zoho itself rejects any write.

## Setup

1. In the Zoho API Console (use the console of the same data center as the Zoho account, e.g. `api-console.zoho.com` for US), create a **Self Client**.
2. Generate a code with the 21 READ scopes listed in [AUDIT.md](AUDIT.md) (10-minute duration).
3. Copy `.env.local.example` to `.env.local` and fill in `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` and the domains.
4. Exchange the code right away: `npx tsx scripts/exchange-code.ts <code>`. It saves `ZOHO_REFRESH_TOKEN` into `.env.local` without printing it.
5. `npm install`, `npm run build`.

| Variable | Purpose |
|---|---|
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` | Zoho Self Client credentials |
| `ZOHO_ACCOUNTS_DOMAIN`, `ZOHO_API_DOMAIN` | Data center, e.g. `accounts.zoho.com` / `www.zohoapis.com` |
| `ZOHO_ORG_ID` | Optional default organization. Leave empty so every request names its organization |
| `ZOHO_ALLOWED_ORG_IDS` | Optional comma-separated allow list of organization ids |

**Never commit `.env.local`** (it is in `.gitignore`).

## Run and try it locally

```
npm run build
npx tsx scripts/call-tool.ts list                                   # list the functions
npx tsx scripts/call-tool.ts list_organizations
npx tsx scripts/call-tool.ts get_report_profit_and_loss organization="Test Company"
```

To use it in Claude Code on one machine, register the built server (stdio): `claude mcp add zoho-books -- node <path>/dist/index.js`.

## Status and what is needed to go live

This is currently a **local (stdio) server**. It works, but to host it as a Claude custom connector (a URL) it still needs:

1. **An HTTP entry point** using MCP's Streamable HTTP transport (for example a Vercel function). Not built yet.
2. **Authentication in front of it.** The endpoint would expose every client organization's books, so it must never be public. Claude supports OAuth sign-in, or a fixed header token (`Request headers`, in beta for some organizations, added by an organization Owner). See [Anthropic's connector docs](https://claude.com/docs/connectors/building/authentication). Optionally restrict to approved people.
3. **Zoho credentials as environment variables** on the host, never in the code.
4. **An access-token cache.** Zoho throttles token refreshes (about 10 per 10 minutes), and a serverless function would otherwise refresh on every call.
5. An organization Owner adds the URL in Claude: **Organization settings, Connectors, Add, Custom**.

## Security notes

- Other connectors enabled in the same Claude chat can receive data Claude has read. Keep write-capable connectors (CRM, email, etc.) off in chats that use this one, and review tool approvals.
- The connected Zoho account sees many client organizations. Prefer a dedicated view-only Zoho user, and use `ZOHO_ALLOWED_ORG_IDS` to limit what is reachable.
- Seven report functions use Zoho report endpoints that are not in Zoho's public API docs; they were confirmed by testing and could change.
