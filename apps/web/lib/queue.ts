import { createJobQueue, enqueueWorkflowRun, startWorkflowQueue, type JobQueue } from "@wp-agent-studio/job-queue";

const globalForQueue = globalThis as unknown as { workflowQueue: Promise<JobQueue> | undefined };

export function runQueue(): Promise<JobQueue> {
  if (!globalForQueue.workflowQueue) {
    const queue = createJobQueue({
      supervise: false,
      onError: (error) => process.stderr.write(`[job_queue_error] ${error.name}\n`)
    });
    globalForQueue.workflowQueue = startWorkflowQueue(queue).catch((error) => {
      globalForQueue.workflowQueue = undefined;
      throw error;
    });
  }
  return globalForQueue.workflowQueue;
}

export async function enqueueRun(runId: string) {
  return enqueueWorkflowRun(await runQueue(), runId);
}
