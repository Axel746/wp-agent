import { db } from "@wp-agent-studio/database";
import { decryptSecret } from "@wp-agent-studio/security";
import { AppError } from "@wp-agent-studio/shared";
import { RestWordPressConnector, snapshotChecksum } from "@wp-agent-studio/wordpress";
import { route, ok } from "@/lib/http";
export const POST=route(async(_request,{params,session})=>{const{id}=await params;const site=await db.wordPressSite.findFirst({where:{id,workspaceId:session.workspaceId,deletedAt:null},include:{secret:true}});if(!site?.secret)throw new AppError("SITE_SECRET_MISSING","Identifiants WordPress absents ou révoqués",409);const credentials=decryptSecret<any>({encryptedValue:site.secret.encryptedValue,iv:site.secret.iv,authTag:site.secret.authTag,keyVersion:site.secret.keyVersion});const connector=new RestWordPressConnector(credentials,{allowPrivate:site.allowPrivateNetwork,production:process.env.NODE_ENV==="production"});const snapshot=await connector.createSnapshot();const saved=await db.wordPressSnapshot.create({data:{wordpressSiteId:site.id,payload:snapshot as any,checksum:snapshotChecksum(snapshot)}});return ok({id:saved.id,checksum:saved.checksum,snapshot},201)},{permission:"site:write",csrf:true});
