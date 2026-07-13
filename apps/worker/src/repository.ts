import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { db } from "@wp-agent-studio/database";
import { AppError, TestReportSchema, WorkflowStateSchema, type WorkflowState } from "@wp-agent-studio/shared";
import { LocalArtifactStorage, type RunData, type TestReport, type WorkflowRepository } from "@wp-agent-studio/orchestrator";
import { decryptSecret } from "@wp-agent-studio/security";
import { LocalDockerWordPressProvider, RestWordPressConnector, snapshotChecksum } from "@wp-agent-studio/wordpress";
import { checkThemeStructure } from "./theme-checks.js";

const json = (value: unknown) => value as any;
export class PrismaWorkflowRepository implements WorkflowRepository {
  private readonly storage = new LocalArtifactStorage();
  async getRun(runId: string): Promise<RunData> {
    const run = await db.agentRun.findUnique({ where: { id: runId }, include: { project: { include: { memory: true } } } });
    if (!run) throw new AppError("RUN_NOT_FOUND", "Run introuvable", 404);
    const workspaceDirectory = resolve(process.env.ARTIFACTS_DIR ?? "./artifacts", "workspaces", run.projectId, run.id); await mkdir(workspaceDirectory, { recursive: true });
    return { id: run.id, projectId: run.projectId, workspaceId: run.project.workspaceId, state: WorkflowStateSchema.parse(run.state), stateVersion: run.stateVersion, isPaused: run.isPaused, cancellationRequested: run.cancellationRequested, turnCount: run.turnCount, fixCycleCount: run.fixCycleCount, maxTurns: run.maxTurns, maxFixCycles: run.maxFixCycles, brief: run.project.brief, ...(run.project.memory?.currentSpec ? { specification: run.project.memory.currentSpec } : {}), ...(run.project.memory?.taskState ? { plan: run.project.memory.taskState } : {}), ...(run.project.memory?.testReport ? { testReport: run.project.memory.testReport } : {}), workspaceDirectory, target: run.project.wordpressSiteId ? "remote" : "local" };
  }
  async transition(runId: string, expectedVersion: number, to: WorkflowState, audit: { action: string; correlationId: string }) {
    const current = await db.agentRun.findUnique({ where: { id: runId }, include: { project: true } }); if (!current) throw new AppError("RUN_NOT_FOUND", "Run introuvable", 404); if (current.state === to) return this.getRun(runId);
    const activeAgent = to.includes("CLAUDE") ? "claude" : to.includes("CODEX") ? "codex" : null; const result = await db.$transaction(async (tx) => { const updated = await tx.agentRun.updateMany({ where: { id: runId, stateVersion: expectedVersion }, data: { state: to, stateVersion: { increment: 1 }, currentAgent: activeAgent, ...(to === "COMPLETED" || to === "FAILED" || to === "CANCELLED" ? { finishedAt: new Date() } : {}) } }); if (updated.count !== 1) throw new AppError("CONCURRENT_TRANSITION", "Le run a été modifié par un autre worker", 409); await tx.auditLog.create({ data: { workspaceId: current.project.workspaceId, projectId: current.projectId, runId, actorType: "system", action: audit.action, resourceType: "AgentRun", resourceId: runId, correlationId: audit.correlationId, metadata: { from: current.state, to } } }); return true; }); void result; return this.getRun(runId);
  }
  async patchRun(runId: string, patch: Partial<RunData>) { const run = await db.agentRun.findUnique({ where: { id: runId }, include: { project: true } }); if (!run) throw new AppError("RUN_NOT_FOUND", "Run introuvable", 404); await db.$transaction(async (tx) => { await tx.agentRun.update({ where: { id: runId }, data: { ...(patch.turnCount === undefined ? {} : { turnCount: patch.turnCount }), ...(patch.fixCycleCount === undefined ? {} : { fixCycleCount: patch.fixCycleCount }), ...(patch.isPaused === undefined ? {} : { isPaused: patch.isPaused }) } }); if (patch.specification !== undefined || patch.plan !== undefined || patch.testReport !== undefined) await tx.projectMemory.upsert({ where: { projectId: run.projectId }, create: { projectId: run.projectId, currentBrief: json(run.project.brief), ...(patch.specification === undefined ? {} : { currentSpec: json(patch.specification) }), ...(patch.plan === undefined ? {} : { taskState: json(patch.plan) }), ...(patch.testReport === undefined ? {} : { testReport: json(patch.testReport) }) }, update: { ...(patch.specification === undefined ? {} : { currentSpec: json(patch.specification) }), ...(patch.plan === undefined ? {} : { taskState: json(patch.plan) }), ...(patch.testReport === undefined ? {} : { testReport: json(patch.testReport) }), version: { increment: 1 } } }); const tasks = (patch.plan as any)?.tasks; if (Array.isArray(tasks)) for (const task of tasks) await tx.task.upsert({ where: { projectId_externalId: { projectId: run.projectId, externalId: task.id } }, update: { title: task.title, description: task.description, dependencies: json(task.dependencies ?? []) }, create: { projectId: run.projectId, runId, externalId: task.id, title: task.title, description: task.description, dependencies: json(task.dependencies ?? []) } }); }); return this.getRun(runId); }
  async addMessage(run: RunData, message: { sender: "claude" | "codex" | "system"; recipient: "claude" | "codex" | "user" | "all"; type: string; content: string; payload: unknown; parentMessageId?: string }) { const created = await db.agentMessage.create({ data: { workspaceId: run.workspaceId, projectId: run.projectId, runId: run.id, sender: message.sender, recipient: message.recipient, type: message.type as any, content: message.content, structuredPayload: json(message.payload), ...(message.parentMessageId ? { parentMessageId: message.parentMessageId } : {}) } }); return created.id; }
  async addUsage(runId: string, agent: "claude" | "codex", usage: any) { await db.agentUsage.create({ data: { runId, agentName: agent, model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, estimatedCostCents: usage.estimatedCostCents, durationMs: usage.durationMs ?? 0 } }); }
  async requestApproval(run: RunData, kind: "PLAN" | "DEPLOYMENT", summary: string, changes: unknown) { const existing = await db.approval.findFirst({ where: { runId: run.id, kind, status: "PENDING" } }); if (!existing) await db.approval.create({ data: { projectId: run.projectId, runId: run.id, kind, summary, changes: json(changes) } }); }
  async saveArtifact(run: RunData, artifact: { kind: string; name: string; path: string; sha256: string; size: number }) { const stored = await this.storage.store(run.projectId, artifact.path, artifact.name); await db.artifact.upsert({ where: { projectId_sha256_name: { projectId: run.projectId, sha256: stored.sha256, name: stored.name } }, update: {}, create: { projectId: run.projectId, runId: run.id, kind: artifact.kind as any, name: stored.name, storagePath: stored.storagePath, mimeType: artifact.kind === "DIFF" ? "text/x-diff" : "application/zip", sha256: stored.sha256, size: BigInt(stored.size) } }); }
  async deployStaging(run: RunData) {
    const project = await db.project.findUnique({ where: { id: run.projectId }, include: { wordpressSite: { include: { secret: true } }, memory: true, artifacts: { where: { kind: "THEME" }, orderBy: { createdAt: "desc" }, take: 1 } } });
    if (!project) throw new AppError("PROJECT_NOT_FOUND", "Projet introuvable", 404);
    const approval = await db.approval.findFirst({ where: { runId: run.id, kind: "DEPLOYMENT", status: "APPROVED" } });
    if (!approval) throw new AppError("HUMAN_APPROVAL_REQUIRED", "Le déploiement n’a pas été approuvé", 409);
    const exactResponses: unknown[] = [];
    if (!project.wordpressSiteId) {
      const theme = project.artifacts[0]; if (!theme) throw new AppError("THEME_ARTIFACT_MISSING", "Aucun ZIP de thème à installer", 409);
      const provider = new LocalDockerWordPressProvider(resolve("docker-compose.yml"), resolve(".")); const started = await provider.start(); await provider.installTheme(theme.storagePath); const spec: any = project.memory?.currentSpec; const pages = (spec?.contentPlan?.pages ?? []).map((page: any) => ({ title: page.title, slug: page.slug, content: page.sections.map((section: any) => `<!-- wp:heading --><h2 class=\"wp-block-heading\">${escapeHtml(section.heading)}</h2><!-- /wp:heading --><!-- wp:paragraph --><p>${escapeHtml(section.body)}</p><!-- /wp:paragraph -->`).join("") })); const imported = await provider.importPages(pages); exactResponses.push({ operation: "local_start", previewUrl: started.previewUrl }, { operation: "theme_install", artifactId: theme.id, sha256: theme.sha256 }, ...imported);
    } else {
      const site = project.wordpressSite; if (!site?.secret) throw new AppError("WORDPRESS_SECRET_MISSING", "Identifiants WordPress révoqués ou manquants", 409);
      const credentials = decryptSecret<{ url: string; username: string; applicationPassword: string }>({ encryptedValue: site.secret.encryptedValue, iv: site.secret.iv, authTag: site.secret.authTag, keyVersion: site.secret.keyVersion });
      const connector = new RestWordPressConnector(credentials, { allowPrivate: site.allowPrivateNetwork, production: process.env.NODE_ENV === "production" }); const spec: any = project.memory?.currentSpec; const pages = (spec?.contentPlan?.pages ?? []).map((page: any) => ({ title: page.title, slug: page.slug, content: page.sections.map((section: any) => `<h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p>`).join(""), status: "draft" as const })); const responses = await connector.applyContentBundle({ pages }, `deploy:${run.id}`); exactResponses.push(...responses);
    }
    await db.deployment.upsert({ where: { projectId_idempotencyKey: { projectId: run.projectId, idempotencyKey: `staging:${run.id}` } }, update: { status: "SUCCEEDED", exactResponses: json(exactResponses), finishedAt: new Date() }, create: { projectId: run.projectId, runId: run.id, wordpressSiteId: project.wordpressSiteId ?? (await ensureLocalSite(run.workspaceId)).id, target: project.wordpressSiteId ? "REMOTE_CONTENT" : "LOCAL", status: "SUCCEEDED", plan: { mode: project.wordpressSiteId ? "remote-content" : "local" }, exactResponses: json(exactResponses), idempotencyKey: `staging:${run.id}`, startedAt: new Date(), finishedAt: new Date() } });
    return { success: true, message: project.wordpressSiteId ? "Les contenus approuvés ont réellement été créés en brouillon sur WordPress ; les réponses exactes sont conservées." : "Le WordPress local a démarré et le thème approuvé a réellement été installé.", exactResponses };
  }
  async captureWordPressSnapshot(run: RunData) { const project = await db.project.findUnique({ where: { id: run.projectId }, include: { wordpressSite: { include: { secret: true } } } }); const site = project?.wordpressSite; if (!site) return null; if (!site.secret) throw new AppError("WORDPRESS_SECRET_MISSING", "Identifiants WordPress absents ou révoqués", 409); const credentials = decryptSecret<{ url: string; username: string; applicationPassword: string }>({ encryptedValue: site.secret.encryptedValue, iv: site.secret.iv, authTag: site.secret.authTag, keyVersion: site.secret.keyVersion }); const connector = new RestWordPressConnector(credentials, { allowPrivate: site.allowPrivateNetwork, production: process.env.NODE_ENV === "production" }); const snapshot = await connector.createSnapshot(); await db.wordPressSnapshot.create({ data: { wordpressSiteId: site.id, payload: json(snapshot), checksum: snapshotChecksum(snapshot) } }); return { checksum: snapshotChecksum(snapshot), capturedAt: snapshot.capturedAt, counts: { pages: snapshot.pages.length, posts: snapshot.posts.length, media: snapshot.media.length, plugins: snapshot.plugins.length, themes: snapshot.themes.length } }; }

