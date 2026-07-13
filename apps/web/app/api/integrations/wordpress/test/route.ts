import { route, ok } from "@/lib/http";
import { WordPressCredentialsSchema } from "@wp-agent-studio/shared";
import { RestWordPressConnector } from "@wp-agent-studio/wordpress";
export const POST=route(async(request)=>{const input=WordPressCredentialsSchema.parse(await request.json());const connector=new RestWordPressConnector(input,{allowPrivate:process.env.ENABLE_PRIVATE_NETWORK_TARGETS==="true",production:process.env.NODE_ENV==="production"});return ok(await connector.testConnection())},{permission:"site:write",csrf:true});
