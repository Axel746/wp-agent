import { createHash } from "node:crypto";
import { AppError, WordPressCredentialsSchema } from "@wp-agent-studio/shared";
import { safeFetch } from "@wp-agent-studio/security";

export type WordPressCredentials = { url: string; username: string; applicationPassword: string };
export type ContentInput = { title: string; slug: string; content: string; status?: "draft" | "publish" };
export type ContentBundle = { pages: ContentInput[]; posts?: ContentInput[] };
export type WordPressSnapshotData = { siteInfo: unknown; currentUser: unknown; capabilities: unknown; pages: unknown[]; posts: unknown[]; media: unknown[]; plugins: unknown[]; themes: unknown[]; activeTheme: unknown; contentTypes: unknown; capturedAt: string };

export interface WordPressConnector {
  testConnection(): Promise<{ ok: true; siteName: string; userName: string }>;
  discoverApi(): Promise<unknown>; getSiteInfo(): Promise<any>; getCurrentUser(): Promise<any>; getCapabilities(): Promise<Record<string, boolean>>;
  listPages(): Promise<any[]>; getPage(id: number): Promise<any>; createDraftPage(page: ContentInput, idempotencyKey: string): Promise<any>; updatePage(id: number, page: Partial<ContentInput>, idempotencyKey: string): Promise<any>;
  listPosts(): Promise<any[]>; createDraftPost(post: ContentInput, idempotencyKey: string): Promise<any>; updatePost(id: number, post: Partial<ContentInput>, idempotencyKey: string): Promise<any>;
  listMedia(): Promise<any[]>; uploadMedia(file: Blob, filename: string, idempotencyKey: string): Promise<any>; listPlugins(): Promise<any[]>; listThemes(): Promise<any[]>; getActiveTheme(): Promise<any>;
  createSnapshot(): Promise<WordPressSnapshotData>; applyContentBundle(bundle: ContentBundle, idempotencyKey: string): Promise<any[]>; verifyContentBundle(bundle: ContentBundle): Promise<{ ok: boolean; missing: string[] }>;
}

