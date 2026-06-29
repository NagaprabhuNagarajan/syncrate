import { describe, it, expect } from "vitest";
import {
  createCatalogItemSchema,
  updateCatalogItemSchema,
} from "./catalogSchema";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("createCatalogItemSchema", () => {
  it("accepts a full valid payload", () => {
    const result = createCatalogItemSchema.safeParse({
      productId: UUID,
      catalogPrice: 100,
      currency: "USD",
      moq: 5,
      leadTimeDays: 3,
      stockAvailability: "limited",
      isPublished: true,
      catalogNotes: "note",
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults for omitted optional fields", () => {
    const result = createCatalogItemSchema.safeParse({
      productId: UUID,
      catalogPrice: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("INR");
      expect(result.data.moq).toBe(1);
      expect(result.data.stockAvailability).toBe("available");
      expect(result.data.isPublished).toBe(false);
    }
  });

  it("accepts a null lead time and null notes", () => {
    const result = createCatalogItemSchema.safeParse({
      productId: UUID,
      catalogPrice: 100,
      leadTimeDays: null,
      catalogNotes: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID product id", () => {
    expect(
      createCatalogItemSchema.safeParse({
        productId: "nope",
        catalogPrice: 100,
      }).success
    ).toBe(false);
  });

  it("rejects a non-positive catalog price", () => {
    expect(
      createCatalogItemSchema.safeParse({ productId: UUID, catalogPrice: 0 })
        .success
    ).toBe(false);
    expect(
      createCatalogItemSchema.safeParse({ productId: UUID, catalogPrice: -5 })
        .success
    ).toBe(false);
  });

  it("rejects a currency that is not 3 characters", () => {
    expect(
      createCatalogItemSchema.safeParse({
        productId: UUID,
        catalogPrice: 100,
        currency: "RUPEE",
      }).success
    ).toBe(false);
  });

  it("rejects a non-positive or non-integer MOQ", () => {
    expect(
      createCatalogItemSchema.safeParse({
        productId: UUID,
        catalogPrice: 100,
        moq: 0,
      }).success
    ).toBe(false);
    expect(
      createCatalogItemSchema.safeParse({
        productId: UUID,
        catalogPrice: 100,
        moq: 2.5,
      }).success
    ).toBe(false);
  });

  it("rejects a negative lead time", () => {
    expect(
      createCatalogItemSchema.safeParse({
        productId: UUID,
        catalogPrice: 100,
        leadTimeDays: -1,
      }).success
    ).toBe(false);
  });

  it("rejects an unknown stock availability", () => {
    expect(
      createCatalogItemSchema.safeParse({
        productId: UUID,
        catalogPrice: 100,
        stockAvailability: "maybe",
      }).success
    ).toBe(false);
  });

  it("rejects catalog notes over 1000 characters", () => {
    expect(
      createCatalogItemSchema.safeParse({
        productId: UUID,
        catalogPrice: 100,
        catalogNotes: "a".repeat(1001),
      }).success
    ).toBe(false);
  });
});

describe("updateCatalogItemSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateCatalogItemSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial update", () => {
    const result = updateCatalogItemSchema.safeParse({
      catalogPrice: 200,
      isPublished: true,
    });
    expect(result.success).toBe(true);
  });

  it("ignores a productId because it is omitted from the schema", () => {
    const result = updateCatalogItemSchema.safeParse({
      productId: UUID,
      catalogPrice: 50,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("productId" in result.data).toBe(false);
    }
  });

  it("still validates provided fields", () => {
    expect(
      updateCatalogItemSchema.safeParse({ catalogPrice: -1 }).success
    ).toBe(false);
  });
});
