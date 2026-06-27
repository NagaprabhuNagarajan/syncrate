import { describe, it, expect } from "vitest";
import {
  adjustStockSchema,
  transferStockSchema,
  openingStockSchema,
} from "./inventory.schemas";

const PRODUCT = "11111111-1111-1111-1111-111111111111";
const WH_A = "22222222-2222-2222-2222-222222222222";
const WH_B = "33333333-3333-3333-3333-333333333333";

describe("adjustStockSchema", () => {
  it("accepts a positive signed quantity", () => {
    const result = adjustStockSchema.safeParse({
      productId: PRODUCT,
      warehouseId: WH_A,
      quantity: 5,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a negative signed quantity", () => {
    const result = adjustStockSchema.safeParse({
      productId: PRODUCT,
      warehouseId: WH_A,
      quantity: -3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero quantity", () => {
    const result = adjustStockSchema.safeParse({
      productId: PRODUCT,
      warehouseId: WH_A,
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("coerces a numeric-string quantity", () => {
    const result = adjustStockSchema.safeParse({
      productId: PRODUCT,
      warehouseId: WH_A,
      quantity: "-7",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(-7);
    }
  });

  it("rejects an invalid product uuid", () => {
    const result = adjustStockSchema.safeParse({
      productId: "nope",
      warehouseId: WH_A,
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("transferStockSchema", () => {
  it("accepts a positive quantity across distinct warehouses", () => {
    const result = transferStockSchema.safeParse({
      productId: PRODUCT,
      fromWarehouseId: WH_A,
      toWarehouseId: WH_B,
      quantity: 4,
    });
    expect(result.success).toBe(true);
  });

  it("rejects identical source and destination warehouses", () => {
    const result = transferStockSchema.safeParse({
      productId: PRODUCT,
      fromWarehouseId: WH_A,
      toWarehouseId: WH_A,
      quantity: 4,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive quantity", () => {
    const result = transferStockSchema.safeParse({
      productId: PRODUCT,
      fromWarehouseId: WH_A,
      toWarehouseId: WH_B,
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("openingStockSchema", () => {
  it("accepts a non-negative quantity", () => {
    const result = openingStockSchema.safeParse({
      productId: PRODUCT,
      warehouseId: WH_A,
      quantity: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative quantity", () => {
    const result = openingStockSchema.safeParse({
      productId: PRODUCT,
      warehouseId: WH_A,
      quantity: -1,
    });
    expect(result.success).toBe(false);
  });
});
