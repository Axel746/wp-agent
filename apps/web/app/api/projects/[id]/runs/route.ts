import { z } from "zod";
import { db } from "@wp-agent-studio/database";
import { AppError } from "@wp-agent-studio/shared";
import { route,ok } from "@/lib/http";
import { enqueueRun } from "@/lib/queue";
const schema=z.object({idempotencyKey:z.string().min(8).max(120).optional()});
export const POST=route(async(request,{params,session})=>{const{id}=await params;const input=schema.parse(await request.json().catch(()=>({})));const project=await db.project.findFirst({where:{id,workspaceId:session.workspaceId,deletedAt:null}});if(!project)throw new AppError("PROJECT_NOT_FOUND","Projet introuvable",404);const active=await db.agentRun.findFirst({where:{projectId:id,finishedAt:null}});if(active)return ok(active);const key=input.idempotencyKey??crypto.randomUUID();const run=await db.$transaction(async(tx)=>{const created=await tx.agentRun.create({data:{projectId:id,idempotencyKey:key,maxTurns:Number(process.env.MAX_AGENT_TURNS??12),maxFixCycles:Number(process.env.MAX_FIX_CYCLES??2)}});await tx.agentMessage.create({data:{workspaceId:session.workspaceId,projectId:id,runId:created.id,sender:"user",recipient:"claude",type:"brief",content:"Brief initial soumis au studio.",structuredPayload:project.brief as any}});await tx.project.update({where:{id},data:{status:"ACTIVE"}});return created});await enqueueRun(run.id);return ok(run,201)},{permission:"project:write",csrf:true});
