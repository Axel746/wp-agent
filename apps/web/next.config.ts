import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@wp-agent-studio/shared", "@wp-agent-studio/security", "@wp-agent-studio/database", "@wp-agent-studio/wordpress", "@wp-agent-studio/orchestrator", "@wp-agent-studio/agent-providers"],
  webpack(configuration) {
    configuration.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"], ".mjs": [".mts", ".mjs"], ".cjs": [".cts", ".cjs"] };
    return configuration;
  }
};
export default config;
