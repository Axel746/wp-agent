import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { assertRuntimeConfiguration } from "../packages/security/src/runtime-config.js";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  try { process.loadEnvFile(envPath); } catch { /* Les variables déjà injectées restent prioritaires. */ }
}

try {
  const result = assertRuntimeConfiguration(process.env, { service: "all", production: true });
  process.stdout.write("Configuration de production valide.\n");
  for (const warning of result.warnings) process.stdout.write(`Avertissement : ${warning}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Configuration de production invalide";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
