import { describe, it, expect } from "vitest";
import {
  serialNumberSchema,
  serialStatusSchema,
  createSerialSchema,
  bulkSerialSchema,
  updateSerialSchema,
  splitSerials,
} from "./serial.schemas";

const UUID = "11111111-1111-1111-1111-111111111111";
const UUID2 = "22222222-2222-2222-2222-222222222222";

describe("serialNumberSchema", () => {
  it("trims and accepts a valid serial", () => {
    expect(serialNumberSchema.parse("  SN-1  ")).toBe("SN-1");
  });

  it("rejects an empty serial", () => {
    expect(serialNumberSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a serial longer than 100 characters", () => {
    expect(serialNumberSchema.safeParse("x".repeat(101)).success).toBe(false);
  });
});

describe("serialStatusSchema", () => {
  it("accepts known statuses", () => {
    expect(serialStatusSchema.parse("in_stock")).toBe("in_stock");
    expect(serialStatusSchema.parse("damaged")).toBe("damaged");
  });

  it("rejects unknown statuses", () => {
    expect(serialStatusSchema.safeParse("lost").success).toBe(false);
  });
});

describe("createSerialSchema", () => {
  it("accepts a valid single serial input", () => {
    const result = createSerialSchema.safeParse({
      productId: UUID,
      serialNumber: "SN-1",
    });
    expect(result.success).toBe(true);
  });

  it("requires a valid product uuid", () => {
    const result = createSerialSchema.safeParse({
      productId: "not-a-uuid",
      serialNumber: "SN-1",
    });
    expect(result.success).toBe(false);
  });

  it("tolerates an empty branchId", () => {
    const result = createSerialSchema.safeParse({
      productId: UUID,
      serialNumber: "SN-1",
      branchId: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid branch uuid", () => {
    const result = createSerialSchema.safeParse({
      productId: UUID,
      serialNumber: "SN-1",
      branchId: UUID2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid branch uuid", () => {
    const result = createSerialSchema.safeParse({
      productId: UUID,
      serialNumber: "SN-1",
      branchId: "bad",
    });
    expect(result.success).toBe(false);
  });
});

describe("bulkSerialSchema", () => {
  it("accepts a non-empty serials array", () => {
    const result = bulkSerialSchema.safeParse({
      productId: UUID,
      serials: ["SN-1", "SN-2"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty serials array", () => {
    const result = bulkSerialSchema.safeParse({
      productId: UUID,
      serials: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateSerialSchema", () => {
  it("accepts a status-only update", () => {
    const result = updateSerialSchema.safeParse({ status: "sold" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = updateSerialSchema.safeParse({ status: "exploded" });
    expect(result.success).toBe(false);
  });
});

describe("splitSerials", () => {
  it("splits on newlines and commas, trimming tokens", () => {
    expect(splitSerials("SN-1\nSN-2, SN-3")).toEqual(["SN-1", "SN-2", "SN-3"]);
  });

  it("removes blanks and de-duplicates", () => {
    expect(splitSerials("SN-1\n\nSN-1, ,SN-2")).toEqual(["SN-1", "SN-2"]);
  });

  it("returns an empty array for blank input", () => {
    expect(splitSerials("  \n , ")).toEqual([]);
  });
});
