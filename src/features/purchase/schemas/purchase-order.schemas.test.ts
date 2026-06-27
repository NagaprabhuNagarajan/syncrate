import { describe, it, expect } from "vitest";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  purchaseOrderItemSchema,
  PURCHASE_TAX_RATES,
} from "./purchase-order.schemas";

function validItem(overrides: Record<string, unknown> = {}) {
  return {
    productId: "prod-1",
    quantity: "2",
    unitPrice: "100",
    discountPercent: "0",
    taxRate: "18",
    ...overrides,
  };
}

function validOrder(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: "sup-1",
    items: [validItem()],
    ...overrides,
  };
}

describe("purchaseOrderItemSchema", () => {
  it("coerces numeric string inputs to numbers", () => {
    const parsed = purchaseOrderItemSchema.parse(validItem());
    expect(parsed.quantity).toBe(2);
    expect(parsed.unitPrice).toBe(100);
    expect(parsed.taxRate).toBe(18);
  });

  it("requires a product", () => {
    const result = purchaseOrderItemSchema.safeParse(
      validItem({ productId: "" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects non-positive quantity", () => {
    expect(purchaseOrderItemSchema.safeParse(validItem({ quantity: "0" })).success).toBe(
      false
    );
    expect(
      purchaseOrderItemSchema.safeParse(validItem({ quantity: "-1" })).success
    ).toBe(false);
  });

  it("rejects negative unit price", () => {
    expect(
      purchaseOrderItemSchema.safeParse(validItem({ unitPrice: "-5" })).success
    ).toBe(false);
  });

  it("allows a zero unit price", () => {
    expect(
      purchaseOrderItemSchema.safeParse(validItem({ unitPrice: "0" })).success
    ).toBe(true);
  });

  it("enforces discount percent between 0 and 100", () => {
    expect(
      purchaseOrderItemSchema.safeParse(validItem({ discountPercent: "-1" }))
        .success
    ).toBe(false);
    expect(
      purchaseOrderItemSchema.safeParse(validItem({ discountPercent: "101" }))
        .success
    ).toBe(false);
    expect(
      purchaseOrderItemSchema.safeParse(validItem({ discountPercent: "50" }))
        .success
    ).toBe(true);
  });

  it.each(PURCHASE_TAX_RATES)("accepts allowed tax rate %s", (rate) => {
    expect(
      purchaseOrderItemSchema.safeParse(validItem({ taxRate: String(rate) }))
        .success
    ).toBe(true);
  });

  it("rejects a tax rate outside the allowed set", () => {
    expect(
      purchaseOrderItemSchema.safeParse(validItem({ taxRate: "9" })).success
    ).toBe(false);
  });
});

describe("createPurchaseOrderSchema", () => {
  it("parses a valid order", () => {
    const result = createPurchaseOrderSchema.safeParse(validOrder());
    expect(result.success).toBe(true);
  });

  it("requires a supplier", () => {
    expect(
      createPurchaseOrderSchema.safeParse(validOrder({ supplierId: "" })).success
    ).toBe(false);
  });

  it("requires at least one line item", () => {
    const result = createPurchaseOrderSchema.safeParse(validOrder({ items: [] }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe("Add at least one line item");
    }
  });

  it("uppercases a 3-letter currency", () => {
    const result = createPurchaseOrderSchema.parse(
      validOrder({ currency: "usd" })
    );
    expect(result.currency).toBe("USD");
  });

  it("rejects an invalid currency length", () => {
    expect(
      createPurchaseOrderSchema.safeParse(validOrder({ currency: "US" })).success
    ).toBe(false);
  });

  it("allows empty optional fields", () => {
    const result = createPurchaseOrderSchema.safeParse(
      validOrder({ warehouseId: "", orderDate: "", notes: "", terms: "" })
    );
    expect(result.success).toBe(true);
  });

  it("updatePurchaseOrderSchema validates the same shape", () => {
    expect(updatePurchaseOrderSchema.safeParse(validOrder()).success).toBe(true);
    expect(
      updatePurchaseOrderSchema.safeParse(validOrder({ items: [] })).success
    ).toBe(false);
  });
});
