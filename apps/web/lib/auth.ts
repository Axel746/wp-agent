import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "@wp-agent-studio/database";
import { AppError } from "@wp-agent-studio/shared";
import { createCsrfToken, type Permission, type Role, assertPermission } from "@wp-agent-studio/security";

export type Session = { userId: string; workspaceId: string; role: Role; email: string; sessionId: string };
const secret = () => { const value = process.env.AUTH_SECRET; if (!value || value.length < 32) { if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET invalide"); return new TextEncoder().encode("local-development-secret-change-me-32"); } return new TextEncoder().encode(value); };
export async function signSession(session: Session) { return new SignJWT(session).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(secret()); }
export async function readSession(): Promise<Session | null> { const token = (await cookies()).get("wpas_session")?.value; if (!token) return null; try { const { payload } = await jwtVerify(token, secret()); return payload as unknown as Session; } catch { return null; } }
export async function requirePageSession() { const session = await readSession(); if (!session) redirect("/login"); return session; }
export async function requireApiSession(permission?: Permission) { const session = await readSession(); if (!session) throw new AppError("UNAUTHENTICATED", "Authentification requise", 401); if (permission) assertPermission(session.role, permission); return session; }
export function verifyPassword(password: string, stored: string) { const [salt, expectedHex] = stored.split(":"); if (!salt || !expectedHex) return false; const actual = scryptSync(password, salt, 64); const expected = Buffer.from(expectedHex, "hex"); return actual.length === expected.length && timingSafeEqual(actual, expected); }
export async function authenticate(email: string, password: string) { const user = await db.user.findUnique({ where: { email }, include: { memberships: { take: 1 } } }); const membership = user?.memberships[0]; if (!user || !membership || !verifyPassword(password, user.passwordHash)) throw new AppError("INVALID_CREDENTIALS", "Adresse ou mot de passe incorrect", 401); return { userId: user.id, workspaceId: membership.workspaceId, role: membership.role as Role, email: user.email, sessionId: crypto.randomUUID() } satisfies Session; }
export const csrfFor = (session: Session) => createCsrfToken(session.sessionId, process.env.AUTH_SECRET ?? "local-development-secret-change-me-32");
