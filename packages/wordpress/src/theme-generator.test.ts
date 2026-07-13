import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mockSpecification } from "@wp-agent-studio/agent-providers";
import { SiteBriefSchema } from "@wp-agent-studio/shared";
import { generateBlockTheme } from "./theme-generator.js";

describe("générateur de thème", () => { it("produit un ZIP déterministe installable", async () => { const directory = await mkdtemp(join(tmpdir(), "wpas-theme-")); try { const brief = SiteBriefSchema.parse({ name: "Atelier Vert", industry: "paysagisme", audience: "particuliers", primaryGoal: "devis", pages: ["Accueil"] }); const theme = await generateBlockTheme({ name: brief.name, specification: mockSpecification(brief), outputDirectory: directory }); expect(theme.size).toBeGreaterThan(100); const bytes = await readFile(theme.zipPath); expect(bytes.subarray(0, 2).toString()).toBe("PK"); expect(theme.sha256).toHaveLength(64); } finally { await rm(directory, { recursive: true, force: true }); } }); });
