import { describe, it, expect } from "vitest";
import {
  ManualPaymentProvider,
  MANUAL_PROVIDER_KEY,
  defaultPaymentProvider,
  type PaymentProviderContext,
} from "./payment-provider";

const ctx: PaymentProviderContext = {
  paymentId: "pay-1",
  orderId: "order-1",
  organizationId: "buyer-org",
  counterpartyOrganizationId: "seller-org",
  amount: 200,
  currency: "INR",
  externalReference: null,
};

describe("ManualPaymentProvider", () => {
  it("exposes the manual provider key", () => {
    expect(new ManualPaymentProvider().key).toBe(MANUAL_PROVIDER_KEY);
    expect(defaultPaymentProvider.key).toBe("manual");
  });

  it("authorizes a hold with a synthetic reference and no external call", async () => {
    const provider = new ManualPaymentProvider();
    const outcome = await provider.authorizeHold(ctx);
    expect(outcome.success).toBe(true);
    if (outcome.success) {
      expect(outcome.externalReference).toBe("manual:hold:pay-1");
    }
  });

  it("releases with a release reference", async () => {
    const outcome = await new ManualPaymentProvider().release(ctx);
    expect(outcome.success).toBe(true);
    if (outcome.success) {
      expect(outcome.externalReference).toBe("manual:release:pay-1");
    }
  });

  it("refunds with a refund reference", async () => {
    const outcome = await new ManualPaymentProvider().refund(ctx);
    expect(outcome.success).toBe(true);
    if (outcome.success) {
      expect(outcome.externalReference).toBe("manual:refund:pay-1");
    }
  });

  it("falls back to the order id when no payment id exists", async () => {
    const outcome = await new ManualPaymentProvider().authorizeHold({
      ...ctx,
      paymentId: null,
    });
    expect(outcome.success).toBe(true);
    if (outcome.success) {
      expect(outcome.externalReference).toBe("manual:hold:order-1");
    }
  });
});
