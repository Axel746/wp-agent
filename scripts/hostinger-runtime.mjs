import { spawn } from "node:child_process";
import console from "node:console";
import { chmod, readdir, readFile } from "node:fs/promises";
import { createServer, request as createProxyRequest } from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const children = new Map();
let stopping = false;
let proxyServer;

async function resolvePackageBin(packageDirectory, packageName, binName) {
  const require = createRequire(resolve(packageDirectory, "package.json"));
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const bin = typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.[binName];

  if (!bin) throw new Error(`Binaire ${binName} introuvable dans ${packageName}`);
  return resolve(dirname(packageJsonPath), bin);
}

async function startProcess(name, packagePath, packageName, binName, args, stdio = "inherit") {
  const cwd = resolve(projectRoot, packagePath);
  const binary = await resolvePackageBin(cwd, packageName, binName);
  const child = spawn(process.execPath, [binary, ...args], {
    cwd,
    env: process.env,
    stdio,
    windowsHide: true
  });
  children.set(name, child);
  return child;
}

function runOnce(name, packagePath, packageName, binName, args) {
  return new Promise((resolvePromise, reject) => {
    startProcess(name, packagePath, packageName, binName, args, ["ignore", "pipe", "pipe"]).then((child) => {
      let output = "";
      const forward = (stream, destination) => stream?.on("data", (chunk) => {
        const text = chunk.toString();
        output = `${output}${text}`.slice(-4_000);
        destination.write(text);
      });

      forward(child.stdout, process.stdout);
      forward(child.stderr, process.stderr);
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        children.delete(name);
        if (code === 0) resolvePromise();
        else {
          const details = output.trim();
          reject(new Error(`${name} a échoué (${signal ?? `code ${code ?? "inconnu"}`})${details ? `\n${details}` : ""}`));
        }
      });
    }).catch(reject);
  });
}

function waitForExit(name, child) {
  return new Promise((resolvePromise) => {
    child.once("exit", (code, signal) => resolvePromise({ name, code, signal }));
  });
}

async function ensurePrismaSchemaEngineExecutable() {
  const databaseDirectory = resolve(projectRoot, "packages/database");
  const databaseRequire = createRequire(resolve(databaseDirectory, "package.json"));
  const prismaPackageJson = databaseRequire.resolve("prisma/package.json");
  const prismaRequire = createRequire(prismaPackageJson);
  const enginesDirectory = dirname(prismaRequire.resolve("@prisma/engines/package.json"));
  const engineNames = (await readdir(enginesDirectory)).filter((name) => name.startsWith("schema-engine-"));

  await Promise.all(engineNames.map((name) => chmod(resolve(enginesDirectory, name), 0o755)));
}

function startProxyServer(port, upstreamPort) {
  return new Promise((resolvePromise, reject) => {
    const server = createServer((request, response) => {
      const upstream = createProxyRequest({
        hostname: "127.0.0.1",
        port: upstreamPort,
        path: request.url,
        method: request.method,
        headers: request.headers
      }, (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      });

      upstream.once("error", () => {
        if (!response.headersSent) response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
        response.end("Application en cours de démarrage");
      });
      request.pipe(upstream);
    });

    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => resolvePromise(server));
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
  if (proxyServer) {
    proxyServer.closeAllConnections?.();
    await new Promise((resolvePromise) => proxyServer.close(resolvePromise));
    proxyServer = undefined;
  }
}

async function main() {
  // Hostinger détecte uniquement listen() dans le processus d'entrée. Ce proxy
  // ouvre immédiatement le port public et relaie ensuite vers le serveur Next.
  const publicPort = Number.parseInt(process.env.PORT ?? "3000", 10);
  const upstreamPort = publicPort === 3001 ? 3002 : 3001;
  proxyServer = await startProxyServer(publicPort, upstreamPort);

  const web = await startProcess("web", "apps/web", "next", "next", [
    "start", "--hostname", "127.0.0.1", "--port", String(upstreamPort)
  ]);
  const webExit = waitForExit("web", web);

  await ensurePrismaSchemaEngineExecutable();
  await runOnce("database-migration", "packages/database", "prisma", "prisma", ["migrate", "deploy"]);
  await runOnce("database-seed", "packages/database", "tsx", "tsx", ["prisma/seed.ts"]);

  const worker = await startProcess("worker", "apps/worker", "tsx", "tsx", ["src/index.ts"]);
  const workerExit = waitForExit("worker", worker);

  const firstExit = await Promise.race([
    webExit,
    workerExit
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
