import { NextResponse, type NextRequest } from "next/server";
import { errorBody, AppError } from "@wp-agent-studio/shared";
import { csrfFor, requireApiSession } from "./auth";
import type { Permission } from "@wp-agent-studio/security";

export const ok = (data: unknown, status = 200) => NextResponse.json({ data }, { status });
export function route(handler: (request: NextRequest, context: any) => Promise<Response>, options: { permission?: Permission; csrf?: boolean } = {}) {
  return async (request: NextRequest, context: any) => { const correlationId = request.headers.get("x-correlation-id") ?? crypto.randomUUID(); try { const session = await requireApiSession(options.permission); if (options.csrf) { const origin = request.headers.get("origin"); const expectedOrigin = new URL(process.env.APP_URL ?? "http://localhost:3000").origin; if (origin && origin !== expectedOrigin) throw new AppError("CSRF_ORIGIN_MISMATCH", "Origine de requête refusée", 403); if (request.headers.get("x-csrf-token") !== csrfFor(session)) throw new AppError("CSRF_TOKEN_INVALID", "Jeton CSRF invalide", 403); } return await handler(request, { ...context, session, correlationId }); } catch (error) { const appError = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", "Une erreur interne est survenue", 500); return NextResponse.json(errorBody(appError, correlationId), { status: appError.status }); } };
}
