import { defineConfig, env } from "prisma/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// La commande prisma s'exécute avec ce dossier comme cwd ; le README/bootstrap.ps1
// place le .env à la racine du monorepo, donc il faut le charger explicitement.
const rootEnvPath = resolve(import.meta.dirname, "../../.env");
if (existsSync(rootEnvPath)) {
  try { process.loadEnvFile(rootEnvPath); } catch { /* déjà chargé ou illisible */ }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env("DATABASE_URL") }
});