  async runAutomatedTests(run: RunData): Promise<TestReport> {
    const started = Date.now();
    const artifact = await db.artifact.findFirst({ where: { projectId: run.projectId, kind: "THEME" }, orderBy: { createdAt: "desc" } });
    if (!artifact) return TestReportSchema.parse({ passed: false, summary: "Aucun thème généré à tester.", suites: [{ name: "theme-structure", passed: 0, failed: 1, durationMs: Date.now() - started }], consoleErrors: [], brokenLinks: [] });
    const slug = artifact.name.replace(/\.zip$/, "");
    const themeDirectory = resolve(run.workspaceDirectory, "build", slug);
    const checks = await checkThemeStructure(themeDirectory, artifact);
    const failed = checks.filter((check) => !check.ok);
    const passed = failed.length === 0;
    return TestReportSchema.parse({
      passed,
      summary: passed ? `Structure du thème validée par ${checks.length} contrôle(s) réel(s) sur les fichiers générés.` : `${failed.length} contrôle(s) réel(s) en échec : ${failed.map((check) => check.detail).join(" ")}`,
      suites: [{ name: "theme-structure", passed: checks.length - failed.length, failed: failed.length, durationMs: Date.now() - started }],
      consoleErrors: [],
      brokenLinks: []
    });
  }

