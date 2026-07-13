import type { StructuredAgentProvider } from "./types.js";
import { MockClaudeProvider, MockCodexProvider } from "./mock.js";
import { AnthropicProvider } from "./anthropic.js";
import { CodexProvider } from "./codex.js";

export function createProviders(mode = process.env.AGENT_MODE ?? "mock"): { claude: StructuredAgentProvider; codex: StructuredAgentProvider } {
  return mode === "mock" ? { claude: new MockClaudeProvider(), codex: new MockCodexProvider() } : { claude: new AnthropicProvider(), codex: new CodexProvider() };
}
