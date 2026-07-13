import type { z } from "zod";

export type ProviderUsage = { model?: string; inputTokens?: number; outputTokens?: number; estimatedCostCents?: number; durationMs: number };
export type AgentProviderResult<T> = { humanReadable: string; payload: T; artifactRefs: { id: string; name: string; kind: string; uri: string }[]; usage: ProviderUsage; threadId?: string };
export interface StructuredAgentProvider {
  readonly name: "claude" | "codex";
  invoke<T>(input: { instruction: string; trustedContext: string; untrustedContext?: string; schema: z.ZodType<T>; workspaceDirectory?: string; threadId?: string }): Promise<AgentProviderResult<T>>;
  testConnection(): Promise<{ ok: true; provider: string; model: string }>;
}
