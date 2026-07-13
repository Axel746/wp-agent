import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { assertRuntimeConfiguration } from "@wp-agent-studio/security";

// Le worker tourne avec apps/worker comme cwd ; le README/bootstrap.ps1 placent
// le .env à la racine du monorepo, donc il faut le charger explicitement avant
// que les autres modules ne lisent process.env au chargement.
const rootEnvPath = resolve(import.meta.dirname, "../../../.env");
if (existsSync(rootEnvPath)) {
  try { process.loadEnvFile(rootEnvPath); } catch { /* déjà chargé ou illisible */ }
}

if (process.env.NODE_ENV === "production") {
  assertRuntimeConfiguration(process.env, { service: "worker" });
}
