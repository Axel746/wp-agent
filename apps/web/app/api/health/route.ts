import { NextResponse } from "next/server";
import { db } from "@wp-agent-studio/database";
import { validateRuntimeConfiguration } from "@wp-agent-studio/security";
import { runQueue } from "../../../lib/queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckStatus = { status: "ok" | "error"; durationMs: number };

async function timedCheck(check: () => Promise<unknown>, timeoutMs = 3_000): Promise<CheckStatus> {
  const startedAt = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      check(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("health check timeout")), timeoutMs); })
    ]);
    return { status: "ok", durationMs: Date.now() - startedAt };
  } catch {
    return { status: "error", durationMs: Date.now() - startedAt };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET() {
  const configuration = validateRuntimeConfiguration(process.env, { service: "web" });
  const [database, redis] = await Promise.all([
    timedCheck(async () => { await db.$queryRaw`SELECT 1`; }),
    timedCheck(async () => { await runQueue().waitUntilReady(); })
  ]);
  const configurationStatus = configuration.issues.length === 0 ? "ok" : "error";
  const ready = configurationStatus === "ok" && database.status === "ok" && redis.status === "ok";

  return NextResponse.json({
    status: ready ? "ok" : "unavailable",
    service: "web",
    checks: { configuration: { status: configurationStatus }, database, redis },
    warnings: configuration.warnings.length,
    timestamp: new Date().toISOString()
  }, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" }
  });
}
