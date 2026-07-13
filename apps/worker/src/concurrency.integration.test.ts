import { describe, expect, it } from "vitest";
import { Queue, Worker } from "bullmq";
import { db } from "@wp-agent-studio/database";
import { acquireProjectLock, renewProjectLock, releaseProjectLock } from "./repository.js";

const integration = process.env.RUN_INTEGRATION === "true";

describe.skipIf(!integration)("Concurrence BullMQ sur un même projet", () => {
  it("un seul job mutateur avance à la fois pour un projet donné, même si deux jobs BullMQ tournent en parallèle", async () => {
    const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
    const connection = { host: redisUrl.hostname, port: Number(redisUrl.port || 6379) };
    const projectId = `integration-concurrency-${Date.now()}`;
    const workspaceId = `${projectId}-ws`;
    await db.workspace.create({ data: { id: workspaceId, name: "int", slug: workspaceId } });
    await db.project.create({ data: { id: projectId, workspaceId, name: "int", slug: projectId, brief: {} } });

    const queueName = `concurrency-check-${projectId}`;
    const queue = new Queue(queueName, { connection });
    const ttlMs = 300;
    // Reproduit la logique de verrouillage d'apps/worker/src/index.ts, avec un traitement
    // deux fois plus long que le TTL initial : sans le heartbeat, le verrou expirerait et
    // le second job pourrait s'exécuter en parallèle sur le même projet.
    const worker = new Worker<{ projectId: string }, { locked: boolean }>(queueName, async (job) => {
      const ownerId = String(job.id);
      const locked = await acquireProjectLock(job.data.projectId, ownerId, ttlMs);
      if (!locked) return { locked: false };
      const heartbeat = setInterval(() => { renewProjectLock(job.data.projectId, ownerId, ttlMs).catch(() => {}); }, ttlMs / 3);
      try {
        await new Promise((r) => setTimeout(r, ttlMs * 2));
        return { locked: true };
      } finally {
        clearInterval(heartbeat);
        await releaseProjectLock(job.data.projectId, ownerId);
      }
    }, { connection, concurrency: 2 });

    try {
      await worker.waitUntilReady();
      await Promise.all([
        queue.add("run", { projectId }, { jobId: `${projectId}-a` }),
        queue.add("run", { projectId }, { jobId: `${projectId}-b` })
      ]);

      const outcomes = await new Promise<Array<{ id: string; locked: boolean }>>((resolvePromise, reject) => {
        const collected: Array<{ id: string; locked: boolean }> = [];
        const timeout = setTimeout(() => reject(new Error("Les jobs de test n'ont pas terminé à temps")), 8000);
        worker.on("completed", (completedJob, result: { locked: boolean }) => {
          collected.push({ id: String(completedJob.id), locked: result.locked });
          if (collected.length === 2) { clearTimeout(timeout); resolvePromise(collected); }
        });
      });

      // Les deux jobs tournaient en parallèle (concurrency:2), mais un seul a pu obtenir
      // le verrou applicatif du projet ; l'autre a dû se replier immédiatement.
      expect(outcomes.filter((o) => o.locked)).toHaveLength(1);
      expect(outcomes.filter((o) => !o.locked)).toHaveLength(1);
      expect(await db.jobLock.findUnique({ where: { projectId } })).toBeNull();
    } finally {
      await worker.close();
      await queue.close();
      await db.project.deleteMany({ where: { id: projectId } });
      await db.workspace.deleteMany({ where: { id: workspaceId } });
    }
  }, 15_000);
});
