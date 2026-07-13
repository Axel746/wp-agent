import { describe, expect, it } from "vitest";
import { db } from "@wp-agent-studio/database";
import { acquireProjectLock, renewProjectLock, releaseProjectLock } from "./repository.js";

const integration = process.env.RUN_INTEGRATION === "true";

describe.skipIf(!integration)("JobLock heartbeat", () => {
  it("renouvelle l'échéance sans laisser le verrou expirer sous une charge longue", async () => {
    const projectId = `integration-lock-${Date.now()}`;
    const ownerId = "job-1";
    await db.workspace.create({ data: { id: `${projectId}-ws`, name: "int", slug: `${projectId}-ws` } });
    await db.project.create({ data: { id: projectId, workspaceId: `${projectId}-ws`, name: "int", slug: projectId, brief: {} } });
    try {
      expect(await acquireProjectLock(projectId, ownerId, 200)).toBe(true);
      // Un second propriétaire ne doit pas pouvoir acquérir le verrou tant qu'il est actif.
      expect(await acquireProjectLock(projectId, "job-2", 200)).toBe(false);
      // Simule un traitement plus long que le TTL initial : le heartbeat doit prolonger le verrou.
      await new Promise((r) => setTimeout(r, 250));
      expect(await renewProjectLock(projectId, ownerId, 200)).toBe(true);
      const lock = await db.jobLock.findUnique({ where: { projectId } });
      expect(lock?.expiresAt.getTime()).toBeGreaterThan(Date.now());
      // Un concurrent reste bloqué puisque le verrou vient d'être renouvelé.
      expect(await acquireProjectLock(projectId, "job-2", 200)).toBe(false);
    } finally {
      await releaseProjectLock(projectId, ownerId);
      await db.project.deleteMany({ where: { id: projectId } });
      await db.workspace.deleteMany({ where: { id: `${projectId}-ws` } });
    }
  });
});
