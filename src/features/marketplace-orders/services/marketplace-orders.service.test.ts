import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { MarketplaceOrder } from "@/features/marketplace-orders/types/marketplace-orders.types";
import { MarketplaceOrdersService } from "./marketplace-orders.service";

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
    status: "pending",
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

const supabase = {} as AppSupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("placeOrder", () => {
  it("rejects ordering from your own organization", async () => {
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.placeOrder(
      { sellerOrganizationId: "buyer-org", quantity: 1, unitPrice: 10 },
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockRepo.createOrder).not.toHaveBeenCalled();
  });

  it("computes total = quantity × unit price and creates a pending order", async () => {
    mockRepo.createOrder.mockResolvedValue(
      buildOrder({ quantity: 3, totalAmount: 75 })
    );
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.placeOrder(
      { sellerOrganizationId: "seller-org", quantity: 3, unitPrice: 25 },
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(true);
    expect(mockRepo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "buyer-org",
        seller_organization_id: "seller-org",
        status: "pending",
        quantity: 3,
        total_amount: 75,
      })
    );
  });

  it("rejects an invalid quantity", async () => {
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.placeOrder(
      { sellerOrganizationId: "seller-org", quantity: 0, unitPrice: 10 },
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("maps a repository failure to unknown", async () => {
    mockRepo.createOrder.mockResolvedValue(null);
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.placeOrder(
      { sellerOrganizationId: "seller-org", quantity: 1, unitPrice: 10 },
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("transitionOrder", () => {
  it("returns not_found when the order is missing", async () => {
    mockRepo.findOrderById.mockResolvedValue(null);
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.transitionOrder(
      "order-x",
      "confirm",
      "seller-org",
      "user-1",
      1
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
  });

  it("forbids a non-participant", async () => {
    mockRepo.findOrderById.mockResolvedValue(buildOrder());
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.transitionOrder(
      "order-1",
      "confirm",
      "stranger-org",
      "user-1",
      1
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockRepo.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("conflicts when the action is illegal from the current status", async () => {
    mockRepo.findOrderById.mockResolvedValue(buildOrder({ status: "completed" }));
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.transitionOrder(
      "order-1",
      "confirm",
      "seller-org",
      "user-1",
      1
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
    expect(mockRepo.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("forbids the wrong role for a legal status transition", async () => {
    // Buyer trying to confirm (only the seller may confirm).
    mockRepo.findOrderById.mockResolvedValue(buildOrder({ status: "pending" }));
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.transitionOrder(
      "order-1",
      "confirm",
      "buyer-org",
      "user-1",
      1
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockRepo.updateOrderStatus).not.toHaveBeenCalled();
  });

  it("confirms a pending order as the seller", async () => {
    mockRepo.findOrderById.mockResolvedValue(buildOrder({ status: "pending" }));
    mockRepo.updateOrderStatus.mockResolvedValue(
      buildOrder({ status: "confirmed", version: 2 })
    );
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.transitionOrder(
      "order-1",
      "confirm",
      "seller-org",
      "user-1",
      1
    );
    expect(result.success).toBe(true);
    expect(mockRepo.updateOrderStatus).toHaveBeenCalledWith(
      "order-1",
      "confirmed",
      "user-1",
      1
    );
  });

  it("maps an optimistic-lock miss to conflict", async () => {
    mockRepo.findOrderById.mockResolvedValue(buildOrder({ status: "pending" }));
    mockRepo.updateOrderStatus.mockResolvedValue(null);
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.transitionOrder(
      "order-1",
      "confirm",
      "seller-org",
      "user-1",
      1
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });

  it("lets the buyer complete a fulfilled order", async () => {
    mockRepo.findOrderById.mockResolvedValue(
      buildOrder({ status: "fulfilled", version: 3 })
    );
    mockRepo.updateOrderStatus.mockResolvedValue(
      buildOrder({ status: "completed", version: 4 })
    );
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.transitionOrder(
      "order-1",
      "complete",
      "buyer-org",
      "user-1",
      3
    );
    expect(result.success).toBe(true);
    expect(mockRepo.updateOrderStatus).toHaveBeenCalledWith(
      "order-1",
      "completed",
      "user-1",
      3
    );
  });
});

describe("getOrderWithPayment", () => {
  it("returns the order with its payment", async () => {
    mockRepo.findOrderById.mockResolvedValue(buildOrder());
    mockRepo.findPaymentByOrderId.mockResolvedValue(null);
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.getOrderWithPayment("order-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order.id).toBe("order-1");
      expect(result.data.payment).toBeNull();
    }
  });

  it("returns not_found when missing", async () => {
    mockRepo.findOrderById.mockResolvedValue(null);
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.getOrderWithPayment("nope");
    expect(result.success).toBe(false);
  });
});
