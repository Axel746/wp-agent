import { describe, expect, it } from "vitest";
import { ImplementationPlanSchema, SiteBriefSchema, SiteSpecificationSchema } from "@wp-agent-studio/shared";
import { MockClaudeProvider, MockCodexProvider } from "./mock.js";

const brief = SiteBriefSchema.parse({ name: "Atelier Vert", industry: "paysagisme", audience: "particuliers", primaryGoal: "obtenir des demandes de devis", pages: ["Accueil", "Services", "Contact"] });
describe("adaptateurs mock", () => {
  it("Claude produit une spécification déterministe", async () => { const provider = new MockClaudeProvider(); const a = await provider.invoke({ instruction: "spécifie", trustedContext: JSON.stringify(brief), schema: SiteSpecificationSchema }); const b = await provider.invoke({ instruction: "spécifie", trustedContext: JSON.stringify(brief), schema: SiteSpecificationSchema }); expect(a.payload).toEqual(b.payload); });
  it("Codex produit un plan valide", async () => { const result = await new MockCodexProvider().invoke({ instruction: "planifie", trustedContext: "{}", schema: ImplementationPlanSchema }); expect(result.payload.tasks.length).toBeGreaterThan(0); });
});
