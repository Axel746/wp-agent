import { spawn } from "node:child_process";
import console from "node:console";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = new Map();
let stopping = false;

async function resolvePackageBin(packageDirectory, packageName, binName) {
  const require = createRequire(resolve(packageDirectory, "package.json"));
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const bin = typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.[binName];

  if (!bin) throw new Error(`Binaire ${binName} introuvable dans ${packageName}`);
  return resolve(dirname(packageJsonPath), bin);
}

async function startProcess(name, packagePath, packageName, binName, args) {
  const cwd = resolve(projectRoot, packagePath);
  const binary = await resolvePackageBin(cwd, packageName, binName);
  const child = spawn(process.execPath, [binary, ...args], {
    cwd,
    env: process.env,
    stdio: "inherit",
    windowsHide: true
  });
  children.set(name, child);
  return child;
}

function runOnce(name, packagePath, packageName, binName, args) {
  return new Promise((resolvePromise, reject) => {
    startProcess(name, packagePath, packageName, binName, args).then((child) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        children.delete(name);
        if (code === 0) resolvePromise();
        else reject(new Error(`${name} a échoué (${signal ?? `code ${code ?? "inconnu"}`})`));
      });
    }).catch(reject);
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
  await runOnce("database-migration", "packages/database", "prisma", "prisma", ["migrate", "deploy"]);
  await runOnce("database-seed", "packages/database", "tsx", "tsx", ["prisma/seed.ts"]);

  const [web, worker] = await Promise.all([
    startProcess("web", "apps/web", "next", "next", ["start"]),
    startProcess("worker", "apps/worker", "tsx", "tsx", ["src/index.ts"])
  ]);

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
