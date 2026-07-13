import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { AppError } from "@wp-agent-studio/shared";

export class LocalArtifactStorage {
  private readonly root: string;
  constructor(root = process.env.ARTIFACTS_DIR ?? "./artifacts") { this.root = resolve(root); }
  private assertInside(path: string) { const rel = relative(this.root, resolve(path)); if (rel.startsWith("..") || isAbsolute(rel)) throw new AppError("ARTIFACT_PATH_FORBIDDEN", "Chemin d’artefact hors du stockage autorisé", 403); }
  async store(projectId: string, sourcePath: string, preferredName = basename(sourcePath)) { const id = randomUUID(); const destination = join(this.root, projectId, id, basename(preferredName)); this.assertInside(destination); await mkdir(resolve(destination, ".."), { recursive: true }); await copyFile(sourcePath, destination); const bytes = await readFile(destination); return { id, name: basename(preferredName), storagePath: destination, sha256: createHash("sha256").update(bytes).digest("hex"), size: (await stat(destination)).size }; }
  resolveForRead(storagePath: string) { this.assertInside(storagePath); return resolve(storagePath); }
}
