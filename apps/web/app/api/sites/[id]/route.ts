import { db } from "@wp-agent-studio/database";
import { AppError } from "@wp-agent-studio/shared";
import { route, ok } from "@/lib/http";
export const GET=route(async(_request,{params,session})=>{const{id}=await params;const site=await db.wordPressSite.findFirst({where:{id,workspaceId:session.workspaceId,deletedAt:null},select:{id:true,name:true,url:true,isLocal:true,lastConnectionStatus:true,snapshots:{orderBy:{createdAt:"desc"},take:1}}});if(!site)throw new AppError("SITE_NOT_FOUND","Site introuvable",404);return ok(site)},{permission:"site:read"});
