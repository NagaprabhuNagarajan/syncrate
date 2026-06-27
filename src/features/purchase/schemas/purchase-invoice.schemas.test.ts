import { describe, it, expect } from "vitest";
import {
  PURCHASE_TAX_RATES,
  purchaseInvoiceItemSchema,
  createPurchaseInvoiceSchema,
  updatePurchaseInvoiceSchema,
} from "./purchase-invoice.schemas";

describe("PURCHASE_TAX_RATES", () => {
  it("contains the supported GST slabs", () => {
    expect(PURCHASE_TAX_RATES).toEqual([0, 5, 12, 18, 28]);
  });
});

describe("purchaseInvoiceItemSchema", () => {
  it("accepts a valid line item and coerces numeric strings", () => {
    const parsed = purchaseInvoiceItemSchema.safeParse({
      productId: "p-1",
      quantity: "3",
      unitPrice: "100.5",
      taxRate: "18",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.quantity).toBe(3);
      expect(parsed.data.unitPrice).toBe(100.5);
      expect(parsed.data.taxRate).toBe(18);
    }
  });

  it("rejects a missing product", () => {
    const parsed = purchaseInvoiceItemSchema.safeParse({
      productId: "",
      quantity: 1,
      unitPrice: 1,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-positive quantity", () => {
    const parsed = purchaseInvoiceItemSchema.safeParse({
      productId: "p-1",
      quantity: 0,
      unitPrice: 1,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a negative unit price", () => {
    const parsed = purchaseInvoiceItemSchema.safeParse({
      productId: "p-1",
      quantity: 1,
      unitPrice: -5,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a tax rate outside the allowed slabs", () => {
    const parsed = purchaseInvoiceItemSchema.safeParse({
      productId: "p-1",
      quantity: 1,
      unitPrice: 1,
      taxRate: 9,
    });
    expect(parsed.success).toBe(false);
  });

  it("allows an omitted tax rate", () => {
    const parsed = purchaseInvoiceItemSchema.safeParse({
      productId: "p-1",
      quantity: 1,
      unitPrice: 1,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("createPurchaseInvoiceSchema", () => {
  const valid = {
    supplierId: "sup-1",
    items: [{ productId: "p-1", quantity: 2, unitPrice: 50, taxRate: 5 }],
  };

  it("accepts a minimal valid invoice", () => {
    expect(createPurchaseInvoiceSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts optional header fields", () => {
    const parsed = createPurchaseInvoiceSchema.safeParse({
      ...valid,
      invoiceNumber: "PINV-9",
      supplierInvoiceNumber: "ABC-1",
      purchaseOrderId: "po-1",
      invoiceDate: "2026-06-01",
      dueDate: "2026-07-01",
      notes: "hello",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires a supplier", () => {
    const parsed = createPurchaseInvoiceSchema.safeParse({
      ...valid,
      supplierId: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires at least one line item", () => {
    const parsed = createPurchaseInvoiceSchema.safeParse({
      ...valid,
      items: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("updatePurchaseInvoiceSchema mirrors the create schema", () => {
    expect(updatePurchaseInvoiceSchema).toBe(createPurchaseInvoiceSchema);
  });
});
