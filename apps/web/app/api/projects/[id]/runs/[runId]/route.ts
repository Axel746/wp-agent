import { db } from "@wp-agent-studio/database";
import { AppError } from "@wp-agent-studio/shared";
import { route,ok } from "@/lib/http";
export const GET=route(async(_request,{params,session})=>{const{id,runId}=await params;const run=await db.agentRun.findFirst({where:{id:runId,projectId:id,project:{workspaceId:session.workspaceId}},include:{usage:true,approvals:true}});if(!run)throw new AppError("RUN_NOT_FOUND","Run introuvable",404);return ok(run)},{permission:"project:read"});
