import { db } from "@wp-agent-studio/database";import { route,ok } from "@/lib/http";
export const GET=route(async(_request,{params,session})=>{const{id}=await params;return ok(await db.agentMessage.findMany({where:{projectId:id,project:{workspaceId:session.workspaceId}},orderBy:{createdAt:"asc"},take:500}))},{permission:"project:read"});
