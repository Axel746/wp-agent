import { AppError, type WorkflowState } from "@wp-agent-studio/shared";

const allowed: Record<WorkflowState, readonly WorkflowState[]> = {
  INTAKE: ["WORDPRESS_SNAPSHOT", "CANCELLED", "FAILED"], WORDPRESS_SNAPSHOT: ["SPECIFICATION_BY_CLAUDE", "CANCELLED", "FAILED"],
  SPECIFICATION_BY_CLAUDE: ["TECHNICAL_PLAN_BY_CODEX", "CANCELLED", "FAILED"], TECHNICAL_PLAN_BY_CODEX: ["PLAN_REVIEW_BY_CLAUDE", "CANCELLED", "FAILED"],
  PLAN_REVIEW_BY_CLAUDE: ["WAITING_FOR_PLAN_APPROVAL", "TECHNICAL_PLAN_BY_CODEX", "CANCELLED", "FAILED"], WAITING_FOR_PLAN_APPROVAL: ["IMPLEMENTATION_BY_CODEX", "CANCELLED", "FAILED"],
  IMPLEMENTATION_BY_CODEX: ["AUTOMATED_TESTS", "CANCELLED", "FAILED"], AUTOMATED_TESTS: ["REVIEW_BY_CLAUDE", "FIXES_BY_CODEX", "CANCELLED", "FAILED"],
  REVIEW_BY_CLAUDE: ["FIXES_BY_CODEX", "WAITING_FOR_DEPLOYMENT_APPROVAL", "CANCELLED", "FAILED"], FIXES_BY_CODEX: ["AUTOMATED_TESTS", "WAITING_FOR_DEPLOYMENT_APPROVAL", "CANCELLED", "FAILED"],
  WAITING_FOR_DEPLOYMENT_APPROVAL: ["STAGING_DEPLOYMENT", "CANCELLED", "FAILED"], STAGING_DEPLOYMENT: ["STAGING_VALIDATION", "CANCELLED", "FAILED"],
  STAGING_VALIDATION: ["PRODUCTION_DEPLOYMENT", "COMPLETED", "FIXES_BY_CODEX", "CANCELLED", "FAILED"], PRODUCTION_DEPLOYMENT: ["COMPLETED", "FAILED"],
  COMPLETED: [], FAILED: [], CANCELLED: []
};
const waitingStates = new Set<WorkflowState>(["WAITING_FOR_PLAN_APPROVAL", "WAITING_FOR_DEPLOYMENT_APPROVAL"]);
const terminalStates = new Set<WorkflowState>(["COMPLETED", "FAILED", "CANCELLED"]);
export const isWaitingState = (state: WorkflowState) => waitingStates.has(state);
export const isTerminalState = (state: WorkflowState) => terminalStates.has(state);
export const canTransition = (from: WorkflowState, to: WorkflowState) => from === to || allowed[from].includes(to);

export function assertTransition(input: { from: WorkflowState; to: WorkflowState; approved?: boolean; destructive?: boolean; actor: "user" | "system" | "claude" | "codex" }): void {
  if (input.from === input.to) return;
  if (!allowed[input.from].includes(input.to)) throw new AppError("INVALID_TRANSITION", `Transition interdite: ${input.from} → ${input.to}`, 409);
  if (input.from === "WAITING_FOR_PLAN_APPROVAL" && input.to === "IMPLEMENTATION_BY_CODEX" && !(input.approved && input.actor === "user")) throw new AppError("HUMAN_APPROVAL_REQUIRED", "Le plan doit être approuvé par un humain", 409);
  if (input.from === "WAITING_FOR_DEPLOYMENT_APPROVAL" && input.to === "STAGING_DEPLOYMENT" && !(input.approved && input.actor === "user")) throw new AppError("HUMAN_APPROVAL_REQUIRED", "Le déploiement doit être approuvé par un humain", 409);
  if (input.destructive && input.actor !== "user") throw new AppError("MODEL_DESTRUCTIVE_ACTION_FORBIDDEN", "Une opération destructive ne peut être lancée que par un humain", 403);
}

export function automaticNextState(state: WorkflowState, input: { reviewApproved?: boolean; testsPassed?: boolean; target?: "local" | "remote" } = {}): WorkflowState | null {
  const next: Partial<Record<WorkflowState, WorkflowState>> = { INTAKE: "WORDPRESS_SNAPSHOT", WORDPRESS_SNAPSHOT: "SPECIFICATION_BY_CLAUDE", SPECIFICATION_BY_CLAUDE: "TECHNICAL_PLAN_BY_CODEX", TECHNICAL_PLAN_BY_CODEX: "PLAN_REVIEW_BY_CLAUDE", PLAN_REVIEW_BY_CLAUDE: "WAITING_FOR_PLAN_APPROVAL", IMPLEMENTATION_BY_CODEX: "AUTOMATED_TESTS", STAGING_DEPLOYMENT: "STAGING_VALIDATION", PRODUCTION_DEPLOYMENT: "COMPLETED" };
  if (state === "AUTOMATED_TESTS") return input.testsPassed === false ? "FIXES_BY_CODEX" : "REVIEW_BY_CLAUDE";
  if (state === "REVIEW_BY_CLAUDE") return input.reviewApproved === false ? "FIXES_BY_CODEX" : "WAITING_FOR_DEPLOYMENT_APPROVAL";
  if (state === "FIXES_BY_CODEX") return "AUTOMATED_TESTS";
  if (state === "STAGING_VALIDATION") return input.target === "remote" ? "PRODUCTION_DEPLOYMENT" : "COMPLETED";
  return next[state] ?? null;
}