export class RestWordPressConnector implements WordPressConnector {
  private readonly base: string;
  private readonly auth: string;
  constructor(credentials: WordPressCredentials, private readonly options: { allowPrivate?: boolean; production?: boolean } = {}) {
    const parsed = WordPressCredentialsSchema.parse(credentials);
    this.base = parsed.url.replace(/\/$/, "");
    this.auth = `Basic ${Buffer.from(`${parsed.username}:${parsed.applicationPassword}`).toString("base64")}`;
  }
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await safeFetch(`${this.base}${path}`, { ...init, headers: { Accept: "application/json", Authorization: this.auth, ...init.headers } }, { ...this.options, maxBytes: 10_000_000 });
    const text = await response.text();
    let body: any; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok) throw new AppError("WORDPRESS_API_ERROR", `WordPress a répondu ${response.status}`, response.status, { status: response.status, body });
    return body as T;
  }
  private headers(key: string): HeadersInit { return { "Content-Type": "application/json", "X-WP-Agent-Idempotency-Key": key }; }
  async testConnection() { const [site, user] = await Promise.all([this.getSiteInfo(), this.getCurrentUser()]); return { ok: true as const, siteName: String(site.name ?? this.base), userName: String(user.name ?? user.slug ?? "utilisateur") }; }
  discoverApi() { return this.request("/wp-json/"); }
  getSiteInfo() { return this.request<any>("/wp-json/"); }
  getCurrentUser() { return this.request<any>("/wp-json/wp/v2/users/me?context=edit"); }
  async getCapabilities() { const user = await this.getCurrentUser(); return (user.capabilities ?? {}) as Record<string, boolean>; }
  listPages() { return this.request<any[]>("/wp-json/wp/v2/pages?context=edit&per_page=100"); }
  getPage(id: number) { return this.request<any>(`/wp-json/wp/v2/pages/${id}?context=edit`); }
  async findBySlug(type: "pages" | "posts", slug: string): Promise<any | undefined> { return (await this.request<any[]>(`/wp-json/wp/v2/${type}?context=edit&slug=${encodeURIComponent(slug)}`))[0]; }
  async createDraftPage(page: ContentInput, key: string) { const existing = await this.findBySlug("pages", page.slug); if (existing) return this.updatePage(existing.id, page, key); return this.request("/wp-json/wp/v2/pages", { method: "POST", headers: this.headers(key), body: JSON.stringify({ ...page, status: "draft" }) }); }
  updatePage(id: number, page: Partial<ContentInput>, key: string) { return this.request(`/wp-json/wp/v2/pages/${id}`, { method: "POST", headers: this.headers(key), body: JSON.stringify(page) }); }
  listPosts() { return this.request<any[]>("/wp-json/wp/v2/posts?context=edit&per_page=100"); }
  async createDraftPost(post: ContentInput, key: string) { const existing = await this.findBySlug("posts", post.slug); if (existing) return this.updatePost(existing.id, post, key); return this.request("/wp-json/wp/v2/posts", { method: "POST", headers: this.headers(key), body: JSON.stringify({ ...post, status: "draft" }) }); }
  updatePost(id: number, post: Partial<ContentInput>, key: string) { return this.request(`/wp-json/wp/v2/posts/${id}`, { method: "POST", headers: this.headers(key), body: JSON.stringify(post) }); }
  listMedia() { return this.request<any[]>("/wp-json/wp/v2/media?context=edit&per_page=100"); }
  uploadMedia(file: Blob, filename: string, key: string) { return this.request("/wp-json/wp/v2/media", { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "Content-Disposition": `attachment; filename=\"${filename.replace(/[\r\n\"]/g, "")}\"`, "X-WP-Agent-Idempotency-Key": key }, body: file }); }
  async listPlugins() { try { return await this.request<any[]>("/wp-json/wp/v2/plugins?context=edit&per_page=100"); } catch (error) { if (error instanceof AppError && [401,403,404].includes(error.status)) return []; throw error; } }
  async listThemes() { try { return await this.request<any[]>("/wp-json/wp/v2/themes?context=edit&per_page=100"); } catch (error) { if (error instanceof AppError && [401,403,404].includes(error.status)) return []; throw error; } }
  async getActiveTheme() { const themes = await this.listThemes(); return themes.find((theme) => theme.status === "active") ?? null; }
  async createSnapshot(): Promise<WordPressSnapshotData> {
    const [siteInfo, currentUser, capabilities, pages, posts, media, plugins, themes, contentTypes] = await Promise.all([this.getSiteInfo(), this.getCurrentUser(), this.getCapabilities(), this.listPages(), this.listPosts(), this.listMedia(), this.listPlugins(), this.listThemes(), this.request("/wp-json/wp/v2/types?context=edit")]);
    return { siteInfo, currentUser, capabilities, pages, posts, media, plugins, themes, activeTheme: themes.find((theme) => theme.status === "active") ?? null, contentTypes, capturedAt: new Date().toISOString() };
  }
  async assertWriteCapability(type: "page" | "post") { const caps = await this.getCapabilities(); if (!caps[type === "page" ? "edit_pages" : "edit_posts"]) throw new AppError("WORDPRESS_CAPABILITY_MISSING", `Le compte WordPress ne peut pas modifier les ${type === "page" ? "pages" : "articles"}`, 403); }
  async applyContentBundle(bundle: ContentBundle, key: string) { await this.assertWriteCapability("page"); const results: any[] = []; for (const [index, page] of bundle.pages.entries()) results.push(await this.createDraftPage(page, `${key}:page:${index}`)); if (bundle.posts?.length) { await this.assertWriteCapability("post"); for (const [index, post] of bundle.posts.entries()) results.push(await this.createDraftPost(post, `${key}:post:${index}`)); } return results; }
  async verifyContentBundle(bundle: ContentBundle) { const [pages, posts] = await Promise.all([this.listPages(), this.listPosts()]); const slugs = new Set([...pages, ...posts].map((entry) => entry.slug)); const expected = [...bundle.pages, ...(bundle.posts ?? [])].map((entry) => entry.slug); const missing = expected.filter((slug) => !slugs.has(slug)); return { ok: missing.length === 0, missing }; }
}

export const snapshotChecksum = (snapshot: WordPressSnapshotData): string => createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
