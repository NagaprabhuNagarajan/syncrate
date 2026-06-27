import { describe, it, expect } from "vitest";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
} from "./warehouse.schemas";

describe("createWarehouseSchema", () => {
  it("accepts a minimal valid warehouse and uppercases the code", () => {
    const result = createWarehouseSchema.safeParse({
      code: "wh-chn-01",
      name: "Chennai Central",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("WH-CHN-01");
      expect(result.data.name).toBe("Chennai Central");
    }
  });

  it("requires a code", () => {
    const result = createWarehouseSchema.safeParse({ name: "Main" });
    expect(result.success).toBe(false);
  });

  it("rejects a code shorter than 2 characters", () => {
    const result = createWarehouseSchema.safeParse({ code: "A", name: "Main" });
    expect(result.success).toBe(false);
  });

  it("rejects a code with invalid characters", () => {
    const result = createWarehouseSchema.safeParse({
      code: "WH 01!",
      name: "Main",
    });
    expect(result.success).toBe(false);
  });

  it("requires a name of at least 2 characters", () => {
    const result = createWarehouseSchema.safeParse({ code: "WH-01", name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid pincode", () => {
    const result = createWarehouseSchema.safeParse({
      code: "WH-01",
      name: "Main",
      pincode: "12",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid 6-digit pincode", () => {
    const result = createWarehouseSchema.safeParse({
      code: "WH-01",
      name: "Main",
      pincode: "600001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative capacity", () => {
    const result = createWarehouseSchema.safeParse({
      code: "WH-01",
      name: "Main",
      capacity: -5,
    });
    expect(result.success).toBe(false);
  });

  it("coerces a numeric-string capacity", () => {
    const result = createWarehouseSchema.safeParse({
      code: "WH-01",
      name: "Main",
      capacity: "100",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capacity).toBe(100);
    }
  });

  it("rejects an invalid branch uuid", () => {
    const result = createWarehouseSchema.safeParse({
      code: "WH-01",
      name: "Main",
      branchId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty branchId via the literal fallback", () => {
    const result = createWarehouseSchema.safeParse({
      code: "WH-01",
      name: "Main",
      branchId: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateWarehouseSchema", () => {
  it("allows a partial update with only a status", () => {
    const result = updateWarehouseSchema.safeParse({ status: "inactive" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = updateWarehouseSchema.safeParse({ status: "deleted" });
    expect(result.success).toBe(false);
  });

  it("still validates the code format when present", () => {
    const result = updateWarehouseSchema.safeParse({ code: "!" });
    expect(result.success).toBe(false);
  });
});
