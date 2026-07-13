import { route, ok } from "@/lib/http";
import { csrfFor } from "@/lib/auth";
export const GET=route(async(_request,{session})=>ok({email:session.email,workspaceId:session.workspaceId,role:session.role,csrfToken:csrfFor(session)}));
