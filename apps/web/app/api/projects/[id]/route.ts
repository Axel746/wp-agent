import { db } from "@wp-agent-studio/database";
import { AppError } from "@wp-agent-studio/shared";
import { route,ok } from "@/lib/http";
export const GET=route(async(_request,{params,session})=>{const{id}=await params;const project=await db.project.findFirst({where:{id,workspaceId:session.workspaceId,deletedAt:null},include:{wordpressSite:{select:{id:true,name:true,url:true,isLocal:true}},memory:true,runs:{orderBy:{startedAt:"desc"},take:1},approvals:{where:{status:"PENDING"}},artifacts:{orderBy:{createdAt:"desc"}}}});if(!project)throw new AppError("PROJECT_NOT_FOUND","Projet introuvable",404);return ok(project)},{permission:"project:read"});
