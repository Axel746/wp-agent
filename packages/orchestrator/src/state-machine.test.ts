import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "./state-machine.js";

describe("machine à états", () => {
  it("autorise le chemin nominal", () => expect(canTransition("INTAKE", "WORDPRESS_SNAPSHOT")).toBe(true));
  it("refuse de sauter une étape", () => expect(() => assertTransition({ from: "INTAKE", to: "COMPLETED", actor: "system" })).toThrow());
  it("rend une transition rejouée idempotente", () => expect(() => assertTransition({ from: "INTAKE", to: "INTAKE", actor: "system" })).not.toThrow());
  it("exige l’approbation humaine du plan", () => expect(() => assertTransition({ from: "WAITING_FOR_PLAN_APPROVAL", to: "IMPLEMENTATION_BY_CODEX", actor: "claude", approved: true })).toThrow());
  it("interdit une destruction lancée par un modèle", () => expect(() => assertTransition({ from: "STAGING_VALIDATION", to: "COMPLETED", actor: "codex", destructive: true })).toThrow());
});
