import type { PoolConfig } from "pg";

export function createPostgresConnectionOptions(connectionString: string): PoolConfig {
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

  if (rejectUnauthorized) return { connectionString };

  // node-postgres donne la priorité aux paramètres présents dans l’URL. On
  // adopte donc explicitement la sémantique libpq de sslmode=require : la
  // connexion reste chiffrée, sans rejeter une chaîne de certificats privée.
  const url = new URL(connectionString);
  url.searchParams.set("sslmode", "require");
  url.searchParams.set("uselibpqcompat", "true");

  return { connectionString: url.toString() };
}
