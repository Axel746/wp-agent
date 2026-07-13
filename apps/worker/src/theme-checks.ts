import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ThemeCheck = { name: string; ok: boolean; detail?: string };

const blockCommentPattern = /<!--\s*(\/?)wp:([a-z0-9-]+(?:\/[a-z0-9-]+)?)(?:\s+\{[\s\S]*?\})?\s*(\/?)-->/g;

// Une grammaire de blocs valide n'ouvre jamais un commentaire "<!-- wp:x -->" sans le
// refermer par "<!-- /wp:x -->" plus loin (les formes auto-fermantes "/-->" n'ont pas
// besoin de fermeture). Un déséquilibre indique une génération corrompue ou tronquée.
export function isBlockMarkupBalanced(html: string): boolean {
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  blockCommentPattern.lastIndex = 0;
  while ((match = blockCommentPattern.exec(html))) {
    const closing = match[1];
    const name = match[2];
    const selfClosing = match[3];
    if (selfClosing) continue;
    if (closing) { if (stack.pop() !== name) return false; } else { stack.push(name!); }
  }
  return stack.length === 0;
}

export async function checkThemeStructure(themeDirectory: string, artifact: { storagePath: string; sha256: string }): Promise<ThemeCheck[]> {
  const checks: ThemeCheck[] = [];

  try {
    const zipBytes = await readFile(artifact.storagePath);
    const actualSha256 = createHash("sha256").update(zipBytes).digest("hex");
    const ok = actualSha256 === artifact.sha256;
    checks.push({ name: "archive-integrity", ok, ...(ok ? {} : { detail: "L'empreinte SHA-256 du ZIP ne correspond plus au contenu stocké." }) });
  } catch {
    checks.push({ name: "archive-integrity", ok: false, detail: "Le ZIP du thème est introuvable sur le stockage d'artefacts." });
  }

  try {
    const parsed = JSON.parse(await readFile(join(themeDirectory, "theme.json"), "utf8"));
    const ok = Boolean(parsed && typeof parsed === "object" && parsed.settings && parsed.styles);
    checks.push({ name: "theme-json", ok, ...(ok ? {} : { detail: "theme.json ne contient pas les clés settings/styles attendues." }) });
  } catch {
    checks.push({ name: "theme-json", ok: false, detail: "theme.json est absent ou n'est pas un JSON valide." });
  }

  try {
    const php = await readFile(join(themeDirectory, "functions.php"), "utf8");
    const ok = php.startsWith("<?php") && php.includes("ABSPATH");
    checks.push({ name: "functions-php", ok, ...(ok ? {} : { detail: "functions.php ne respecte pas la structure attendue (balise PHP ou garde ABSPATH)." }) });
  } catch {
    checks.push({ name: "functions-php", ok: false, detail: "functions.php est absent." });
  }

  for (const relativePath of ["templates/index.html", "templates/page.html", "templates/single.html", "parts/header.html", "parts/footer.html"]) {
    try {
      const html = await readFile(join(themeDirectory, relativePath), "utf8");
      const ok = html.trim().length > 0 && isBlockMarkupBalanced(html);
      checks.push({ name: relativePath, ok, ...(ok ? {} : { detail: `${relativePath} est vide ou contient des commentaires de bloc mal équilibrés.` }) });
    } catch {
      checks.push({ name: relativePath, ok: false, detail: `${relativePath} est absent.` });
    }
  }

  return checks;
}
