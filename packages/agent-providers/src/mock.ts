import { createHash } from "node:crypto";
import { DesignTokensSchema, ImplementationPlanSchema, ReviewDecisionSchema, SiteSpecificationSchema, type SiteBrief } from "@wp-agent-studio/shared";
import type { z } from "zod";
import type { AgentProviderResult, StructuredAgentProvider } from "./types.js";

const tokens = DesignTokensSchema.parse({ colors: { background: "#F7F4EC", text: "#16221D", primary: "#176B52", accent: "#E38B49", surface: "#FFFFFF" }, typography: { heading: "ui-serif, Georgia, serif", body: "ui-sans-serif, system-ui, sans-serif" }, spacing: { sm: "0.75rem", md: "1.5rem", lg: "3rem" }, radius: { sm: "6px", md: "12px", lg: "24px" } });

export const mockSpecification = (brief: SiteBrief) => SiteSpecificationSchema.parse({
  summary: `${brief.name} est un site ${brief.industry} conçu pour ${brief.audience}.`,
  assumptions: ["Les contenus sont créés en brouillon avant validation", "Le site respecte WCAG 2.2 niveau AA", "Aucune extension externe n’est requise"],
  siteMap: { pages: brief.pages.map((title, index) => ({ slug: title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `page-${index + 1}`, title, purpose: index === 0 ? `Présenter ${brief.primaryGoal}` : `Répondre aux besoins liés à ${title}`, parentSlug: null })) },
  designTokens: tokens,
  contentPlan: { pages: brief.pages.map((title, index) => ({ slug: title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `page-${index + 1}`, title, sections: [{ heading: title, body: `${title} — un contenu clair, utile et orienté vers ${brief.primaryGoal}.` }, { heading: "Passez à l’action", body: "Contactez-nous pour construire la prochaine étape ensemble." }] })) },
  uxPrinciples: ["Navigation courte et prévisible", "Appel à l’action visible sans interrompre la lecture", "Contrastes, focus et structure sémantique accessibles"],
  acceptanceCriteria: ["Le thème de blocs est installable", "Toutes les pages existent en brouillon", "Le rendu est responsive", "Aucun secret ne figure dans les artefacts"]
});

export const mockPlan = () => ImplementationPlanSchema.parse({ summary: "Créer un thème de blocs autonome, son contenu et les contrôles qualité.", tasks: [
  { id: "theme", title: "Générer le thème", description: "Créer theme.json, templates, parts et pattern", status: "pending", dependencies: [] },
  { id: "content", title: "Préparer le contenu", description: "Produire un bundle de pages en brouillon", status: "pending", dependencies: ["theme"] },
  { id: "quality", title: "Contrôler les artefacts", description: "Vérifier structure, sécurité et ZIP", status: "pending", dependencies: ["theme", "content"] }
], files: ["style.css", "theme.json", "functions.php", "templates/index.html", "parts/header.html", "parts/footer.html", "patterns/hero.php"], commands: ["pnpm test", "pnpm typecheck"], risks: ["Le déploiement distant du thème nécessite SSH/WP-CLI ou une installation manuelle du ZIP"] });

export class MockClaudeProvider implements StructuredAgentProvider {
  readonly name = "claude" as const;
  async testConnection() { return { ok: true as const, provider: "Anthropic (simulation déterministe)", model: "mock" }; }
  async invoke<T>(input: { instruction: string; trustedContext: string; schema: z.ZodType<T> }): Promise<AgentProviderResult<T>> {
    const started = Date.now(); let candidate: unknown; const schema = input.schema as z.ZodTypeAny;
    if (schema === (SiteSpecificationSchema as z.ZodTypeAny)) candidate = mockSpecification(JSON.parse(input.trustedContext) as SiteBrief);
    else if (schema === (ReviewDecisionSchema as z.ZodTypeAny)) candidate = ReviewDecisionSchema.parse({ approved: true, summary: "La réalisation respecte le plan approuvé et les contrôles disponibles.", findings: [], requiresHuman: true });
    else candidate = {};
    return { humanReadable: schema === (SiteSpecificationSchema as z.ZodTypeAny) ? "J’ai transformé le brief en cahier des charges structuré, avec arborescence, contenus et principes UX." : "Revue terminée : aucun problème bloquant détecté. Une validation humaine reste obligatoire.", payload: input.schema.parse(candidate), artifactRefs: [], usage: { model: "mock", inputTokens: 0, outputTokens: 0, estimatedCostCents: 0, durationMs: Date.now() - started } };
  }
}

export class MockCodexProvider implements StructuredAgentProvider {
  readonly name = "codex" as const;
  async testConnection() { return { ok: true as const, provider: "Codex (simulation déterministe)", model: "mock" }; }
  async invoke<T>(input: { instruction: string; trustedContext: string; schema: z.ZodType<T> }): Promise<AgentProviderResult<T>> {
    const started = Date.now(); const candidate = (input.schema as z.ZodTypeAny) === (ImplementationPlanSchema as z.ZodTypeAny) ? mockPlan() : {};
    return { humanReadable: "J’ai établi un plan technique vérifiable pour produire le thème, le contenu et leurs rapports.", payload: input.schema.parse(candidate), artifactRefs: [], usage: { model: "mock", inputTokens: 0, outputTokens: 0, estimatedCostCents: 0, durationMs: Date.now() - started }, threadId: `mock-${createHash("sha1").update(input.instruction).digest("hex").slice(0, 12)}` };
  }
}
