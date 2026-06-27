import { describe, it, expect } from "vitest";
import { createUnitSchema, updateUnitSchema } from "./unit.schemas";

// ─────────────────────────────────────────────────────────────
// createUnitSchema
// ─────────────────────────────────────────────────────────────

describe("createUnitSchema", () => {
  it("accepts a valid payload", () => {
    const result = createUnitSchema.safeParse({
      name: "Kilogram",
      symbol: "kg",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Kilogram");
      expect(result.data.symbol).toBe("kg");
    }
  });

  it("trims the name and symbol", () => {
    const result = createUnitSchema.safeParse({
      name: "  Kilogram  ",
      symbol: "  kg  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Kilogram");
      expect(result.data.symbol).toBe("kg");
    }
  });

  it("requires a name", () => {
    const result = createUnitSchema.safeParse({ symbol: "kg" });
    expect(result.success).toBe(false);
  });

  it("requires a symbol", () => {
    const result = createUnitSchema.safeParse({ name: "Kilogram" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = createUnitSchema.safeParse({ name: "", symbol: "kg" });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 50 characters", () => {
    const result = createUnitSchema.safeParse({
      name: "x".repeat(51),
      symbol: "kg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a symbol longer than 10 characters", () => {
    const result = createUnitSchema.safeParse({
      name: "Kilogram",
      symbol: "x".repeat(11),
    });
    expect(result.success).toBe(false);
  });

  it("accepts an optional status", () => {
    const result = createUnitSchema.safeParse({
      name: "Kilogram",
      symbol: "kg",
      status: "archived",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("archived");
    }
  });

  it("rejects an invalid status", () => {
    const result = createUnitSchema.safeParse({
      name: "Kilogram",
      symbol: "kg",
      status: "deleted",
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// updateUnitSchema
// ─────────────────────────────────────────────────────────────

describe("updateUnitSchema", () => {
  it("accepts an empty payload (all fields optional)", () => {
    const result = updateUnitSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a partial payload with only a name", () => {
    const result = updateUnitSchema.safeParse({ name: "Gram" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Gram");
    }
  });

  it("rejects a name longer than 50 characters", () => {
    const result = updateUnitSchema.safeParse({ name: "x".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("accepts a status update", () => {
    const result = updateUnitSchema.safeParse({ status: "active" });
    expect(result.success).toBe(true);
  });
});
