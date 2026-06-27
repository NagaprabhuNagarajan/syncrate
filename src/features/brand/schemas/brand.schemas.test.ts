import { describe, it, expect } from "vitest";
import { createBrandSchema, updateBrandSchema } from "./brand.schemas";

// ─────────────────────────────────────────────────────────────
// createBrandSchema
// ─────────────────────────────────────────────────────────────

describe("createBrandSchema", () => {
  it("accepts a minimal valid payload (name only)", () => {
    const result = createBrandSchema.safeParse({ name: "Samsung" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Samsung");
    }
  });

  it("trims the name", () => {
    const result = createBrandSchema.safeParse({ name: "  Bosch  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Bosch");
    }
  });

  it("requires a name", () => {
    const result = createBrandSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = createBrandSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 100 characters", () => {
    const result = createBrandSchema.safeParse({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts an empty-string description", () => {
    const result = createBrandSchema.safeParse({
      name: "Samsung",
      description: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a description longer than 500 characters", () => {
    const result = createBrandSchema.safeParse({
      name: "Samsung",
      description: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid status", () => {
    const result = createBrandSchema.safeParse({
      name: "Samsung",
      status: "archived",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("archived");
    }
  });

  it("rejects an invalid status", () => {
    const result = createBrandSchema.safeParse({
      name: "Samsung",
      status: "deleted",
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// updateBrandSchema
// ─────────────────────────────────────────────────────────────

describe("updateBrandSchema", () => {
  it("allows omitting the name", () => {
    const result = updateBrandSchema.safeParse({ description: "Updated" });
    expect(result.success).toBe(true);
  });

  it("still rejects a too-short name when provided", () => {
    const result = updateBrandSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("accepts a status change", () => {
    const result = updateBrandSchema.safeParse({ status: "archived" });
    expect(result.success).toBe(true);
  });
});
