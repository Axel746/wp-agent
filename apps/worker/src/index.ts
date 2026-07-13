import "./env.js";
import { Worker } from "bullmq";
import { createProviders } from "@wp-agent-studio/agent-providers";
import { childLogger } from "@wp-agent-studio/observability";
import { WorkflowEngine } from "@wp-agent-studio/orchestrator";
import { PrismaWorkflowRepository, acquireProjectLock, renewProjectLock, releaseProjectLock } from "./repository.js";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const connection = { host: redisUrl.hostname, port: Number(redisUrl.port || 6379), ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}), ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}), ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}) }; const repository = new PrismaWorkflowRepository(); const engine = new WorkflowEngine(repository, createProviders());
const PROJECT_LOCK_TTL_MS = 60_000;
const worker = new Worker<{ runId: string }>("agent-runs", async (job) => { const run = await repository.getRun(job.data.runId); const log = childLogger({ ...(job.id ? { jobId: job.id } : {}), projectId: run.projectId, runId: run.id }); const locked = await acquireProjectLock(run.projectId, String(job.id), PROJECT_LOCK_TTL_MS); if (!locked) throw new Error("Un autre travail mutateur est actif pour ce projet"); const started = Date.now(); const heartbeat = setInterval(() => { renewProjectLock(run.projectId, String(job.id), PROJECT_LOCK_TTL_MS).catch((error) => log.error({ error: error instanceof Error ? error.message : String(error) }, "project_lock_renew_failed")); }, PROJECT_LOCK_TTL_MS / 3); try { log.info({ state: run.state, attempt: job.attemptsMade + 1 }, "workflow_started"); const result = await engine.advance(run.id); log.info({ state: result.state, durationMs: Date.now() - started }, "workflow_finished"); return { state: result.state }; } finally { clearInterval(heartbeat); await releaseProjectLock(run.projectId, String(job.id)); } }, { connection, concurrency: 2, lockDuration: 120_000 });
worker.on("failed", (job, error) => childLogger({ ...(job?.id ? { jobId: job.id } : {}), ...(job?.data.runId ? { runId: job.data.runId } : {}) }).error({ error: error.message, attempt: job?.attemptsMade }, "workflow_failed"));
worker.on("error", (error) => childLogger({}).error({ error: error.message }, "worker_error"));
childLogger({}).info({ queue: "agent-runs", mode: process.env.AGENT_MODE ?? "mock" }, "worker_ready");
async function shutdown() { await worker.close(); process.exit(0); }
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
