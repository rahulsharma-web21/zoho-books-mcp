/**
 * Read-only smoke test: calls every function once against the organization in ZOHO_ORG_ID,
 * in a single process (one access token) and with a pause between calls to respect Zoho's rate limit.
 * It prints each function's status only, never the data.
 *
 *   npx tsx scripts/smoke-test.ts
 *
 * Functions that need an id use a real one harvested from the list calls when the organization has data;
 * otherwise they get a made-up id, and "record not found" counts as the path being valid.
 */
import { buildTools, type Endpoint } from "../src/tools/registry.js";
import { coreEndpoints } from "../src/tools/endpoints-core.js";
import { salesEndpoints } from "../src/tools/endpoints-sales.js";
import { reportEndpoints } from "../src/tools/endpoints-reports.js";

const allEndpoints: Endpoint[] = [...salesEndpoints, ...coreEndpoints, ...reportEndpoints];
const { handlers } = buildTools(allEndpoints);
// optional: name some functions on the command line to test only those
const only = process.argv.slice(2);
const endpoints = only.length ? allEndpoints.filter((e) => only.includes(e.name)) : allEndpoints;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const placeholdersOf = (e: Endpoint) => [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
const base = (e: Endpoint) => e.path.split("{")[0].replace(/\/$/, "");

// ids harvested from list results: by list path + field, and globally by field
const byList = new Map<string, string>();
const global = new Map<string, string>();
function harvest(listPath: string, body: any) {
  for (const v of Object.values(body ?? {})) {
    if (!Array.isArray(v)) continue;
    for (const item of v.slice(0, 3)) {
      if (!item || typeof item !== "object") continue;
      for (const [k, val] of Object.entries(item)) {
        if (/_id$/.test(k) && (typeof val === "string" || typeof val === "number") && /^[A-Za-z0-9_-]+$/.test(String(val))) {
          if (!byList.has(`${listPath}:${k}`)) byList.set(`${listPath}:${k}`, String(val));
          if (!global.has(k)) global.set(k, String(val));
        }
      }
    }
  }
}

type Result = { name: string; cls: string; detail: string; rows?: number };
const results: Result[] = [];

function classify(err: any): { cls: string; detail: string } {
  const m = String(err?.message ?? err);
  if (/too many requests|token refresh/i.test(m)) return { cls: "STOP", detail: m.slice(0, 120) };
  let code: any, msg = m;
  try { const o = JSON.parse(m.match(/\{.*\}/s)![0]); code = o.code; msg = String(o.message ?? ""); } catch { /* keep raw */ }
  if (code === 57) return { cls: "SCOPE", detail: "not authorized (scope)" };
  // the path is right, there is just no such record to fetch
  if (/does not exist|doesn't exist|not found|is not accessible|valid .{0,25} id|you are looking for is not available|not associated to this account/i.test(msg)) {
    return { cls: "VALID (record not found)", detail: `code ${code}` };
  }
  if (code === 104003 || code === 9 || /don't have permission|no permission|permission denied|not authorized/i.test(msg)) {
    return { cls: "ROLE (account lacks permission)", detail: msg.slice(0, 80) };
  }
  if (code === 5) return { cls: "PATH?", detail: msg.slice(0, 80) };
  if (/disabled|not enabled|was not enabled|sync not configured|not available for your current edition|service is currently unavailable|inventory tracking|upgrade/i.test(msg)) {
    return { cls: "FEATURE or service off", detail: `code ${code}: ${msg.slice(0, 80)}` };
  }
  return { cls: "OTHER", detail: `code ${code ?? "?"}: ${msg.slice(0, 110)}` };
}

async function run(e: Endpoint, args: Record<string, string>) {
  try {
    const body: any = await handlers[e.name](args);
    const arrays = Object.values(body ?? {}).filter(Array.isArray) as any[][];
    const rows = arrays.length ? arrays[0].length : undefined;
    results.push({ name: e.name, cls: rows ? "OK with data" : "OK", detail: "", rows });
    if (placeholdersOf(e).length === 0) harvest(e.path, body);
    return true;
  } catch (err) {
    const c = classify(err);
    results.push({ name: e.name, ...c });
    return c.cls !== "STOP";
  }
}

const SKIP = new Set<string>();
const period = { from_date: "2026-01-01", to_date: "2026-06-30" };

// Round 1: functions with no id in the path
const first = endpoints.filter((e) => placeholdersOf(e).length === 0 && !SKIP.has(e.name));
// Round 2: functions that need an id
const second = endpoints.filter((e) => placeholdersOf(e).length > 0 && !SKIP.has(e.name));

console.log(`org: ${process.env.ZOHO_ORG_ID ?? "(from .env.local)"} — round 1: ${first.length} functions without ids`);
for (const e of first) {
  const args: Record<string, string> = {};
  if (e.paginated) args.per_page = "1";
  if (e.name.startsWith("get_report_")) Object.assign(args, period);
  // functions that need one extra filter to work at all
  if (e.name === "list_account_transactions" || e.name === "get_opening_balance_details") {
    const id = global.get("account_id"); if (id) args.account_id = id;
  }
  if (e.name === "list_price_list_items") { const id = global.get("pricebook_id"); if (id) args.pricebook_id = id; }
  if (e.name === "list_all_contact_bank_accounts" || e.name === "get_contact_card_count") args.contact_ids = global.get("contact_id") ?? "1234567890123";
  if (e.name === "list_e_invoices") args.invoice_ids = global.get("invoice_id") ?? "1234567890123";
  if (e.name === "list_credit_note_e_invoices") args.creditnote_ids = global.get("creditnote_id") ?? "1234567890123";
  if (e.name === "list_bank_match_filters") { const id = global.get("account_id"); if (id) args.account_id = id; }
  if (e.name === "get_transaction_journal") args.entity_type = "invoice";
  if (!(await run(e, args))) break;
  await sleep(700);
}

console.log(`round 2: ${second.length} functions with ids (real ids where the organization has data)`);
for (const e of second) {
  const args: Record<string, string> = {};
  for (const p of placeholdersOf(e)) {
    args[p] = byList.get(`${base(e)}:${p}`) ?? global.get(p) ?? "1234567890123";
  }
  if (e.name === "list_all_contact_bank_accounts" || e.name === "get_contact_card_count") args.contact_ids = global.get("contact_id") ?? "1234567890123";
  if (e.name === "list_e_invoices") args.invoice_ids = global.get("invoice_id") ?? "1234567890123";
  if (e.name === "list_credit_note_e_invoices") args.creditnote_ids = global.get("creditnote_id") ?? "1234567890123";
  if (e.name === "list_bank_match_filters") { const id = global.get("account_id"); if (id) args.account_id = id; }
  if (e.name === "get_transaction_journal") args.entity_type = "invoice";
  if (e.name === "get_contact_opening_balances") args.contact_type = "customer";
  if (e.name === "get_contact_by_reference") args.reference_id_type = "zcrm_account_id";
  if (!(await run(e, args))) break;
  await sleep(700);
}

// ---- summary ----
const groups = new Map<string, Result[]>();
for (const r of results) groups.set(r.cls, [...(groups.get(r.cls) ?? []), r]);
console.log(`\ncalled ${results.length} of ${endpoints.length} functions (${SKIP.size} skipped on purpose)\n`);
for (const [cls, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${cls}: ${list.length}`);
  if (!["OK", "OK with data", "VALID (record not found)"].includes(cls)) {
    for (const r of list) console.log(`   ${r.name} — ${r.detail}`);
  }
}
const withData = results.filter((r) => r.cls === "OK with data").map((r) => r.name);
console.log(`\nreturned data in this organization: ${withData.length ? withData.join(", ") : "none"}`);
