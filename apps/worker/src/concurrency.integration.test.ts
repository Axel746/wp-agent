import { describe, expect, it } from "vitest";
import { db } from "@wp-agent-studio/database";
import { createJobQueue } from "@wp-agent-studio/job-queue";
import { acquireProjectLock, renewProjectLock, releaseProjectLock } from "./repository.js";

const integration = process.env.RUN_INTEGRATION === "true";

describe.skipIf(!integration)("Concurrence pg-boss sur un même projet", () => {
  it("un seul job mutateur avance à la fois même si deux jobs PostgreSQL tournent en parallèle", async () => {
    const projectId = `integration-concurrency-${Date.now()}`;
    const workspaceId = `${projectId}-ws`;
    await db.workspace.create({ data: { id: workspaceId, name: "int", slug: workspaceId } });
    await db.project.create({ data: { id: projectId, workspaceId, name: "int", slug: projectId, brief: {} } });

    const queueName = `concurrency-${Date.now()}`;
    const boss = createJobQueue({ onError: () => {} });
    const ttlMs = 300;
    const outcomes: Array<{ id: string; locked: boolean }> = [];
    let resolveOutcomes: ((value: Array<{ id: string; locked: boolean }>) => void) | undefined;
    const completed = new Promise<Array<{ id: string; locked: boolean }>>((resolve) => { resolveOutcomes = resolve; });

    try {
      await boss.start();
      await boss.createQueue(queueName, { policy: "standard", expireInSeconds: 30, retryLimit: 0, deleteAfterSeconds: 60 });
      await Promise.all([
        boss.send(queueName, { projectId }),
        boss.send(queueName, { projectId })
      ]);

      await boss.work<{ projectId: string }>(queueName, { localConcurrency: 2, batchSize: 1 }, async ([job]) => {
        if (!job) throw new Error("Lot pg-boss vide");
        const locked = await acquireProjectLock(job.data.projectId, job.id, ttlMs);
        if (!locked) {
          outcomes.push({ id: job.id, locked: false });
          if (outcomes.length === 2) resolveOutcomes?.(outcomes);
          return { locked: false };
        }
        const heartbeat = setInterval(() => {
          renewProjectLock(job.data.projectId, job.id, ttlMs).catch(() => {});
        }, ttlMs / 3);
        try {
          await new Promise((resolve) => setTimeout(resolve, ttlMs * 2));
          outcomes.push({ id: job.id, locked: true });
          if (outcomes.length === 2) resolveOutcomes?.(outcomes);
          return { locked: true };
        } finally {
          clearInterval(heartbeat);
          await releaseProjectLock(job.data.projectId, job.id);
        }
      });

      const result = await Promise.race([
        completed,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Les jobs de test n’ont pas terminé à temps")), 8_000))
      ]);
      expect(result.filter((outcome) => outcome.locked)).toHaveLength(1);
      expect(result.filter((outcome) => !outcome.locked)).toHaveLength(1);
      expect(await db.jobLock.findUnique({ where: { projectId } })).toBeNull();
    } finally {
      await boss.offWork(queueName, { wait: true }).catch(() => {});
      await boss.deleteQueue(queueName).catch(() => {});
      await boss.stop({ graceful: true, close: true });
      await db.project.deleteMany({ where: { id: projectId } });
      await db.workspace.deleteMany({ where: { id: workspaceId } });
    }
  }, 15_000);
});
