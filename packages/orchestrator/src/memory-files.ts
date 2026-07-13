import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { redactSecrets } from "@wp-agent-studio/security";

export type MemoryFileInput = { brief: unknown; specification?: unknown; siteMap?: unknown; designTokens?: unknown; decisions?: unknown[]; tasks?: unknown[]; testReport?: unknown; review?: unknown; deployment?: unknown };
const markdown = (title: string, value: unknown) => `# ${title}\n\n\`\`\`json\n${JSON.stringify(redactSecrets(value ?? {}), null, 2)}\n\`\`\`\n`;
export async function writeProjectMemoryFiles(directory: string, input: MemoryFileInput): Promise<string[]> {
  await mkdir(directory, { recursive: true }); const files: Record<string, string> = {
    "BRIEF.md": markdown("Brief", input.brief), "SPECIFICATION.md": markdown("Spécification", input.specification), "SITE_MAP.json": JSON.stringify(redactSecrets(input.siteMap ?? {}), null, 2), "DESIGN_TOKENS.json": JSON.stringify(redactSecrets(input.designTokens ?? {}), null, 2), "DECISIONS.md": markdown("Décisions", input.decisions ?? []), "TASKS.json": JSON.stringify(redactSecrets(input.tasks ?? []), null, 2), "TEST_REPORT.md": markdown("Rapport de tests", input.testReport), "REVIEW.md": markdown("Revue", input.review), "DEPLOYMENT.md": markdown("Déploiement", input.deployment)
  }; await Promise.all(Object.entries(files).map(([name, content]) => writeFile(join(directory, name), content, "utf8"))); return Object.keys(files);
}
