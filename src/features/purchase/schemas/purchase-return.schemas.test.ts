import { describe, it, expect } from "vitest";
import {
  createPurchaseReturnSchema,
  purchaseReturnItemSchema,
  PURCHASE_RETURN_REASONS,
  PURCHASE_TAX_RATES,
} from "./purchase-return.schemas";

const validItem = {
  productId: "prod-1",
  quantity: 5,
  unitPrice: 100,
  taxRate: 18,
};

function validHeader(overrides: Record<string, unknown> = {}) {
  return {
    supplierId: "sup-1",
    warehouseId: "wh-1",
    reason: "damaged",
    items: [validItem],
    ...overrides,
  };
}

describe("purchaseReturnItemSchema", () => {
  it("accepts a valid line item", () => {
    const result = purchaseReturnItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it("coerces numeric strings", () => {
    const result = purchaseReturnItemSchema.safeParse({
      productId: "p",
      quantity: "3",
      unitPrice: "50",
      taxRate: "5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(3);
      expect(result.data.unitPrice).toBe(50);
    }
  });

  it("rejects a missing product", () => {
    const result = purchaseReturnItemSchema.safeParse({
      productId: "",
      quantity: 1,
      unitPrice: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero or negative quantity", () => {
    expect(
      purchaseReturnItemSchema.safeParse({ ...validItem, quantity: 0 }).success
    ).toBe(false);
    expect(
      purchaseReturnItemSchema.safeParse({ ...validItem, quantity: -1 }).success
    ).toBe(false);
  });

  it("rejects negative unit price", () => {
    expect(
      purchaseReturnItemSchema.safeParse({ ...validItem, unitPrice: -1 }).success
    ).toBe(false);
  });

  it("rejects an unsupported tax rate", () => {
    expect(
      purchaseReturnItemSchema.safeParse({ ...validItem, taxRate: 9 }).success
    ).toBe(false);
  });

  it("allows every supported tax rate", () => {
    for (const rate of PURCHASE_TAX_RATES) {
      expect(
        purchaseReturnItemSchema.safeParse({ ...validItem, taxRate: rate })
          .success
      ).toBe(true);
    }
  });

  it("treats taxRate as optional", () => {
    const { taxRate: _drop, ...noTax } = validItem;
    void _drop;
    expect(purchaseReturnItemSchema.safeParse(noTax).success).toBe(true);
  });
});

describe("createPurchaseReturnSchema", () => {
  it("accepts a valid header", () => {
    expect(createPurchaseReturnSchema.safeParse(validHeader()).success).toBe(
      true
    );
  });

  it("requires a supplier", () => {
    const result = createPurchaseReturnSchema.safeParse(
      validHeader({ supplierId: "" })
    );
    expect(result.success).toBe(false);
  });

  it("requires a warehouse", () => {
    const result = createPurchaseReturnSchema.safeParse(
      validHeader({ warehouseId: "" })
    );
    expect(result.success).toBe(false);
  });

  it("requires at least one line item", () => {
    const result = createPurchaseReturnSchema.safeParse(
      validHeader({ items: [] })
    );
    expect(result.success).toBe(false);
  });

  it("rejects an invalid reason", () => {
    const result = createPurchaseReturnSchema.safeParse(
      validHeader({ reason: "lost" })
    );
    expect(result.success).toBe(false);
  });

  it("accepts each valid reason", () => {
    for (const reason of PURCHASE_RETURN_REASONS) {
      expect(
        createPurchaseReturnSchema.safeParse(validHeader({ reason })).success
      ).toBe(true);
    }
  });

  it("accepts the supplier_recall reason", () => {
    expect(PURCHASE_RETURN_REASONS).toContain("supplier_recall");
    const result = createPurchaseReturnSchema.safeParse(
      validHeader({ reason: "supplier_recall" })
    );
    expect(result.success).toBe(true);
  });

  it("allows an optional return number and purchase order id", () => {
    const result = createPurchaseReturnSchema.safeParse(
      validHeader({ returnNumber: "PRET-00001", purchaseOrderId: "po-1" })
    );
    expect(result.success).toBe(true);
  });
});
