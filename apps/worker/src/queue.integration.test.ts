import { Queue } from "bullmq";
import { describe, expect, it } from "vitest";
const integration = process.env.RUN_INTEGRATION === "true";
describe.skipIf(!integration)("Redis et BullMQ", () => { it("persiste un travail idempotent", async () => { const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379"); const queue = new Queue("integration-check", { connection: { host: url.hostname, port: Number(url.port || 6379) } }); const id = `integration-${Date.now()}`; const job = await queue.add("check", { ok: true }, { jobId: id }); expect((await queue.getJob(id))?.id).toBe(job.id); await job.remove(); await queue.close(); }); });
