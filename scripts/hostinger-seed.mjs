import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";

const projectRoot = resolve(import.meta.dirname, "..");
const rootEnvPath = resolve(projectRoot, ".env");

if (existsSync(rootEnvPath)) {
  try { process.loadEnvFile(rootEnvPath); } catch { /* déjà chargé ou illisible */ }
}

const databaseRequire = createRequire(resolve(projectRoot, "packages/database/package.json"));
const { Pool } = databaseRequire("pg");
const email = process.env.DEMO_ADMIN_EMAIL ?? "admin@wp-agent.local";
const password = process.env.DEMO_ADMIN_PASSWORD ?? "change-me";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL est requis pour initialiser la base");

const url = new URL(connectionString);
if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false") {
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("uselibpqcompat", "true");
}

const salt = randomBytes(16).toString("hex");
const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const pool = new Pool({ connectionString: url.toString(), max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const userResult = await client.query(
    `INSERT INTO "User" ("id", "email", "name", "passwordHash")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("email") DO UPDATE
     SET "name" = EXCLUDED."name",
         "passwordHash" = EXCLUDED."passwordHash",
         "updatedAt" = CURRENT_TIMESTAMP
     RETURNING "id"`,
    [randomUUID(), email, "Administrateur", passwordHash]
  );
  const workspaceResult = await client.query(
    `INSERT INTO "Workspace" ("id", "name", "slug")
     VALUES ($1, $2, $3)
     ON CONFLICT ("slug") DO UPDATE
     SET "name" = EXCLUDED."name",
         "updatedAt" = CURRENT_TIMESTAMP
     RETURNING "id", "slug"`,
    [randomUUID(), "Studio de démonstration", "demo"]
  );
  const user = userResult.rows[0];
  const workspace = workspaceResult.rows[0];

  if (!user || !workspace) throw new Error("Initialisation incomplète du compte administrateur");

  await client.query(
    `INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role")
     VALUES ($1, $2, 'ADMIN')
     ON CONFLICT ("workspaceId", "userId") DO UPDATE SET "role" = 'ADMIN'`,
    [workspace.id, user.id]
  );
  await client.query("COMMIT");
  console.info(`Données initiales créées pour ${email} dans l’espace ${workspace.slug}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
