import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Next.js ne charge les .env que depuis apps/web ; le README/bootstrap.ps1
// placent le .env à la racine du monorepo, donc il faut le charger explicitement.
const rootEnvPath = resolve(import.meta.dirname, "../../.env");
if (existsSync(rootEnvPath)) {
  try { process.loadEnvFile(rootEnvPath); } catch { /* déjà chargé ou illisible */ }
}

const config: NextConfig = {
  transpilePackages: ["@wp-agent-studio/shared", "@wp-agent-studio/security", "@wp-agent-studio/database", "@wp-agent-studio/wordpress", "@wp-agent-studio/orchestrator", "@wp-agent-studio/agent-providers"],
  webpack(configuration) {
    configuration.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"], ".mjs": [".mts", ".mjs"], ".cjs": [".cts", ".cjs"] };
    return configuration;
  }
};
export default config;
