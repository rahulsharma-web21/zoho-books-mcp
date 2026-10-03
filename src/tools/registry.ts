import { zohoBooksGet } from "../zoho.js";

/**
 * One read-only Zoho Books endpoint. Every entry becomes an MCP tool that can
 * only issue a GET (zohoBooksGet has no other verb), so nothing here can write.
 *
 * `path` may contain {placeholders}; each becomes a required string argument.
 * `filters` are optional query parameters, exactly as named in the Zoho docs.
 * `fixed` are query params always sent (e.g. accept=json where the API defaults to html).
 */
export type Endpoint = {
  name: string;
  description: string;
  path: string;
  filters?: string[];
  fixed?: Record<string, string>;
  paginated?: boolean;
  /** Zoho reports ignore from_date/to_date unless filter_by=TransactionDate.CustomDate; set it for the caller. */
  customDateFilter?: boolean;
  /** Zoho rejects a report with no period at all; use this filter_by when the caller gives none. */
  defaultPeriod?: string;
};

type Prop = { type: string; description?: string };

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

const ORG_HELP =
  "Name or id of the Zoho organization (client company) to read; see list_organizations. " +
  "Always name the organization explicitly when working across clients.";

export function buildTools(endpoints: Endpoint[]) {
  const tools: { name: string; description: string; inputSchema: { type: "object"; properties: Record<string, Prop>; required?: string[] } }[] = [];
  const handlers: Record<string, (args: Record<string, any>) => Promise<any>> = {};

  for (const ep of endpoints) {
    if (handlers[ep.name]) throw new Error(`Duplicate tool name: ${ep.name}`);

    const placeholders = [...ep.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const properties: Record<string, Prop> = {};
    for (const p of placeholders) properties[p] = { type: "string" };
    for (const f of ep.filters ?? []) properties[f] = { type: "string" };
    // everything except the organization lookups reads one named organization
    const orgScoped = !/^\/organizations(\/user|\/\{organization_id\})?$/.test(ep.path);
    if (orgScoped) properties.organization = { type: "string", description: ORG_HELP };
    if (ep.paginated) {
      properties.page = { type: "number", description: "1-based page number" };
      properties.per_page = { type: "number", description: "Records per page" };
    }

    tools.push({
      name: ep.name,
      description: ep.description,
      inputSchema: {
        type: "object" as const,
        properties,
        ...(placeholders.length ? { required: placeholders } : {}),
      },
    });

    const allowed = new Set([...(ep.filters ?? []), ...(ep.paginated ? ["page", "per_page"] : [])]);
    handlers[ep.name] = async (args) => {
      let path = ep.path;
      for (const p of placeholders) {
        const value = String(args[p] ?? "");
        // Ids go straight into the URL path — refuse anything that could change the route.
        if (!SAFE_SEGMENT.test(value)) throw new Error(`Invalid value for ${p}`);
        path = path.replace(`{${p}}`, value);
      }
      // A misspelt argument must fail loudly: ignoring it would quietly answer from the default company.
      const known = new Set([...placeholders, ...allowed, ...(orgScoped ? ["organization", "organization_id"] : [])]);
      const unknown = Object.keys(args).filter((k) => !known.has(k));
      if (unknown.length) {
        throw new Error(`Unknown argument(s): ${unknown.join(", ")}. Accepted: ${[...known].join(", ") || "none"}`);
      }
      const query: Record<string, string | number | undefined> = { ...ep.fixed };
      for (const [k, v] of Object.entries(args)) {
        if (allowed.has(k) && v !== undefined && v !== "") query[k] = v;
      }
      if (ep.customDateFilter && !query.filter_by) {
        if (query.from_date || query.to_date) query.filter_by = "TransactionDate.CustomDate";
        else query.filter_by = ep.defaultPeriod ?? "TransactionDate.ThisMonth";
      }
      return zohoBooksGet(path, query, orgScoped ? args.organization ?? args.organization_id : undefined);
    };
  }

  return { tools, handlers };
}
