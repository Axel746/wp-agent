import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { createPostgresConnectionOptions } from "./connection-options.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createDatabaseClient(connectionString = process.env.DATABASE_URL ?? "postgresql://wpagent:wpagent@localhost:5432/wpagent"): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg(createPostgresConnectionOptions(connectionString)) });
}

export const db = globalForPrisma.prisma ?? createDatabaseClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
