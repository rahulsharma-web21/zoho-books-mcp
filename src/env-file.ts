/** Set KEY=value in the text of an env file: replace the existing line, or append one. Keeps the file's line endings. */
export function setEnvValue(content: string, key: string, value: string): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const line = `${key}=${value}`;
  const existing = new RegExp(`^${key}=.*$`, "m");
  if (existing.test(content)) return content.replace(existing, () => line);
  return content.replace(/\s*$/, "") + (content.trim() ? eol : "") + line + eol;
}
