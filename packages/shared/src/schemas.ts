import { z } from "zod";

export const WorkflowStateSchema = z.enum([
  "INTAKE", "WORDPRESS_SNAPSHOT", "SPECIFICATION_BY_CLAUDE", "TECHNICAL_PLAN_BY_CODEX", "PLAN_REVIEW_BY_CLAUDE",
  "WAITING_FOR_PLAN_APPROVAL", "IMPLEMENTATION_BY_CODEX", "AUTOMATED_TESTS", "REVIEW_BY_CLAUDE", "FIXES_BY_CODEX",
  "WAITING_FOR_DEPLOYMENT_APPROVAL", "STAGING_DEPLOYMENT", "STAGING_VALIDATION", "PRODUCTION_DEPLOYMENT", "COMPLETED", "FAILED", "CANCELLED"
]);
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

export const AgentNameSchema = z.enum(["user", "claude", "codex", "system"]);
export const AgentRecipientSchema = z.enum(["user", "claude", "codex", "system", "all"]);
export const AgentMessageTypeSchema = z.enum(["brief", "question", "answer", "specification", "plan", "review", "decision", "task", "tool_call", "tool_result", "artifact", "error"]);

const artifactRef = z.object({ id: z.string().min(1), name: z.string().min(1), kind: z.string().min(1), uri: z.string().min(1) });
export const SiteBriefSchema = z.object({
  name: z.string().min(2).max(120), industry: z.string().min(2), audience: z.string().min(2), primaryGoal: z.string().min(2),
  pages: z.array(z.string().min(1)).min(1), features: z.array(z.string()).default([]), languages: z.array(z.string()).min(1).default(["fr"]),
  editorialTone: z.string().default("clair et professionnel"), colors: z.array(z.string()).default([]), fonts: z.array(z.string()).default([]),
  visualReferences: z.array(z.string().url()).default([]), constraints: z.array(z.string()).default([]), allowedPlugins: z.array(z.string()).default([]),
  autonomyLevel: z.enum(["guided", "balanced", "autonomous"]).default("guided")
});
export type SiteBrief = z.infer<typeof SiteBriefSchema>;

export const SiteMapSchema = z.object({ pages: z.array(z.object({ slug: z.string(), title: z.string(), purpose: z.string(), parentSlug: z.string().nullable().default(null) })) });
export const DesignTokensSchema = z.object({ colors: z.record(z.string(), z.string()), typography: z.object({ heading: z.string(), body: z.string() }), spacing: z.record(z.string(), z.string()), radius: z.record(z.string(), z.string()) });
export const ContentPlanSchema = z.object({ pages: z.array(z.object({ slug: z.string(), title: z.string(), sections: z.array(z.object({ heading: z.string(), body: z.string() })) })) });
export const SiteSpecificationSchema = z.object({ summary: z.string(), assumptions: z.array(z.string()), siteMap: SiteMapSchema, designTokens: DesignTokensSchema, contentPlan: ContentPlanSchema, uxPrinciples: z.array(z.string()), acceptanceCriteria: z.array(z.string()) });

export const ImplementationTaskSchema = z.object({ id: z.string(), title: z.string(), description: z.string(), status: z.enum(["pending", "running", "passed", "failed", "blocked"]), dependencies: z.array(z.string()).default([]) });
export const ImplementationPlanSchema = z.object({ summary: z.string(), tasks: z.array(ImplementationTaskSchema), files: z.array(z.string()), commands: z.array(z.string()), risks: z.array(z.string()) });
export const CodeArtifactSchema = z.object({ id: z.string(), name: z.string(), kind: z.enum(["theme", "plugin", "content", "report", "snapshot", "diff", "screenshot", "zip"]), path: z.string(), sha256: z.string(), size: z.number().nonnegative() });
export const TestReportSchema = z.object({ passed: z.boolean(), summary: z.string(), suites: z.array(z.object({ name: z.string(), passed: z.number(), failed: z.number(), durationMs: z.number() })), consoleErrors: z.array(z.string()).default([]), brokenLinks: z.array(z.string()).default([]), accessibilityScore: z.number().min(0).max(100).optional() });
export const ReviewFindingSchema = z.object({ id: z.string(), severity: z.enum(["info", "warning", "error", "critical"]), category: z.string(), message: z.string(), file: z.string().optional(), remediation: z.string() });
export const ReviewDecisionSchema = z.object({ approved: z.boolean(), summary: z.string(), findings: z.array(ReviewFindingSchema), requiresHuman: z.boolean() });
export const ApprovalRequestSchema = z.object({ id: z.string(), kind: z.enum(["plan", "deployment", "rollback", "destructive"]), summary: z.string(), changes: z.array(z.string()), artifactRefs: z.array(artifactRef), expiresAt: z.string().datetime().optional() });
export const DeploymentPlanSchema = z.object({ target: z.enum(["local", "remote-content", "remote-ssh"]), siteId: z.string(), changes: z.array(z.object({ operation: z.string(), resource: z.string(), before: z.unknown().optional(), after: z.unknown() })), rollbackSteps: z.array(z.string()), idempotencyKey: z.string() });
export const DeploymentResultSchema = z.object({ success: z.boolean(), status: z.enum(["succeeded", "failed", "partial", "rolled_back"]), exactResponses: z.array(z.unknown()), deployedArtifactIds: z.array(z.string()), rollbackAvailable: z.boolean(), message: z.string() });

export const AgentEnvelopeSchema = z.object({ humanReadable: z.string().min(1), payload: z.unknown(), artifactRefs: z.array(artifactRef).default([]), replyToMessageId: z.string().nullable() });
export const WordPressCredentialsSchema = z.object({ url: z.string().url(), username: z.string().min(1), applicationPassword: z.string().min(8) });
export const CreateProjectSchema = z.object({ workspaceId: z.string().min(1), wordpressSiteId: z.string().nullable().default(null), brief: SiteBriefSchema });
export const DecisionSchema = z.object({ comment: z.string().max(2000).default("") });