  async validateStaging(run: RunData): Promise<TestReport> {
    const started = Date.now();
    if (run.target !== "local") {
      return TestReportSchema.parse({ passed: true, summary: "Cible distante : les contenus ont été créés en brouillon via l'API REST (réponses exactes déjà enregistrées) ; la validation visuelle automatisée en direct n'est pas exécutée sur du contenu non publié.", suites: [{ name: "staging-validation", passed: 0, failed: 0, durationMs: 0 }], consoleErrors: [], brokenLinks: [] });
    }
    const siteUrl = process.env.WORDPRESS_LOCAL_URL ?? "http://localhost:8080";
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const consoleErrors: string[] = [];
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("pageerror", (error) => consoleErrors.push(error.message));
      const response = await page.goto(siteUrl, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => null);
      if (!response || !response.ok()) {
        return TestReportSchema.parse({ passed: false, summary: `Le WordPress local n'a pas répondu correctement (${response ? response.status() : "aucune réponse"}).`, suites: [{ name: "staging-validation", passed: 0, failed: 1, durationMs: Date.now() - started }], consoleErrors, brokenLinks: [] });
      }
      const links = await page.$$eval("a[href]", (anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href));
      const sameOriginLinks = [...new Set(links)].filter((href) => href.startsWith(siteUrl)).slice(0, 25);
      const brokenLinks: string[] = [];
      for (const link of sameOriginLinks) {
        try { const result = await fetch(link, { method: "GET", signal: AbortSignal.timeout(5000) }); if (!result.ok) brokenLinks.push(`${link} (${result.status})`); }
        catch { brokenLinks.push(`${link} (injoignable)`); }
      }
      const accessibility = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll("img")).filter((image) => !image.hasAttribute("alt")).length;
        const unlabelledFields = Array.from(document.querySelectorAll("input, textarea, select")).filter((field) => { const id = field.getAttribute("id"); return !field.closest("label") && !(id && document.querySelector(`label[for="${id}"]`)); }).length;
        const headingLevels = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((heading) => Number(heading.tagName.slice(1)));
        let hierarchyIssues = 0; for (let index = 1; index < headingLevels.length; index++) { if (headingLevels[index]! - headingLevels[index - 1]! > 1) hierarchyIssues++; }
        return { images, unlabelledFields, hierarchyIssues };
      });
      const violations = accessibility.images + accessibility.unlabelledFields + accessibility.hierarchyIssues;
      const accessibilityScore = Math.max(0, 100 - violations * 10);
      const passed = brokenLinks.length === 0 && consoleErrors.length === 0;
      return TestReportSchema.parse({
        passed,
        summary: passed ? `Validation en direct réussie sur ${siteUrl} (${sameOriginLinks.length} lien(s) vérifié(s), score d'accessibilité ${accessibilityScore}).` : `Validation en direct sur ${siteUrl} : ${consoleErrors.length} erreur(s) console, ${brokenLinks.length} lien(s) cassé(s).`,
        suites: [{ name: "staging-validation", passed: passed ? 1 : 0, failed: passed ? 0 : 1, durationMs: Date.now() - started }],
        consoleErrors,
        brokenLinks,
        accessibilityScore
      });
    } finally {
      await browser.close();
    }
  }
}

