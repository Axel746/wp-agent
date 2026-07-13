import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkThemeStructure, isBlockMarkupBalanced } from "./theme-checks.js";

describe("isBlockMarkupBalanced", () => {
  it("accepte des blocs auto-fermants et des paires bien imbriquées", () => {
    expect(isBlockMarkupBalanced(`<!-- wp:group --><!-- wp:site-title /--><!-- /wp:group -->`)).toBe(true);
  });
  it("refuse un bloc ouvert jamais refermé", () => {
    expect(isBlockMarkupBalanced(`<!-- wp:group --><p>contenu</p>`)).toBe(false);
  });
  it("refuse un imbrication incohérente", () => {
    expect(isBlockMarkupBalanced(`<!-- wp:group --><!-- wp:paragraph --><!-- /wp:group --><!-- /wp:paragraph -->`)).toBe(false);
  });
});

describe("checkThemeStructure", () => {
  const directories: string[] = [];
  afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

  async function writeValidTheme(themeDirectory: string) {
    await mkdir(join(themeDirectory, "templates"), { recursive: true });
    await mkdir(join(themeDirectory, "parts"), { recursive: true });
    await writeFile(join(themeDirectory, "theme.json"), JSON.stringify({ settings: {}, styles: {} }));
    await writeFile(join(themeDirectory, "functions.php"), "<?php\nif ( ! defined( 'ABSPATH' ) ) { exit; }\n");
    for (const file of ["templates/index.html", "templates/page.html", "templates/single.html", "parts/header.html", "parts/footer.html"]) {
      await writeFile(join(themeDirectory, file), `<!-- wp:group --><!-- wp:site-title /--><!-- /wp:group -->`);
    }
  }

  async function makeArtifact(zipContent: string) {
    const directory = await mkdtemp(join(tmpdir(), "wp-agent-theme-test-"));
    directories.push(directory);
    const storagePath = join(directory, "theme.zip");
    await writeFile(storagePath, zipContent);
    return { storagePath, sha256: createHash("sha256").update(zipContent).digest("hex"), directory };
  }

  it("valide un thème correctement généré", async () => {
    const themeDirectory = await mkdtemp(join(tmpdir(), "wp-agent-theme-dir-"));
    directories.push(themeDirectory);
    await writeValidTheme(themeDirectory);
    const artifact = await makeArtifact("contenu-zip-reel");
    const checks = await checkThemeStructure(themeDirectory, artifact);
    expect(checks.every((check) => check.ok)).toBe(true);
  });

  it("détecte une archive corrompue (empreinte différente du contenu réel)", async () => {
    const themeDirectory = await mkdtemp(join(tmpdir(), "wp-agent-theme-dir-"));
    directories.push(themeDirectory);
    await writeValidTheme(themeDirectory);
    const artifact = await makeArtifact("contenu-zip-reel");
    const tampered = { ...artifact, sha256: "0".repeat(64) };
    const checks = await checkThemeStructure(themeDirectory, tampered);
    expect(checks.find((check) => check.name === "archive-integrity")?.ok).toBe(false);
  });

  it("détecte un theme.json invalide", async () => {
    const themeDirectory = await mkdtemp(join(tmpdir(), "wp-agent-theme-dir-"));
    directories.push(themeDirectory);
    await writeValidTheme(themeDirectory);
    await writeFile(join(themeDirectory, "theme.json"), "{ invalide");
    const artifact = await makeArtifact("contenu-zip-reel");
    const checks = await checkThemeStructure(themeDirectory, artifact);
    expect(checks.find((check) => check.name === "theme-json")?.ok).toBe(false);
  });

  it("détecte un gabarit avec des commentaires de bloc mal équilibrés", async () => {
    const themeDirectory = await mkdtemp(join(tmpdir(), "wp-agent-theme-dir-"));
    directories.push(themeDirectory);
    await writeValidTheme(themeDirectory);
    await writeFile(join(themeDirectory, "templates/index.html"), `<!-- wp:group --><p>cassé</p>`);
    const artifact = await makeArtifact("contenu-zip-reel");
    const checks = await checkThemeStructure(themeDirectory, artifact);
    expect(checks.find((check) => check.name === "templates/index.html")?.ok).toBe(false);
  });
});
