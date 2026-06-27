import { describe, it, expect } from "vitest";
import { createBatchSchema } from "./batch.schemas";

const PRODUCT = "11111111-1111-1111-1111-111111111111";

describe("createBatchSchema", () => {
  it("accepts a minimal valid batch", () => {
    const result = createBatchSchema.safeParse({
      productId: PRODUCT,
      batchNumber: "B-001",
      receivedQuantity: 100,
    });
    expect(result.success).toBe(true);
  });

  it("requires a batch number", () => {
    const result = createBatchSchema.safeParse({
      productId: PRODUCT,
      batchNumber: "",
      receivedQuantity: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an expiry date before the manufacturing date", () => {
    const result = createBatchSchema.safeParse({
      productId: PRODUCT,
      batchNumber: "B-001",
      manufacturingDate: "2026-06-01",
      expiryDate: "2026-05-01",
      receivedQuantity: 10,
    });
    expect(result.success).toBe(false);
  });

  it("accepts an expiry date after the manufacturing date", () => {
    const result = createBatchSchema.safeParse({
      productId: PRODUCT,
      batchNumber: "B-001",
      manufacturingDate: "2026-01-01",
      expiryDate: "2027-01-01",
      receivedQuantity: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a badly formatted date", () => {
    const result = createBatchSchema.safeParse({
      productId: PRODUCT,
      batchNumber: "B-001",
      expiryDate: "01-01-2027",
      receivedQuantity: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative received quantity", () => {
    const result = createBatchSchema.safeParse({
      productId: PRODUCT,
      batchNumber: "B-001",
      receivedQuantity: -1,
    });
    expect(result.success).toBe(false);
  });
});
