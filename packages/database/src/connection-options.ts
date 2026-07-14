import type { PoolConfig } from "pg";

export function createPostgresConnectionOptions(connectionString: string): PoolConfig {
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

  return {
    connectionString,
    ...(rejectUnauthorized ? {} : { ssl: { rejectUnauthorized: false } })
  };
}
