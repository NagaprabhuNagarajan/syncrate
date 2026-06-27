import { describe, it, expect } from "vitest";
import { createProductSchema, updateProductSchema } from "./product.schemas";

// ─────────────────────────────────────────────────────────────
// createProductSchema
// ─────────────────────────────────────────────────────────────

describe("createProductSchema", () => {
  it("accepts a minimal valid payload (name only)", () => {
    const result = createProductSchema.safeParse({ name: "Premium Widget" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Premium Widget");
    }
  });

  it("trims the name", () => {
    const result = createProductSchema.safeParse({ name: "  Widget  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Widget");
    }
  });

  it("requires a name", () => {
    const result = createProductSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = createProductSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a name longer than 200 characters", () => {
    const result = createProductSchema.safeParse({ name: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  // ── code ──────────────────────────────────────────────────

  it("uppercases a provided code", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      code: "prod-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("PROD-01");
    }
  });

  it("allows an empty code", () => {
    const result = createProductSchema.safeParse({ name: "Widget", code: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a code that is too short", () => {
    const result = createProductSchema.safeParse({ name: "Widget", code: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects a code with invalid characters", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      code: "prod 01!",
    });
    expect(result.success).toBe(false);
  });

  // ── type ──────────────────────────────────────────────────

  it("accepts a valid type", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      type: "service",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("service");
    }
  });

  it("rejects an invalid type", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      type: "gadget",
    });
    expect(result.success).toBe(false);
  });

  // ── HSN / GST ─────────────────────────────────────────────

  it("accepts a valid HSN code", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      hsnCode: "3402",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an HSN code that is too short", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      hsnCode: "12",
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty HSN code", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      hsnCode: "",
    });
    expect(result.success).toBe(true);
  });

  it("coerces and accepts a valid GST rate", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      gstRate: "18",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gstRate).toBe(18);
    }
  });

  it("rejects a GST rate not in the allowed set", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      gstRate: "7",
    });
    expect(result.success).toBe(false);
  });

  // ── pricing coercion ──────────────────────────────────────

  it("coerces a numeric string selling price to a number", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      sellingPrice: "199.5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sellingPrice).toBe(199.5);
    }
  });

  it("rejects a negative price", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      purchasePrice: "-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a price that is too large", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      sellingPrice: "100000000000",
    });
    expect(result.success).toBe(false);
  });

  // ── sku / barcode ─────────────────────────────────────────

  it("accepts a valid sku and barcode", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      sku: "SKU-001",
      barcode: "8901234567890",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a sku that is too long", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      sku: "x".repeat(61),
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty sku and barcode", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      sku: "",
      barcode: "",
    });
    expect(result.success).toBe(true);
  });

  // ── classification uuids ──────────────────────────────────

  it("accepts a valid category UUID", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      categoryId: "123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid category UUID", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      categoryId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("allows an empty category UUID", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      categoryId: "",
    });
    expect(result.success).toBe(true);
  });

  // ── flags / tags / quantities ─────────────────────────────

  it("accepts taxInclusive and trackInventory booleans", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      taxInclusive: true,
      trackInventory: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taxInclusive).toBe(true);
      expect(result.data.trackInventory).toBe(false);
    }
  });

  it("coerces a quantity from a string", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      reorderLevel: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reorderLevel).toBe(10);
    }
  });

  it("accepts a tags array", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      tags: ["featured", "seasonal"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual(["featured", "seasonal"]);
    }
  });

  it("rejects a tags array containing an empty string", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      tags: [""],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a description over 2000 characters", () => {
    const result = createProductSchema.safeParse({
      name: "Widget",
      description: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// updateProductSchema
// ─────────────────────────────────────────────────────────────

describe("updateProductSchema", () => {
  it("allows an empty payload (all fields optional)", () => {
    const result = updateProductSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a valid status enum value", () => {
    const result = updateProductSchema.safeParse({ status: "discontinued" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("discontinued");
    }
  });

  it("rejects an invalid status enum value", () => {
    const result = updateProductSchema.safeParse({ status: "deleted" });
    expect(result.success).toBe(false);
  });

  it("still validates the name when provided", () => {
    const result = updateProductSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid partial update", () => {
    const result = updateProductSchema.safeParse({
      name: "Renamed Widget",
      status: "active",
      sellingPrice: "250",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sellingPrice).toBe(250);
    }
  });
});
