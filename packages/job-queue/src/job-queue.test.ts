import { describe, expect, it, vi } from "vitest";
import type { PgBoss } from "pg-boss";
import { WORKFLOW_QUEUE_NAME, enqueueWorkflowRun, resolveQueueSchema, workflowQueueOptions, workflowWorkerOptions } from "./index.js";

describe("file PostgreSQL", () => {
  it("contraint une seule exécution active ou en attente par run", () => {
    expect(workflowQueueOptions.policy).toBe("exclusive");
    expect(workflowQueueOptions.retryLimit).toBe(3);
    expect(workflowQueueOptions.heartbeatSeconds).toBe(60);
    expect(workflowWorkerOptions.localConcurrency).toBe(2);
  });

  it("refuse un nom de schéma non sûr", () => {
    expect(resolveQueueSchema("wpas_jobs")).toBe("wpas_jobs");
    expect(() => resolveQueueSchema("pgboss; DROP SCHEMA public")).toThrow();
  });

  it("utilise le run comme clé d’idempotence", async () => {
    const send = vi.fn().mockResolvedValue("job-1");
    const result = await enqueueWorkflowRun({ send } as unknown as Pick<PgBoss, "send">, "run-1");
    expect(result).toEqual({ jobId: "job-1", enqueued: true });
    expect(send).toHaveBeenCalledWith(WORKFLOW_QUEUE_NAME, { runId: "run-1" }, { singletonKey: "run-1" });
  });
});
