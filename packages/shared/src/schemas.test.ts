import { describe, expect, it } from "vitest";
import { SiteBriefSchema, WorkflowStateSchema } from "./schemas.js";

describe("schémas partagés", () => {
  it("refuse un brief incomplet", () => expect(() => SiteBriefSchema.parse({ name: "x" })).toThrow());
  it("valide tous les états persistés", () => expect(WorkflowStateSchema.options).toHaveLength(17));
});
