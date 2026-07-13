import { createHmac, timingSafeEqual } from "node:crypto";

export function createCsrfToken(sessionId: string, secret = process.env.AUTH_SECRET ?? ""): string {
  if (secret.length < 32) throw new Error("AUTH_SECRET doit contenir au moins 32 caractères");
  return createHmac("sha256", secret).update(`csrf:${sessionId}`).digest("base64url");
}
export function verifyCsrfToken(sessionId: string, token: string, secret = process.env.AUTH_SECRET ?? ""): boolean {
  const expected = createCsrfToken(sessionId, secret);
  const a = Buffer.from(expected); const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
