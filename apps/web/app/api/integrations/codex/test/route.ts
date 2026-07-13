import { route, ok } from "@/lib/http";
import { createProviders } from "@wp-agent-studio/agent-providers";
export const POST=route(async()=>ok(await createProviders().codex.testConnection()),{permission:"workspace:manage",csrf:true});
