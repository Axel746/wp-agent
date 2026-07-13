const secretKeys = /(?:password|passphrase|token|secret|api[-_]?key|authorization|cookie|private[-_]?key)/i;
const credentialPatterns = [
  /\b(sk-(?:ant-|proj-)?[A-Za-z0-9_-]{12,})\b/g,
  /\b(Basic|Bearer)\s+[A-Za-z0-9+/_=.:-]+/gi,
  /([?&](?:password|token|key)=)[^&\s]+/gi
];

export function redactString(value: string): string {
  return credentialPatterns.reduce((current, pattern) => current.replace(pattern, (_match, prefix?: string) => prefix?.startsWith("?") || prefix?.startsWith("&") ? `${prefix}[REDACTED]` : "[REDACTED]"), value);
}

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, secretKeys.test(key) ? "[REDACTED]" : redactSecrets(child)]));
  return value;
}
