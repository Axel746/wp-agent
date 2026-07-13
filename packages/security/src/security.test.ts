import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertAllowedWpCliCommand, can, decryptSecret, encryptSecret, isBlockedIp, redactSecrets, validateRuntimeConfiguration } from "./index.js";

describe("sécurité", () => {
  it("chiffre avec authentification", () => { const key = randomBytes(32); const encrypted = encryptSecret({ password: "secret" }, key); expect(decryptSecret(encrypted, key)).toEqual({ password: "secret" }); });
  it("détecte une altération", () => { const key = randomBytes(32); const encrypted = encryptSecret("secret", key); encrypted.authTag = Buffer.alloc(16).toString("base64"); expect(() => decryptSecret(encrypted, key)).toThrow(); });
  it("masque récursivement les secrets", () => expect(redactSecrets({ apiKey: "sk-ant-123456789012345", nested: { password: "x" } })).toEqual({ apiKey: "[REDACTED]", nested: { password: "[REDACTED]" } }));
  it("applique le RBAC", () => { expect(can("VIEWER", "project:write")).toBe(false); expect(can("EDITOR", "project:write")).toBe(true); });
  it("bloque les réseaux sensibles", () => { expect(isBlockedIp("169.254.169.254")).toBe(true); expect(isBlockedIp("8.8.8.8")).toBe(false); });
  it("bloque les commandes composées", () => { expect(() => assertAllowedWpCliCommand("wp theme activate studio; rm -rf /" )).toThrow(); expect(assertAllowedWpCliCommand("wp theme activate studio")).toBe("wp theme activate studio"); });
  it("refuse les valeurs d’exemple en production", () => {
    const result = validateRuntimeConfiguration({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@database.example.test/app",
      REDIS_URL: "rediss://default:password@redis.example.test:6380",
      APP_URL: "https://studio.example.test",
      AUTH_SECRET: "replace-with-at-least-32-random-characters",
      ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
      ARTIFACTS_DIR: "/data/artifacts",
      AGENT_MODE: "mock"
    }, { service: "web" });
    expect(result.issues).toContain("AUTH_SECRET utilise une valeur d’exemple interdite");
  });
  it("valide une configuration réelle sans exposer les secrets", () => {
    const result = validateRuntimeConfiguration({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@database.example.test/app?sslmode=require",
      REDIS_URL: "rediss://default:password@redis.example.test:6380",
      APP_URL: "https://studio.example.test",
      AUTH_SECRET: "a-secure-auth-secret-with-more-than-32-characters",
      ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      ARTIFACTS_DIR: "/data/artifacts",
      AGENT_MODE: "real",
      ANTHROPIC_API_KEY: "secret-anthropic-value",
      CLAUDE_MODEL: "configured-at-runtime",
      OPENAI_API_KEY: "secret-openai-value",
      CODEX_MODEL: "configured-at-runtime"
    }, { service: "all" });
    expect(result.issues).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("secret-openai-value");
    expect(JSON.stringify(result)).not.toContain("secret-anthropic-value");
  });
});