const escapeHtml = (value: string) => value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
async function ensureLocalSite(workspaceId: string) { const url = process.env.WORDPRESS_LOCAL_URL ?? "http://localhost:8080"; return db.wordPressSite.upsert({ where: { workspaceId_url: { workspaceId, url } }, update: {}, create: { workspaceId, name: "WordPress local", url, isLocal: true, allowPrivateNetwork: true } }); }

export async function acquireProjectLock(projectId: string, ownerId: string, ttlMs = 60_000): Promise<boolean> { const now = new Date(); const expiresAt = new Date(now.getTime() + ttlMs); return db.$transaction(async (tx) => { await tx.jobLock.deleteMany({ where: { projectId, expiresAt: { lt: now } } }); try { await tx.jobLock.create({ data: { projectId, ownerId, expiresAt } }); return true; } catch { return false; } }); }
export async function renewProjectLock(projectId: string, ownerId: string, ttlMs = 60_000): Promise<boolean> { const expiresAt = new Date(Date.now() + ttlMs); const updated = await db.jobLock.updateMany({ where: { projectId, ownerId }, data: { expiresAt, heartbeatAt: new Date() } }); return updated.count === 1; }
export async function releaseProjectLock(projectId: string, ownerId: string) { await db.jobLock.deleteMany({ where: { projectId, ownerId } }); }
