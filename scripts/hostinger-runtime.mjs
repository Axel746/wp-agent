import { spawn } from "node:child_process";
import console from "node:console";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const children = new Map();
let stopping = false;

function startProcess(name, args) {
  const child = spawn(pnpm, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true
  });
  children.set(name, child);
  return child;
}

function runOnce(name, args) {
  return new Promise((resolvePromise, reject) => {
    const child = startProcess(name, args);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      children.delete(name);
      if (code === 0) resolvePromise();
      else reject(new Error(`${name} a échoué (${signal ?? `code ${code ?? "inconnu"}`})`));
    });
  });
}

async function stopChildren(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children.values()) {
    if (!child.killed) child.kill(signal);
  }
  await Promise.allSettled(Array.from(children.values(), (child) => new Promise((resolvePromise) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolvePromise();
    child.once("exit", resolvePromise);
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
      resolvePromise();
    }, 10_000).unref();
  })));
}

async function main() {
  await runOnce("database-migration", ["db:migrate"]);
  await runOnce("database-seed", ["db:seed"]);

  const web = startProcess("web", ["--filter", "@wp-agent-studio/web", "start"]);
  const worker = startProcess("worker", ["--filter", "@wp-agent-studio/worker", "start"]);

  const firstExit = await Promise.race([
    new Promise((resolvePromise) => web.once("exit", (code, signal) => resolvePromise({ name: "web", code, signal }))),
    new Promise((resolvePromise) => worker.once("exit", (code, signal) => resolvePromise({ name: "worker", code, signal })))
  ]);

  if (!stopping) {
    const reason = firstExit.signal ?? `code ${firstExit.code ?? "inconnu"}`;
    console.error(`[hostinger_runtime] ${firstExit.name} s’est arrêté (${reason})`);
    await stopChildren();
    process.exitCode = firstExit.code === 0 ? 1 : (firstExit.code ?? 1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopChildren(signal).then(() => {
      process.exitCode = 0;
    }).catch((error) => {
      console.error("[hostinger_runtime] arrêt incomplet", error);
      process.exitCode = 1;
    });
  });
}

main().catch(async (error) => {
  console.error("[hostinger_runtime] démarrage impossible", error);
  await stopChildren();
  process.exitCode = 1;
});
