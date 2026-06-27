import { describe, it, expect } from "vitest";
import {
  createCategorySchema,
  updateCategorySchema,
} from "./category.schemas";

const UUID = "11111111-1111-1111-1111-111111111111";

// ─────────────────────────────────────────────────────────────
// createCategorySchema
// ─────────────────────────────────────────────────────────────

describe("createCategorySchema", () => {
  it("accepts a minimal valid payload (name only)", () => {
    const result = createCategorySchema.safeParse({ name: "Electronics" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Electronics");
    }
  });

  it("trims the name", () => {
    const result = createCategorySchema.safeParse({ name: "  Tools  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Tools");
    }
  });

  it("requires a name", () => {
    const result = createCategorySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = createCategorySchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 100 characters", () => {
    const result = createCategorySchema.safeParse({ name: "x".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts a valid uuid parentId", () => {
    const result = createCategorySchema.safeParse({
      name: "Phones",
      parentId: UUID,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty-string parentId", () => {
    const result = createCategorySchema.safeParse({
      name: "Phones",
      parentId: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a null parentId", () => {
    const result = createCategorySchema.safeParse({
      name: "Phones",
      parentId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid parentId", () => {
    const result = createCategorySchema.safeParse({
      name: "Phones",
      parentId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a description longer than 500 characters", () => {
    const result = createCategorySchema.safeParse({
      name: "Phones",
      description: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid status", () => {
    const result = createCategorySchema.safeParse({
      name: "Phones",
      status: "archived",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = createCategorySchema.safeParse({
      name: "Phones",
      status: "deleted",
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// updateCategorySchema
// ─────────────────────────────────────────────────────────────

describe("updateCategorySchema", () => {
  it("allows omitting the name", () => {
    const result = updateCategorySchema.safeParse({ status: "active" });
    expect(result.success).toBe(true);
  });

  it("still rejects a too-short name when provided", () => {
    const result = updateCategorySchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("accepts a full valid payload", () => {
    const result = updateCategorySchema.safeParse({
      name: "Laptops",
      parentId: UUID,
      description: "Portable computers",
      status: "active",
    });
    expect(result.success).toBe(true);
  });
});
