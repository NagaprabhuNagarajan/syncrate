import { describe, expect, it } from "vitest";
import { ManualLogisticsProvider } from "./manual-logistics-provider";
import {
  DEFAULT_LOGISTICS_PROVIDER_KEY,
  getLogisticsProvider,
} from "./index";

describe("ManualLogisticsProvider", () => {
  const provider = new ManualLogisticsProvider();

  it("exposes the 'manual' key", () => {
    expect(provider.key).toBe("manual");
  });

  it("creates a pending draft echoing the entered carrier and tracking", async () => {
    const draft = await provider.createShipment({
      orderId: "order-1",
      carrier: "Blue Dart",
      trackingNumber: "BD123",
    });
    expect(draft).toEqual({
      provider: "manual",
      carrier: "Blue Dart",
      trackingNumber: "BD123",
      status: "pending",
    });
  });

  it("normalizes blank and missing carrier/tracking to null", async () => {
    const draft = await provider.createShipment({
      orderId: "order-1",
      carrier: "   ",
      trackingNumber: null,
    });
    expect(draft.carrier).toBeNull();
    expect(draft.trackingNumber).toBeNull();
    expect(draft.status).toBe("pending");
  });

  it("reports no live status (honest manual default, no external calls)", async () => {
    const result = await provider.getStatus("BD123");
    expect(result.status).toBeNull();
    expect(result.detail).toMatch(/manual/i);
  });
});

describe("getLogisticsProvider", () => {
  it("returns the manual provider for the 'manual' key", () => {
    expect(getLogisticsProvider("manual").key).toBe("manual");
  });

  it("falls back to the manual provider for unknown / nullish keys", () => {
    expect(getLogisticsProvider(undefined).key).toBe("manual");
    expect(getLogisticsProvider(null).key).toBe("manual");
    expect(getLogisticsProvider("fedex").key).toBe("manual");
  });

  it("defaults to the manual provider key", () => {
    expect(DEFAULT_LOGISTICS_PROVIDER_KEY).toBe("manual");
  });
});
