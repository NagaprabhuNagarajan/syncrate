import { describe, it, expect } from "vitest";
import {
  assignPermissionsSchema,
  createRoleSchema,
  updateRoleSchema,
} from "./role.schemas";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("createRoleSchema", () => {
  it("accepts a valid role with permissions", () => {
    const result = createRoleSchema.safeParse({
      name: "Sales Manager",
      description: "Handles sales",
      permissionIds: [UUID],
    });
    expect(result.success).toBe(true);
  });

  it("trims the name", () => {
    const result = createRoleSchema.safeParse({ name: "  Viewer  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Viewer");
    }
  });

  it("rejects a name that is too short", () => {
    const result = createRoleSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects a name that is too long", () => {
    const result = createRoleSchema.safeParse({ name: "x".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("allows an empty description", () => {
    const result = createRoleSchema.safeParse({ name: "Viewer", description: "" });
    expect(result.success).toBe(true);
  });

  it("rejects non-uuid permission ids", () => {
    const result = createRoleSchema.safeParse({
      name: "Viewer",
      permissionIds: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateRoleSchema", () => {
  it("requires a version", () => {
    const result = updateRoleSchema.safeParse({ name: "Viewer" });
    expect(result.success).toBe(false);
  });

  it("coerces a string version to a number", () => {
    const result = updateRoleSchema.safeParse({ name: "Viewer", version: "2" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(2);
    }
  });

  it("rejects a version below 1", () => {
    const result = updateRoleSchema.safeParse({ version: 0 });
    expect(result.success).toBe(false);
  });

  it("allows updating without a name", () => {
    const result = updateRoleSchema.safeParse({ version: 1, description: "x" });
    expect(result.success).toBe(true);
  });
});

describe("assignPermissionsSchema", () => {
  it("accepts an array of uuids", () => {
    const result = assignPermissionsSchema.safeParse({ permissionIds: [UUID] });
    expect(result.success).toBe(true);
  });

  it("accepts an empty array", () => {
    const result = assignPermissionsSchema.safeParse({ permissionIds: [] });
    expect(result.success).toBe(true);
  });

  it("rejects invalid ids", () => {
    const result = assignPermissionsSchema.safeParse({
      permissionIds: ["nope"],
    });
    expect(result.success).toBe(false);
  });
});
