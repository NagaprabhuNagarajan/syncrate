import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  MarketplaceOrder,
  MarketplacePayment,
} from "@/features/marketplace-orders/types/marketplace-orders.types";
import {
  ManualPaymentProvider,
  type PaymentProvider,
} from "@/features/marketplace-orders/providers/payment-provider";
import { MarketplacePaymentsService } from "./marketplace-payments.service";

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    findOrderById: vi.fn(),
    listOrders: vi.fn(),
    createOrder: vi.fn(),
    updateOrderStatus: vi.fn(),
    findPaymentByOrderId: vi.fn(),
    findPaymentById: vi.fn(),
    createPayment: vi.fn(),
    updatePaymentStatus: vi.fn(),
  },
}));

vi.mock(
  "@/features/marketplace-orders/repositories/marketplace-orders.repository",
  () => ({
    MarketplaceOrdersRepository: vi.fn(() => mockRepo),
  })
);

function buildOrder(overrides: Partial<MarketplaceOrder> = {}): MarketplaceOrder {
  return {
    id: "order-1",
    organizationId: "buyer-org",
    sellerOrganizationId: "seller-org",
    listingId: null,
    status: "confirmed",
    quantity: 2,
    totalAmount: 200,
    currency: "INR",
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: "user-1",
    version: 1,
    ...overrides,
  };
}

function buildPayment(
  overrides: Partial<MarketplacePayment> = {}
): MarketplacePayment {
  return {
    id: "pay-1",
    organizationId: "buyer-org",
    counterpartyOrganizationId: "seller-org",
    orderId: "order-1",
    provider: "manual",
    status: "pending",
    amount: 200,
    currency: "INR",
    externalReference: null,
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: "user-1",
    version: 1,
    ...overrides,
  };
}

const supabase = {} as AppSupabaseClient;

