import pino from "pino";
import { redactSecrets } from "@wp-agent-studio/security";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "wp-agent-studio" },
  redact: { paths: ["password", "applicationPassword", "apiKey", "token", "authorization", "req.headers.authorization", "req.headers.cookie"], censor: "[REDACTED]" },
  hooks: { logMethod(args, method) { return method.apply(this, args.map(redactSecrets) as Parameters<typeof method>); } }
});
export const childLogger = (context: { correlationId?: string; projectId?: string; runId?: string; agentName?: string; jobId?: string }) => logger.child(context);
