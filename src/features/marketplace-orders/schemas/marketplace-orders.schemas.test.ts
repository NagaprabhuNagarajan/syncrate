import { describe, it, expect } from "vitest";
import {
  orderActionSchema,
  paymentActionSchema,
  placeOrderSchema,
} from "./marketplace-orders.schemas";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

describe("placeOrderSchema", () => {
  it("accepts a valid listing order and coerces the quantity", () => {
    const result = placeOrderSchema.safeParse({
      listingId: VALID_UUID,
      quantity: "3",
      notes: "Deliver by Friday",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(3);
      expect(result.data.listingId).toBe(VALID_UUID);
    }
  });

  it("requires a valid listing id (seller/price are not client-supplied)", () => {
    expect(
      placeOrderSchema.safeParse({ listingId: "not-a-uuid", quantity: 1 }).success
    ).toBe(false);
    expect(placeOrderSchema.safeParse({ quantity: 1 }).success).toBe(false);
  });

  it("rejects a quantity below 1", () => {
    const result = placeOrderSchema.safeParse({
      listingId: VALID_UUID,
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer quantity", () => {
    const result = placeOrderSchema.safeParse({
      listingId: VALID_UUID,
      quantity: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("ignores any client-supplied seller or price (not in the schema)", () => {
    const result = placeOrderSchema.safeParse({
      listingId: VALID_UUID,
      quantity: 2,
      sellerOrganizationId: VALID_UUID,
      unitPrice: 0.01,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("unitPrice" in result.data).toBe(false);
      expect("sellerOrganizationId" in result.data).toBe(false);
    }
  });
});

describe("orderActionSchema", () => {
  it("accepts each valid action with a version", () => {
    for (const action of ["confirm", "cancel", "fulfil", "complete"]) {
      const result = orderActionSchema.safeParse({ action, version: "2" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe(2);
      }
    }
  });

  it("rejects an unknown action", () => {
    expect(
      orderActionSchema.safeParse({ action: "explode", version: 1 }).success
    ).toBe(false);
  });

  it("rejects a missing version", () => {
    expect(
      orderActionSchema.safeParse({ action: "confirm" }).success
    ).toBe(false);
  });
});

describe("paymentActionSchema", () => {
  it("accepts hold, release and refund", () => {
    for (const action of ["hold", "release", "refund"]) {
      expect(paymentActionSchema.safeParse({ action }).success).toBe(true);
    }
  });

  it("rejects an unknown payment action", () => {
    expect(paymentActionSchema.safeParse({ action: "steal" }).success).toBe(
      false
    );
  });
});
