import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "./client.js";
const integration = process.env.RUN_INTEGRATION === "true";
describe.skipIf(!integration)("PostgreSQL", () => { it("applique la migration et répond", async () => { const client = createDatabaseClient(); await expect(client.$queryRaw`SELECT 1`).resolves.toBeTruthy(); await client.$disconnect(); }); });
