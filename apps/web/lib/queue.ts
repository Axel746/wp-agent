import { Queue } from "bullmq";
let queue: Queue | undefined;
export function runQueue() { if (!queue) { const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379"); const connection = { host: url.hostname, port: Number(url.port || 6379), ...(url.username ? { username: decodeURIComponent(url.username) } : {}), ...(url.password ? { password: decodeURIComponent(url.password) } : {}), ...(url.protocol === "rediss:" ? { tls: {} } : {}) }; queue = new Queue("agent-runs", { connection, defaultJobOptions: { attempts: 4, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 100, removeOnFail: 200 } }); } return queue; }
export async function enqueueRun(runId: string) { return runQueue().add("advance", { runId }, { jobId: `${runId}:${Date.now()}` }); }
