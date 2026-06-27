import { describe, it, expect } from "vitest";
import {
  createPurchaseRequestSchema,
  updatePurchaseRequestSchema,
  purchaseRequestItemSchema,
  rejectPurchaseRequestSchema,
} from "./purchase-request.schemas";

describe("purchaseRequestItemSchema", () => {
  it("accepts a valid item and coerces numeric strings", () => {
    const result = purchaseRequestItemSchema.safeParse({
      productId: "p-1",
      quantity: "5",
      estimatedPrice: "12.5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(5);
      expect(result.data.estimatedPrice).toBe(12.5);
    }
  });

  it("rejects a missing product", () => {
    const result = purchaseRequestItemSchema.safeParse({
      productId: "",
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero or negative quantity", () => {
    expect(
      purchaseRequestItemSchema.safeParse({ productId: "p", quantity: 0 }).success
    ).toBe(false);
    expect(
      purchaseRequestItemSchema.safeParse({ productId: "p", quantity: -3 })
        .success
    ).toBe(false);
  });

  it("rejects a negative estimated price", () => {
    expect(
      purchaseRequestItemSchema.safeParse({
        productId: "p",
        quantity: 1,
        estimatedPrice: -1,
      }).success
    ).toBe(false);
  });

  it("treats estimated price as optional", () => {
    const result = purchaseRequestItemSchema.safeParse({
      productId: "p",
      quantity: 2,
    });
    expect(result.success).toBe(true);
  });
});

describe("createPurchaseRequestSchema", () => {
  const validItem = { productId: "p-1", quantity: 2, estimatedPrice: 10 };

  it("accepts a minimal valid request", () => {
    const result = createPurchaseRequestSchema.safeParse({
      items: [validItem],
    });
    expect(result.success).toBe(true);
  });

  it("treats the request number as optional", () => {
    const result = createPurchaseRequestSchema.safeParse({
      requestNumber: "",
      items: [validItem],
    });
    expect(result.success).toBe(true);
  });

  it("requires at least one line item", () => {
    const result = createPurchaseRequestSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe("Add at least one line item");
    }
  });

  it("rejects an over-long request number", () => {
    const result = createPurchaseRequestSchema.safeParse({
      requestNumber: "X".repeat(51),
      items: [validItem],
    });
    expect(result.success).toBe(false);
  });

  it("update schema mirrors the create schema", () => {
    expect(updatePurchaseRequestSchema).toBe(createPurchaseRequestSchema);
  });
});

describe("rejectPurchaseRequestSchema", () => {
  it("accepts a non-empty reason", () => {
    expect(
      rejectPurchaseRequestSchema.safeParse({ reason: "Out of budget" }).success
    ).toBe(true);
  });

  it("rejects an empty reason", () => {
    expect(rejectPurchaseRequestSchema.safeParse({ reason: "  " }).success).toBe(
      false
    );
  });
});
