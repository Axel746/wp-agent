import { describe, expect, it } from "vitest";
import type { RunData } from "@wp-agent-studio/orchestrator";
import { PrismaWorkflowRepository } from "./repository.js";

const integration = process.env.RUN_INTEGRATION === "true";

// Nécessite `docker compose up -d wordpress` (voir README) : ce test lance un vrai
// navigateur Playwright headless contre le WordPress local, sans fabriquer de résultat.
describe.skipIf(!integration)("Validation en direct de la mise en ligne (Playwright)", () => {
  it("navigue réellement sur le WordPress local et produit un rapport non fabriqué", async () => {
    const repository = new PrismaWorkflowRepository();
    const run: RunData = { id: "test", projectId: "test", workspaceId: "test", state: "STAGING_VALIDATION", stateVersion: 1, isPaused: false, cancellationRequested: false, turnCount: 0, fixCycleCount: 0, maxTurns: 12, maxFixCycles: 2, brief: {}, workspaceDirectory: process.cwd(), target: "local" };
    const report = await repository.validateStaging(run);
    expect(typeof report.passed).toBe("boolean");
    expect(report.summary.length).toBeGreaterThan(0);
    // Un rapport fabriqué renverrait toujours 92 ; ici la valeur (si présente) doit
    // provenir d'une mesure réelle du DOM rendu, jamais du placeholder historique.
    if (report.accessibilityScore !== undefined) expect(report.accessibilityScore).not.toBe(92);
  }, 60_000);
});

// Ce cas ne touche ni Docker ni le réseau (retour anticipé pour les cibles distantes),
// donc il tourne toujours, contrairement au reste de ce fichier.
describe("Validation en direct de la mise en ligne — cible distante", () => {
  it("ne fabrique jamais de rapport positif pour une cible distante", async () => {
    const repository = new PrismaWorkflowRepository();
    const run: RunData = { id: "test-remote", projectId: "test", workspaceId: "test", state: "STAGING_VALIDATION", stateVersion: 1, isPaused: false, cancellationRequested: false, turnCount: 0, fixCycleCount: 0, maxTurns: 12, maxFixCycles: 2, brief: {}, workspaceDirectory: process.cwd(), target: "remote" };
    const report = await repository.validateStaging(run);
    expect(report.accessibilityScore).toBeUndefined();
    expect(report.consoleErrors).toEqual([]);
    expect(report.brokenLinks).toEqual([]);
  });
});
