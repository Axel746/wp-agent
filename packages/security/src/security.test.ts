import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertAllowedWpCliCommand, can, decryptSecret, encryptSecret, isBlockedIp, redactSecrets } from "./index.js";

describe("sécurité", () => {
  it("chiffre avec authentification", () => { const key = randomBytes(32); const encrypted = encryptSecret({ password: "secret" }, key); expect(decryptSecret(encrypted, key)).toEqual({ password: "secret" }); });
  it("détecte une altération", () => { const key = randomBytes(32); const encrypted = encryptSecret("secret", key); encrypted.authTag = Buffer.alloc(16).toString("base64"); expect(() => decryptSecret(encrypted, key)).toThrow(); });
  it("masque récursivement les secrets", () => expect(redactSecrets({ apiKey: "sk-ant-123456789012345", nested: { password: "x" } })).toEqual({ apiKey: "[REDACTED]", nested: { password: "[REDACTED]" } }));
  it("applique le RBAC", () => { expect(can("VIEWER", "project:write")).toBe(false); expect(can("EDITOR", "project:write")).toBe(true); });
  it("bloque les réseaux sensibles", () => { expect(isBlockedIp("169.254.169.254")).toBe(true); expect(isBlockedIp("8.8.8.8")).toBe(false); });
  it("bloque les commandes composées", () => { expect(() => assertAllowedWpCliCommand("wp theme activate studio; rm -rf /" )).toThrow(); expect(assertAllowedWpCliCommand("wp theme activate studio")).toBe("wp theme activate studio"); });
});
