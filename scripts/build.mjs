import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function resolvePackageBin(packageDirectory, packageName, binName) {
  const require = createRequire(resolve(packageDirectory, "package.json"));
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const bin = typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.[binName];

  if (!bin) throw new Error(`Binaire ${binName} introuvable dans ${packageName}`);
  return resolve(dirname(packageJsonPath), bin);
}

async function run(name, packagePath, packageName, binName, args) {
  const cwd = resolve(projectRoot, packagePath);
  const binary = await resolvePackageBin(cwd, packageName, binName);

  await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [binary, ...args], {
      cwd,
      env: process.env,
      stdio: "inherit",
      windowsHide: true
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${name} a échoué (${signal ?? `code ${code ?? "inconnu"}`})`));
    });
  });
}

await run("prisma-generate", "packages/database", "prisma", "prisma", ["generate"]);
await run("database-build", "packages/database", "typescript", "tsc", ["-p", "tsconfig.build.json"]);
await run("worker-build", "apps/worker", "typescript", "tsc", ["-p", "tsconfig.build.json"]);
await run("web-build", "apps/web", "next", "next", ["build", "--webpack"]);
