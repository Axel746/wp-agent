import { redactSecrets } from "@wp-agent-studio/security";

export type ContextItem = { id: string; content: string; trusted: boolean; createdAt: Date; relevance: number };
export type SelectedContext = { trusted: string; untrusted: string; omittedCount: number; summary: string };
export function selectContext(items: ContextItem[], maxCharacters = 24_000): SelectedContext {
  const ordered = [...items].sort((a, b) => b.relevance - a.relevance || b.createdAt.getTime() - a.createdAt.getTime()); let used = 0; const trusted: string[] = []; const untrusted: string[] = []; let omitted = 0;
  for (const item of ordered) { const safe = String(redactSecrets(item.content)); if (used + safe.length > maxCharacters) { omitted++; continue; } used += safe.length; (item.trusted ? trusted : untrusted).push(`[source:${item.id}]\n${safe}`); }
  return { trusted: trusted.join("\n\n"), untrusted: untrusted.join("\n\n"), omittedCount: omitted, summary: omitted ? `${omitted} élément(s) ancien(s) ou moins pertinent(s) omis.` : "Contexte complet dans la limite configurée." };
}
