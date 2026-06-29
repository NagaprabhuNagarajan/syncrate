import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { MarketplaceOrder } from "@/features/marketplace-orders/types/marketplace-orders.types";
import { MarketplaceOrdersService } from "./marketplace-orders.service";

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    findOrderById: vi.fn(),
    listOrders: vi.fn(),
    findListingForOrder: vi.fn(),
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
  function buildListing(over: Record<string, unknown> = {}) {
    return {
      id: "listing-1",
      sellerOrganizationId: "seller-org",
      title: "Cement",
      price: 25,
      currency: "INR",
      minOrderQty: null as number | null,
      ...over,
    };
  }

  it("derives seller + price from the listing and creates a pending order", async () => {
    mockRepo.findListingForOrder.mockResolvedValue(buildListing());
    mockRepo.createOrder.mockResolvedValue(
      buildOrder({ quantity: 3, totalAmount: 75 })
    );
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.placeOrder(
      { listingId: "listing-1", quantity: 3 },
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(true);
    // Price comes from the listing (25), NOT from any client input.
    expect(mockRepo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "buyer-org",
        seller_organization_id: "seller-org",
        listing_id: "listing-1",
        status: "pending",
        quantity: 3,
        total_amount: 75,
        currency: "INR",
      })
    );
  });

  it("rejects when the listing does not exist / is unavailable", async () => {
    mockRepo.findListingForOrder.mockResolvedValue(null);
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.placeOrder(
      { listingId: "missing", quantity: 1 },
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(mockRepo.createOrder).not.toHaveBeenCalled();
  });

  it("rejects ordering against your own listing (no spoofing the seller)", async () => {
    mockRepo.findListingForOrder.mockResolvedValue(
      buildListing({ sellerOrganizationId: "buyer-org" })
    );
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.placeOrder(
      { listingId: "listing-1", quantity: 1 },
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("forbidden");
    }
    expect(mockRepo.createOrder).not.toHaveBeenCalled();
  });

  it("rejects a quote-on-request listing (null price)", async () => {
    mockRepo.findListingForOrder.mockResolvedValue(buildListing({ price: null }));
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.placeOrder(
      { listingId: "listing-1", quantity: 1 },
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("enforces the listing's minimum order quantity", async () => {
    mockRepo.findListingForOrder.mockResolvedValue(
      buildListing({ minOrderQty: 10 })
    );
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.placeOrder(
      { listingId: "listing-1", quantity: 5 },
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("rejects an invalid quantity before touching the listing", async () => {
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.placeOrder(
      { listingId: "listing-1", quantity: 0 },
      "buyer-org",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
  });

  it("maps a repository failure to unknown", async () => {
    mockRepo.findListingForOrder.mockResolvedValue(buildListing());
    mockRepo.createOrder.mockResolvedValue(null);
    const service = new MarketplaceOrdersService(supabase);
    const result = await service.placeOrder(
      { listingId: "listing-1", quantity: 1 },
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
