import { describe, expect, it } from "vitest";
import {
  createListingSchema,
  listingStatusSchema,
  updateListingSchema,
} from "./marketplace.schemas";

describe("createListingSchema", () => {
  const valid = {
    listingType: "product",
    title: "Premium widgets",
  };

  it("accepts a minimal valid product listing", () => {
    const result = createListingSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts a fully-specified listing and coerces numerics", () => {
    const result = createListingSchema.safeParse({
      listingType: "supplier",
      title: "Bulk supplier",
      description: "We supply in bulk",
      category: "Hardware",
      price: "1499.50",
      currency: "usd",
      unit: "box",
      minOrderQty: "10",
      productId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(1499.5);
      expect(result.data.minOrderQty).toBe(10);
      expect(result.data.currency).toBe("USD");
    }
  });

  it("rejects an invalid listing type", () => {
    const result = createListingSchema.safeParse({
      ...valid,
      listingType: "service",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title shorter than 2 characters", () => {
    const result = createListingSchema.safeParse({ ...valid, title: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = createListingSchema.safeParse({ ...valid, price: "-5" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer minimum order quantity", () => {
    const result = createListingSchema.safeParse({
      ...valid,
      minOrderQty: "2.5",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a currency that is not 3 letters", () => {
    const result = createListingSchema.safeParse({ ...valid, currency: "RUPEE" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed product id", () => {
    const result = createListingSchema.safeParse({
      ...valid,
      productId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("treats empty optional strings as allowed", () => {
    const result = createListingSchema.safeParse({
      ...valid,
      productId: "",
      currency: "",
      category: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateListingSchema", () => {
  it("requires a version and coerces it to a number", () => {
    const result = updateListingSchema.safeParse({
      listingType: "product",
      title: "Updated",
      version: "3",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(3);
    }
  });

  it("rejects a missing version", () => {
    const result = updateListingSchema.safeParse({
      listingType: "product",
      title: "Updated",
    });
    expect(result.success).toBe(false);
  });
});

describe("listingStatusSchema", () => {
  it.each(["active", "paused", "archived"])("accepts %s", (status) => {
    expect(listingStatusSchema.safeParse({ status }).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(listingStatusSchema.safeParse({ status: "deleted" }).success).toBe(
      false
    );
  });
});
