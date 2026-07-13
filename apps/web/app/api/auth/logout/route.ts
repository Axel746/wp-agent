import { NextResponse } from "next/server";
import { route } from "@/lib/http";
export const POST=route(async()=>{const response=NextResponse.json({data:{ok:true}});response.cookies.set("wpas_session","",{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production",path:"/",maxAge:0});return response},{csrf:true});
