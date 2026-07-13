import { db } from "@wp-agent-studio/database";
import { PgBoss, fromPrisma, type Queue, type WorkOptions } from "pg-boss";

export const WORKFLOW_QUEUE_NAME = "agent-runs";
export type JobQueue = PgBoss;

export type WorkflowJobPayload = {
  runId: string;
};

export const workflowQueueOptions = {
  policy: "exclusive",
  expireInSeconds: 3_600,
  heartbeatSeconds: 60,
  retryLimit: 3,
  retryDelay: 1,
  retryBackoff: true,
  retryDelayMax: 60,
  deleteAfterSeconds: 604_800,
  retentionSeconds: 1_209_600,
  warningQueueSize: 100
} as const satisfies Omit<Queue, "name"> & { policy: "exclusive" };

export const workflowWorkerOptions = {
  includeMetadata: true,
  batchSize: 1,
  localConcurrency: 2,
  pollingIntervalSeconds: 2,
  heartbeatRefreshSeconds: 20
} as const satisfies WorkOptions;

export function resolveQueueSchema(value = process.env.PG_BOSS_SCHEMA ?? "pgboss") {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error("PG_BOSS_SCHEMA doit être un identifiant PostgreSQL sûr");
  }
  return value;
}

export function createJobQueue(options: {
  onError: (error: Error) => void;
  onWarning?: (warning: unknown) => void;
  supervise?: boolean;
}) {
  const boss = new PgBoss({
    db: fromPrisma(db),
    schema: resolveQueueSchema(),
    supervise: options.supervise ?? true,
    schedule: false,
    useListenNotify: false
  });
  boss.on("error", options.onError);
  if (options.onWarning) boss.on("warning", options.onWarning);
  return boss;
}

export async function startWorkflowQueue(boss: PgBoss) {
  await boss.start();
  await boss.createQueue(WORKFLOW_QUEUE_NAME, workflowQueueOptions);
  return boss;
}

export async function enqueueWorkflowRun(queue: Pick<PgBoss, "send">, runId: string) {
  if (!runId.trim()) throw new Error("runId est requis pour enfiler un workflow");
  const jobId = await queue.send(WORKFLOW_QUEUE_NAME, { runId } satisfies WorkflowJobPayload, {
    singletonKey: runId
  });
  return { jobId, enqueued: jobId !== null };
}
