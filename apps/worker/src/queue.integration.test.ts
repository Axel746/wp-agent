import { describe, expect, it } from "vitest";
import { createJobQueue } from "@wp-agent-studio/job-queue";

const integration = process.env.RUN_INTEGRATION === "true";

describe.skipIf(!integration)("PostgreSQL et pg-boss", () => {
  it("persiste un travail idempotent par clé de run", async () => {
    const boss = createJobQueue({ onError: () => {} });
    const queueName = `integration-${Date.now()}`;
    try {
      await boss.start();
      await boss.createQueue(queueName, {
        policy: "exclusive",
        expireInSeconds: 30,
        retryLimit: 0,
        deleteAfterSeconds: 60
      });
      const first = await boss.send(queueName, { ok: true }, { singletonKey: "run-1" });
      const duplicate = await boss.send(queueName, { ok: true }, { singletonKey: "run-1" });
      expect(first).toEqual(expect.any(String));
      expect(duplicate).toBeNull();
      expect(await boss.findJobs(queueName, { id: first! })).toHaveLength(1);
    } finally {
      await boss.deleteQueue(queueName).catch(() => {});
      await boss.stop({ graceful: true, close: true });
    }
  });
});
