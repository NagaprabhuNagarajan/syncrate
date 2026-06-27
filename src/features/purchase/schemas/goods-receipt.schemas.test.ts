import { describe, it, expect } from "vitest";
import {
  goodsReceiptItemSchema,
  createGoodsReceiptSchema,
} from "./goods-receipt.schemas";

describe("goodsReceiptItemSchema", () => {
  it("accepts a valid received line and coerces numeric strings", () => {
    const result = goodsReceiptItemSchema.safeParse({
      purchaseOrderItemId: "poi-1",
      productId: "prod-1",
      receivedQuantity: "5",
      rejectedQuantity: "1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.receivedQuantity).toBe(5);
      expect(result.data.rejectedQuantity).toBe(1);
    }
  });

  it("accepts a line with only a rejected quantity", () => {
    const result = goodsReceiptItemSchema.safeParse({
      purchaseOrderItemId: "poi-1",
      productId: "prod-1",
      receivedQuantity: 0,
      rejectedQuantity: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a line where both received and rejected are zero", () => {
    const result = goodsReceiptItemSchema.safeParse({
      purchaseOrderItemId: "poi-1",
      productId: "prod-1",
      receivedQuantity: 0,
      rejectedQuantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative received quantity", () => {
    const result = goodsReceiptItemSchema.safeParse({
      purchaseOrderItemId: "poi-1",
      productId: "prod-1",
      receivedQuantity: -1,
    });
    expect(result.success).toBe(false);
  });

  it("requires purchaseOrderItemId and productId", () => {
    const result = goodsReceiptItemSchema.safeParse({
      purchaseOrderItemId: "",
      productId: "",
      receivedQuantity: 5,
    });
    expect(result.success).toBe(false);
  });
});

describe("createGoodsReceiptSchema", () => {
  const validLine = {
    purchaseOrderItemId: "poi-1",
    productId: "prod-1",
    receivedQuantity: 5,
    rejectedQuantity: 0,
  };

  it("accepts a valid goods receipt payload", () => {
    const result = createGoodsReceiptSchema.safeParse({
      purchaseOrderId: "po-1",
      warehouseId: "wh-1",
      receivedDate: "2026-06-26",
      notes: "All good",
      items: [validLine],
    });
    expect(result.success).toBe(true);
  });

  it("requires purchaseOrderId", () => {
    const result = createGoodsReceiptSchema.safeParse({
      purchaseOrderId: "",
      warehouseId: "wh-1",
      items: [validLine],
    });
    expect(result.success).toBe(false);
  });

  it("requires warehouseId", () => {
    const result = createGoodsReceiptSchema.safeParse({
      purchaseOrderId: "po-1",
      warehouseId: "",
      items: [validLine],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one line item", () => {
    const result = createGoodsReceiptSchema.safeParse({
      purchaseOrderId: "po-1",
      warehouseId: "wh-1",
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one line with a received quantity", () => {
    const result = createGoodsReceiptSchema.safeParse({
      purchaseOrderId: "po-1",
      warehouseId: "wh-1",
      items: [
        {
          purchaseOrderItemId: "poi-1",
          productId: "prod-1",
          receivedQuantity: 0,
          rejectedQuantity: 2,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
