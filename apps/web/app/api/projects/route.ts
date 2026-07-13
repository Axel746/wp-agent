import { db } from "@wp-agent-studio/database";
import { CreateProjectSchema } from "@wp-agent-studio/shared";
import { route,ok } from "@/lib/http";
const slugify=(value:string)=>value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);
export const GET=route(async(_request,{session})=>ok(await db.project.findMany({where:{workspaceId:session.workspaceId,deletedAt:null},include:{runs:{orderBy:{startedAt:"desc"},take:1}},orderBy:{updatedAt:"desc"}})),{permission:"project:read"});
export const POST=route(async(request,{session})=>{const raw=await request.json();const input=CreateProjectSchema.parse({...raw,workspaceId:session.workspaceId});let slug=slugify(input.brief.name);if(await db.project.findFirst({where:{workspaceId:session.workspaceId,slug}}))slug=`${slug}-${Date.now().toString(36)}`;const project=await db.project.create({data:{workspaceId:session.workspaceId,wordpressSiteId:input.wordpressSiteId,name:input.brief.name,slug,brief:input.brief as any,memory:{create:{currentBrief:input.brief as any}}}});return ok(project,201)},{permission:"project:write",csrf:true});
