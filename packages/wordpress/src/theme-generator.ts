import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ZipArchive } from "archiver";
import type { DesignTokensSchema, SiteSpecificationSchema } from "@wp-agent-studio/shared";
import type { z } from "zod";

type Specification = z.infer<typeof SiteSpecificationSchema>;
type Tokens = z.infer<typeof DesignTokensSchema>;
const safeSlug = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "studio-theme";

async function put(path: string, content: string) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, content, "utf8"); }
export async function generateBlockTheme(input: { name: string; specification: Specification; outputDirectory: string }) {
  const slug = safeSlug(input.name); const root = join(input.outputDirectory, slug); const tokens: Tokens = input.specification.designTokens;
  await put(join(root, "style.css"), `/*\nTheme Name: ${input.name}\nText Domain: ${slug}\nVersion: 1.0.0\nRequires at least: 6.6\nRequires PHP: 8.1\nLicense: GPL-2.0-or-later\n*/\n`);
  await put(join(root, "theme.json"), JSON.stringify({ $schema: "https://schemas.wp.org/trunk/theme.json", version: 3, settings: { appearanceTools: true, layout: { contentSize: "720px", wideSize: "1200px" }, color: { palette: Object.entries(tokens.colors).map(([slug, color]) => ({ slug, name: slug[0]?.toUpperCase() + slug.slice(1), color })) }, typography: { fontFamilies: [{ slug: "body", name: tokens.typography.body, fontFamily: tokens.typography.body }, { slug: "heading", name: tokens.typography.heading, fontFamily: tokens.typography.heading }], fluid: true } }, styles: { color: { background: "var(--wp--preset--color--background)", text: "var(--wp--preset--color--text)" }, typography: { fontFamily: "var(--wp--preset--font-family--body)" }, elements: { heading: { typography: { fontFamily: "var(--wp--preset--font-family--heading)" } }, button: { border: { radius: tokens.radius.md ?? "8px" } } } } }, null, 2));
  await put(join(root, "functions.php"), `<?php\n/** WP Agent Studio generated theme. */\nif ( ! defined( 'ABSPATH' ) ) { exit; }\nadd_action( 'after_setup_theme', static function (): void { load_theme_textdomain( '${slug}', get_template_directory() . '/languages' ); add_theme_support( 'wp-block-styles' ); add_theme_support( 'editor-styles' ); } );\n`);
  await put(join(root, "parts", "header.html"), `<!-- wp:group {\"tagName\":\"header\",\"layout\":{\"type\":\"constrained\"},\"style\":{\"spacing\":{\"padding\":{\"top\":\"24px\",\"bottom\":\"24px\"}}}} --><header class=\"wp-block-group\"><!-- wp:site-title /--><!-- wp:navigation {\"overlayMenu\":\"mobile\"} /--></header><!-- /wp:group -->`);
  await put(join(root, "parts", "footer.html"), `<!-- wp:group {\"tagName\":\"footer\",\"layout\":{\"type\":\"constrained\"},\"style\":{\"spacing\":{\"padding\":{\"top\":\"48px\",\"bottom\":\"48px\"}}}} --><footer class=\"wp-block-group\"><!-- wp:site-title {\"level\":0} /--><p>Site conçu avec WP Agent Studio.</p></footer><!-- /wp:group -->`);
  const template = `<!-- wp:template-part {\"slug\":\"header\",\"tagName\":\"header\"} /--><!-- wp:group {\"tagName\":\"main\",\"layout\":{\"type\":\"constrained\"},\"style\":{\"spacing\":{\"padding\":{\"top\":\"48px\",\"bottom\":\"64px\"}}}} --><main class=\"wp-block-group\"><!-- wp:post-title {\"level\":1} /--><!-- wp:post-content /--></main><!-- /wp:group --><!-- wp:template-part {\"slug\":\"footer\",\"tagName\":\"footer\"} /-->`;
  await put(join(root, "templates", "index.html"), template); await put(join(root, "templates", "page.html"), template); await put(join(root, "templates", "single.html"), template);
  await put(join(root, "patterns", "hero.php"), `<?php\n/** Title: Hero principal\n * Slug: ${slug}/hero\n * Categories: featured\n */\n?>\n<!-- wp:cover {\"dimRatio\":50,\"minHeight\":520,\"align\":\"full\"} --><div class=\"wp-block-cover alignfull\" style=\"min-height:520px\"><span aria-hidden=\"true\" class=\"wp-block-cover__background has-background-dim\"></span><div class=\"wp-block-cover__inner-container\"><!-- wp:heading {\"level\":1} --><h1><?php echo esc_html__( '${input.specification.summary.replace(/'/g, "\\'")}', '${slug}' ); ?></h1><!-- /wp:heading --></div></div><!-- /wp:cover -->`);
  await put(join(root, "README.md"), `# ${input.name}\n\nThème de blocs généré par WP Agent Studio. Compatible WordPress 6.6+, PHP 8.1+. Aucun secret ni dépendance externe.\n`);
  const zipPath = join(input.outputDirectory, `${slug}.zip`); await zipDirectory(root, zipPath, slug); const bytes = await readFile(zipPath); return { slug, directory: root, zipPath, sha256: createHash("sha256").update(bytes).digest("hex"), size: (await stat(zipPath)).size };
}

export async function zipDirectory(directory: string, destination: string, rootName: string): Promise<void> {
  await mkdir(dirname(destination), { recursive: true });
  await new Promise<void>((resolve, reject) => { const output = createWriteStream(destination); const archive = new ZipArchive({ zlib: { level: 9 } }); output.on("close", resolve); output.on("error", reject); archive.on("error", reject); archive.pipe(output); archive.directory(directory, rootName); void archive.finalize(); });
}
