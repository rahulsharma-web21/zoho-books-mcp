// This connector is for Zoho Books only and is read-only. These checks make that
// true at run time rather than by convention: credentials only ever go to Zoho's
// own domains, and the token may only carry ZohoBooks.<module>.READ scopes.

const ACCOUNTS_HOSTS = new Set([
  "accounts.zoho.com",
  "accounts.zoho.eu",
  "accounts.zoho.in",
  "accounts.zoho.com.au",
  "accounts.zoho.jp",
  "accounts.zohocloud.ca",
  "accounts.zoho.sa",
  "accounts.zoho.com.cn",
]);

const API_HOSTS = new Set([
  "www.zohoapis.com",
  "www.zohoapis.eu",
  "www.zohoapis.in",
  "www.zohoapis.com.au",
  "www.zohoapis.jp",
  "www.zohoapis.ca",
  "www.zohoapis.sa",
  "www.zohoapis.com.cn",
]);

export function assertAccountsHost(host: string): string {
  if (!ACCOUNTS_HOSTS.has(host)) {
    throw new Error(`ZOHO_ACCOUNTS_DOMAIN "${host}" is not an official Zoho accounts domain. Allowed: ${[...ACCOUNTS_HOSTS].join(", ")}`);
  }
  return host;
}

export function assertApiHost(host: string): string {
  if (!API_HOSTS.has(host)) {
    throw new Error(`ZOHO_API_DOMAIN "${host}" is not an official Zoho API domain. Allowed: ${[...API_HOSTS].join(", ")}`);
  }
  return host;
}

const BOOKS_READ_SCOPE = /^ZohoBooks\.[A-Za-z]+\.READ$/;

/** Returns the scopes on a token that this connector refuses (empty list = fine). */
export function disallowedScopes(scope: string | undefined): string[] {
  return (scope ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .filter((s) => !BOOKS_READ_SCOPE.test(s));
}

export function assertBooksReadOnlyScopes(scope: string | undefined): void {
  const bad = disallowedScopes(scope);
  if (bad.length) {
    throw new Error(
      `Token carries scopes this read-only, Zoho-Books-only connector refuses to use: ${bad.join(", ")}. ` +
        `Generate a new code in the API Console with only ZohoBooks.<module>.READ scopes.`
    );
  }
}
