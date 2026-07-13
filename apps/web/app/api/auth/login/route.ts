import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, csrfFor, signSession } from "@/lib/auth";
import { AppError, errorBody } from "@wp-agent-studio/shared";
const schema=z.object({email:z.email(),password:z.string().min(1)});
export async function POST(request:Request){try{const input=schema.parse(await request.json());const session=await authenticate(input.email,input.password);const response=NextResponse.json({data:{email:session.email,workspaceId:session.workspaceId,csrfToken:csrfFor(session)}});response.cookies.set("wpas_session",await signSession(session),{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*8});return response}catch(error){const app=error instanceof AppError?error:new AppError("INVALID_REQUEST","Requête de connexion invalide",400);return NextResponse.json(errorBody(app),{status:app.status})}}
