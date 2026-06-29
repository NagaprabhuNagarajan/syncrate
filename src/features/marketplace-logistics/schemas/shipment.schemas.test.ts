import { describe, expect, it } from "vitest";
import {
  advanceShipmentSchema,
  createShipmentSchema,
  shipmentTransitionTargetSchema,
} from "./shipment.schemas";

const VALID_UUID = "11111111-1111-1111-1111-111111111111";

describe("createShipmentSchema", () => {
  it("accepts a minimal shipment with just an order id", () => {
    const result = createShipmentSchema.safeParse({ orderId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("accepts a fully specified manual shipment", () => {
    const result = createShipmentSchema.safeParse({
      orderId: VALID_UUID,
      provider: "manual",
      carrier: "Blue Dart",
      trackingNumber: "BD123456",
      notes: "Leave at reception",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing order id", () => {
    const result = createShipmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid order id", () => {
    const result = createShipmentSchema.safeParse({ orderId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported provider", () => {
    const result = createShipmentSchema.safeParse({
      orderId: VALID_UUID,
      provider: "fedex",
    });
    expect(result.success).toBe(false);
  });

  it("allows blank carrier/tracking via empty-string literal", () => {
    const result = createShipmentSchema.safeParse({
      orderId: VALID_UUID,
      carrier: "",
      trackingNumber: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an overly long carrier", () => {
    const result = createShipmentSchema.safeParse({
      orderId: VALID_UUID,
      carrier: "x".repeat(121),
    });
    expect(result.success).toBe(false);
  });
});

describe("shipmentTransitionTargetSchema", () => {
  it.each(["in_transit", "delivered", "cancelled"])(
    "accepts %s as a transition target",
    (status) => {
      expect(shipmentTransitionTargetSchema.safeParse(status).success).toBe(
        true
      );
    }
  );

  it("rejects pending as a transition target", () => {
    expect(shipmentTransitionTargetSchema.safeParse("pending").success).toBe(
      false
    );
  });
});

describe("advanceShipmentSchema", () => {
  it("accepts a valid status + version and coerces the version", () => {
    const result = advanceShipmentSchema.safeParse({
      status: "in_transit",
      version: "3",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(3);
    }
  });

  it("rejects a version below 1", () => {
    const result = advanceShipmentSchema.safeParse({
      status: "delivered",
      version: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer version", () => {
    const result = advanceShipmentSchema.safeParse({
      status: "delivered",
      version: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const result = advanceShipmentSchema.safeParse({
      status: "lost",
      version: 1,
    });
    expect(result.success).toBe(false);
  });
});
