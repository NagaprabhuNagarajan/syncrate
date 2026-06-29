import { describe, it, expect } from "vitest";
import { searchBusinessesSchema, catalogSearchSchema } from "./discoverySchema";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("searchBusinessesSchema", () => {
  it("accepts a valid query and applies default limit/offset", () => {
    const result = searchBusinessesSchema.safeParse({ query: "acme" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it("accepts explicit limit and offset within bounds", () => {
    const result = searchBusinessesSchema.safeParse({
      query: "acme",
      limit: 100,
      offset: 40,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty query", () => {
    expect(searchBusinessesSchema.safeParse({ query: "" }).success).toBe(false);
  });

  it("rejects a query over 200 characters", () => {
    expect(
      searchBusinessesSchema.safeParse({ query: "a".repeat(201) }).success
    ).toBe(false);
  });

  it("rejects a limit below 1 or above 100", () => {
    expect(
      searchBusinessesSchema.safeParse({ query: "x", limit: 0 }).success
    ).toBe(false);
    expect(
      searchBusinessesSchema.safeParse({ query: "x", limit: 101 }).success
    ).toBe(false);
  });

  it("rejects a non-integer limit and a negative offset", () => {
    expect(
      searchBusinessesSchema.safeParse({ query: "x", limit: 5.5 }).success
    ).toBe(false);
    expect(
      searchBusinessesSchema.safeParse({ query: "x", offset: -1 }).success
    ).toBe(false);
  });
});

describe("catalogSearchSchema", () => {
  it("accepts a valid supplier org id with defaults", () => {
    const result = catalogSearchSchema.safeParse({ supplierOrgId: UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
      expect(result.data.query).toBeUndefined();
    }
  });

  it("accepts an optional query", () => {
    const result = catalogSearchSchema.safeParse({
      supplierOrgId: UUID,
      query: "widget",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID supplier org id", () => {
    expect(
      catalogSearchSchema.safeParse({ supplierOrgId: "nope" }).success
    ).toBe(false);
  });

  it("rejects a query over 200 characters", () => {
    expect(
      catalogSearchSchema.safeParse({
        supplierOrgId: UUID,
        query: "a".repeat(201),
      }).success
    ).toBe(false);
  });
});
