import "./env.js";
import { createProviders } from "@wp-agent-studio/agent-providers";
import {
  WORKFLOW_QUEUE_NAME,
  createJobQueue,
  startWorkflowQueue,
  workflowWorkerOptions,
  type WorkflowJobPayload
} from "@wp-agent-studio/job-queue";
import { childLogger } from "@wp-agent-studio/observability";
import { WorkflowEngine } from "@wp-agent-studio/orchestrator";
import { PrismaWorkflowRepository, acquireProjectLock, renewProjectLock, releaseProjectLock } from "./repository.js";

const rootLog = childLogger({});
const repository = new PrismaWorkflowRepository();
const engine = new WorkflowEngine(repository, createProviders());
const PROJECT_LOCK_TTL_MS = 60_000;

const queue = createJobQueue({
  supervise: true,
  onError: (error) => rootLog.error({ error: error.message }, "job_queue_error"),
  onWarning: (warning) => rootLog.warn({ warning }, "job_queue_warning")
});

try {
  await startWorkflowQueue(queue);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  rootLog.fatal({ error: message }, "job_queue_start_failed");
  throw new Error(`Le démarrage de la file PostgreSQL a échoué : ${message}`, { cause: error });
}

await queue.work<WorkflowJobPayload, { state: string }, typeof workflowWorkerOptions>(WORKFLOW_QUEUE_NAME, workflowWorkerOptions, async ([job]) => {
  if (!job) throw new Error("pg-boss a livré un lot vide");
  const run = await repository.getRun(job.data.runId);
  const log = childLogger({ jobId: job.id, projectId: run.projectId, runId: run.id });
  const locked = await acquireProjectLock(run.projectId, job.id, PROJECT_LOCK_TTL_MS);
  if (!locked) throw new Error("Un autre travail mutateur est actif pour ce projet");

  const started = Date.now();
  const heartbeat = setInterval(() => {
    renewProjectLock(run.projectId, job.id, PROJECT_LOCK_TTL_MS).catch((error) => {
      log.error({ error: error instanceof Error ? error.message : String(error) }, "project_lock_renew_failed");
    });
  }, PROJECT_LOCK_TTL_MS / 3);

  try {
    log.info({ state: run.state, attempt: job.retryCount + 1 }, "workflow_started");
    const result = await engine.advance(run.id);
    log.info({ state: result.state, durationMs: Date.now() - started }, "workflow_finished");
    return { state: result.state };
  } catch (error) {
    log.error({ error: error instanceof Error ? error.message : String(error), attempt: job.retryCount + 1 }, "workflow_failed");
    throw error;
  } finally {
    clearInterval(heartbeat);
    await releaseProjectLock(run.projectId, job.id);
  }
});

rootLog.info({ queue: WORKFLOW_QUEUE_NAME, backend: "postgresql", mode: process.env.AGENT_MODE ?? "mock" }, "worker_ready");

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  rootLog.info({ signal }, "worker_shutdown_started");
  await queue.stop({ graceful: true, close: true, timeout: 30_000 });
  rootLog.info({}, "worker_shutdown_complete");
}

process.on("SIGINT", () => { shutdown("SIGINT").catch((error) => rootLog.error({ error }, "worker_shutdown_failed")); });
process.on("SIGTERM", () => { shutdown("SIGTERM").catch((error) => rootLog.error({ error }, "worker_shutdown_failed")); });
