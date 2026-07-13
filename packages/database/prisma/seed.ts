import { randomBytes, scryptSync } from "node:crypto";
import { createDatabaseClient } from "../src/client.js";

const db = createDatabaseClient();
const email = process.env.DEMO_ADMIN_EMAIL ?? "admin@wp-agent.local";
const password = process.env.DEMO_ADMIN_PASSWORD ?? "change-me";
const salt = randomBytes(16).toString("hex");
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;

const user = await db.user.upsert({ where: { email }, update: {}, create: { email, name: "Administrateur", passwordHash } });
const workspace = await db.workspace.upsert({ where: { slug: "demo" }, update: {}, create: { name: "Studio de démonstration", slug: "demo" } });
await db.workspaceMember.upsert({ where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } }, update: { role: "ADMIN" }, create: { workspaceId: workspace.id, userId: user.id, role: "ADMIN" } });
console.info(`Données initiales créées pour ${email} dans l’espace ${workspace.slug}`);
await db.$disconnect();