const failingProvider: PaymentProvider = {
  key: "failing",
  authorizeHold: vi.fn(async () => ({
    success: false as const,
    reason: "card declined",
  })),
  release: vi.fn(async () => ({ success: false as const, reason: "psp down" })),
  refund: vi.fn(async () => ({ success: false as const, reason: "psp down" })),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("holdPayment", () => {
  it("forbids a non-participant", async () => {
    const service = new MarketplacePaymentsService(supabase);
    const result = await service.holdPayment(
      buildOrder(),
      "stranger-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("forbids the seller (only the buyer funds escrow)", async () => {
    const service = new MarketplacePaymentsService(supabase);
    const result = await service.holdPayment(
      buildOrder(),
      "seller-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("conflicts when the order is not yet confirmed", async () => {
    const service = new MarketplacePaymentsService(supabase);
    const result = await service.holdPayment(
      buildOrder({ status: "pending" }),
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });

  it("conflicts when a payment is already held", async () => {
    mockRepo.findPaymentByOrderId.mockResolvedValue(
      buildPayment({ status: "held" })
    );
    const service = new MarketplacePaymentsService(supabase);
    const result = await service.holdPayment(
      buildOrder(),
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
    expect(mockRepo.createPayment).not.toHaveBeenCalled();
  });

  it("creates a pending payment and moves it to held via the manual provider", async () => {
    mockRepo.findPaymentByOrderId.mockResolvedValue(null);
    mockRepo.createPayment.mockResolvedValue(buildPayment({ status: "pending" }));
    mockRepo.updatePaymentStatus.mockResolvedValue(
      buildPayment({ status: "held", externalReference: "manual:hold:pay-1", version: 2 })
    );

    const service = new MarketplacePaymentsService(
      supabase,
      new ManualPaymentProvider()
    );
    const result = await service.holdPayment(buildOrder(), "buyer-org", "user-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("held");
      expect(result.data.externalReference).toContain("manual:hold");
    }
    expect(mockRepo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "buyer-org",
        counterparty_organization_id: "seller-org",
        order_id: "order-1",
        provider: "manual",
        status: "pending",
        amount: 200,
      })
    );
    expect(mockRepo.updatePaymentStatus).toHaveBeenCalledWith(
      "pay-1",
      expect.objectContaining({ status: "held" }),
      "user-1",
      1
    );
  });

  it("reuses an existing pending payment", async () => {
    mockRepo.findPaymentByOrderId.mockResolvedValue(
      buildPayment({ status: "pending" })
    );
    mockRepo.updatePaymentStatus.mockResolvedValue(
      buildPayment({ status: "held", version: 2 })
    );
    const service = new MarketplacePaymentsService(
      supabase,
      new ManualPaymentProvider()
    );
    const result = await service.holdPayment(buildOrder(), "buyer-org", "user-1");
    expect(result.success).toBe(true);
    expect(mockRepo.createPayment).not.toHaveBeenCalled();
  });

  it("marks the payment failed when the provider rejects the hold", async () => {
    mockRepo.findPaymentByOrderId.mockResolvedValue(null);
    mockRepo.createPayment.mockResolvedValue(buildPayment({ status: "pending" }));
    mockRepo.updatePaymentStatus.mockResolvedValue(
      buildPayment({ status: "failed", version: 2 })
    );
    const service = new MarketplacePaymentsService(supabase, failingProvider);
    const result = await service.holdPayment(buildOrder(), "buyer-org", "user-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
      expect(result.error.message).toContain("card declined");
    }
    expect(mockRepo.updatePaymentStatus).toHaveBeenCalledWith(
      "pay-1",
      { status: "failed" },
      "user-1",
      1
    );
  });
});

describe("releasePayment", () => {
  it("forbids the seller from releasing", async () => {
    const service = new MarketplacePaymentsService(supabase);
    const result = await service.releasePayment(
      buildOrder(),
      "seller-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("returns not_found when there is no payment", async () => {
    mockRepo.findPaymentByOrderId.mockResolvedValue(null);
    const service = new MarketplacePaymentsService(supabase);
    const result = await service.releasePayment(
      buildOrder(),
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("conflicts when the payment is not held", async () => {
    mockRepo.findPaymentByOrderId.mockResolvedValue(
      buildPayment({ status: "pending" })
    );
    const service = new MarketplacePaymentsService(supabase);
    const result = await service.releasePayment(
      buildOrder(),
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });

  it("releases a held payment to the seller (buyer-initiated)", async () => {
    mockRepo.findPaymentByOrderId.mockResolvedValue(
      buildPayment({ status: "held", version: 2 })
    );
    mockRepo.updatePaymentStatus.mockResolvedValue(
      buildPayment({ status: "released", version: 3 })
    );
    const service = new MarketplacePaymentsService(
      supabase,
      new ManualPaymentProvider()
    );
    const result = await service.releasePayment(
      buildOrder(),
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("released");
    }
    expect(mockRepo.updatePaymentStatus).toHaveBeenCalledWith(
      "pay-1",
      expect.objectContaining({ status: "released" }),
      "user-1",
      2
    );
  });

  it("marks failed when the provider rejects the release", async () => {
    mockRepo.findPaymentByOrderId.mockResolvedValue(
      buildPayment({ status: "held", version: 2 })
    );
    mockRepo.updatePaymentStatus.mockResolvedValue(
      buildPayment({ status: "failed", version: 3 })
    );
    const service = new MarketplacePaymentsService(supabase, failingProvider);
    const result = await service.releasePayment(
      buildOrder(),
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("refundPayment", () => {
  it("forbids the buyer from refunding", async () => {
    const service = new MarketplacePaymentsService(supabase);
    const result = await service.refundPayment(
      buildOrder(),
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("refunds a held payment back to the buyer (seller-initiated)", async () => {
    mockRepo.findPaymentByOrderId.mockResolvedValue(
      buildPayment({ status: "held", version: 2 })
    );
    mockRepo.updatePaymentStatus.mockResolvedValue(
      buildPayment({ status: "refunded", version: 3 })
    );
    const service = new MarketplacePaymentsService(
      supabase,
      new ManualPaymentProvider()
    );
    const result = await service.refundPayment(
      buildOrder(),
      "seller-org",
      "user-1"
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("refunded");
    }
  });
});
