import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  use: { baseURL: process.env.APP_URL ?? "http://127.0.0.1:3000", trace: "retain-on-failure" },
  webServer: process.env.CI ? { command: "pnpm --filter @wp-agent-studio/web start", port: 3000, reuseExistingServer: false } : undefined
});
