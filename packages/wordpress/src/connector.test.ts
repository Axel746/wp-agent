import { describe, expect, it } from "vitest";
import { snapshotChecksum } from "./connector.js";

describe("connecteur WordPress", () => {
  it("produit une empreinte stable", () => { const snapshot = { siteInfo: {}, currentUser: {}, capabilities: {}, pages: [], posts: [], media: [], plugins: [], themes: [], activeTheme: null, contentTypes: {}, capturedAt: "2026-01-01T00:00:00.000Z" }; expect(snapshotChecksum(snapshot)).toHaveLength(64); expect(snapshotChecksum(snapshot)).toBe(snapshotChecksum(snapshot)); });
});
