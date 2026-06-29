import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type {
  Shipment,
  ShipmentOrderRef,
  ShipmentStatus,
  ShipmentTransitionTarget,
} from "@/features/marketplace-logistics/types/logistics.types";
import {
  ShipmentService,
  SHIPMENT_TRANSITIONS,
  TRANSITION_ALLOWED_PARTIES,
  canTransition,
  partyCanSetStatus,
  resolveParty,
} from "./shipment.service";

// ─────────────────────────────────────────────────────────────
// Mock the repository the service instantiates internally.
// The real ManualLogisticsProvider is exercised (server-only is a no-op
// under Vitest), giving genuine provider coverage through createShipment.
// ─────────────────────────────────────────────────────────────

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    findById: vi.fn(),
    listForOrg: vi.fn(),
    findOrderById: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock(
  "@/features/marketplace-logistics/repositories/shipment.repository",
  () => ({
    ShipmentRepository: vi.fn(() => mockRepo),
  })
);

const SHIPPER = "seller-org";
const RECIPIENT = "buyer-org";
const STRANGER = "stranger-org";

function buildShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: "ship-1",
    organizationId: SHIPPER,
    counterpartyOrganizationId: RECIPIENT,
    orderId: "order-1",
    provider: "manual",
    carrier: "Blue Dart",
    trackingNumber: "BD123",
    status: "pending",
    shippedAt: null,
    deliveredAt: null,
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    createdBy: "user-1",
    version: 1,
    ...overrides,
  };
}

function buildOrder(overrides: Partial<ShipmentOrderRef> = {}): ShipmentOrderRef {
  return {
    id: "order-1",
    buyerOrganizationId: RECIPIENT,
    sellerOrganizationId: SHIPPER,
    status: "confirmed",
    ...overrides,
  };
}

const supabase = {} as AppSupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// State machine — pure helpers (exhaustive)
// ─────────────────────────────────────────────────────────────

describe("shipment state machine", () => {
  const ALL: ShipmentStatus[] = [
    "pending",
    "in_transit",
    "delivered",
    "cancelled",
  ];

  it("defines the expected transition map", () => {
    expect(SHIPMENT_TRANSITIONS).toEqual({
      pending: ["in_transit", "cancelled"],
      in_transit: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    });
  });

  it("treats delivered and cancelled as terminal", () => {
    expect(SHIPMENT_TRANSITIONS.delivered).toHaveLength(0);
    expect(SHIPMENT_TRANSITIONS.cancelled).toHaveLength(0);
    for (const to of ALL) {
      expect(canTransition("delivered", to)).toBe(false);
      expect(canTransition("cancelled", to)).toBe(false);
    }
  });

  it("allows exactly the mapped transitions and rejects all others", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const expected = (
          SHIPMENT_TRANSITIONS[from] as readonly ShipmentStatus[]
        ).includes(to);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });

  it("rejects self-transitions and pending as a target", () => {
    expect(canTransition("pending", "pending")).toBe(false);
    expect(canTransition("in_transit", "pending")).toBe(false);
    expect(canTransition("in_transit", "in_transit")).toBe(false);
  });

  describe("party permissions", () => {
    it("lets only the shipper mark in_transit and cancelled", () => {
      expect(partyCanSetStatus("shipper", "in_transit")).toBe(true);
      expect(partyCanSetStatus("recipient", "in_transit")).toBe(false);
      expect(partyCanSetStatus("shipper", "cancelled")).toBe(true);
      expect(partyCanSetStatus("recipient", "cancelled")).toBe(false);
    });

    it("lets either party mark delivered (buyer confirms delivery)", () => {
      expect(partyCanSetStatus("shipper", "delivered")).toBe(true);
      expect(partyCanSetStatus("recipient", "delivered")).toBe(true);
    });

    it("matches the declared allowed-parties map", () => {
      expect(TRANSITION_ALLOWED_PARTIES).toEqual({
        in_transit: ["shipper"],
        delivered: ["shipper", "recipient"],
        cancelled: ["shipper"],
      });
    });
  });

  describe("resolveParty", () => {
    const ship = buildShipment();
    it("identifies the shipper", () => {
      expect(resolveParty(SHIPPER, ship)).toBe("shipper");
    });
    it("identifies the recipient", () => {
      expect(resolveParty(RECIPIENT, ship)).toBe("recipient");
    });
    it("returns null for a non-participant", () => {
      expect(resolveParty(STRANGER, ship)).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// createShipment
// ─────────────────────────────────────────────────────────────

describe("ShipmentService.createShipment", () => {
  it("fails when the order does not exist", async () => {
    mockRepo.findOrderById.mockResolvedValue(null);
    const service = new ShipmentService(supabase);
    const result = await service.createShipment(
      { orderId: "order-x" },
      SHIPPER,
      "user-1"
    );
    expect(result).toMatchObject({
      success: false,
      error: { code: "not_found" },
    });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("forbids a caller who is not the order's seller", async () => {
    mockRepo.findOrderById.mockResolvedValue(buildOrder());
    const service = new ShipmentService(supabase);
    const result = await service.createShipment(
      { orderId: "order-1" },
      RECIPIENT, // buyer attempts to create
      "user-1"
    );
    expect(result).toMatchObject({
      success: false,
      error: { code: "forbidden" },
    });
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it("creates a pending shipment owned by the seller, recipient = buyer", async () => {
    mockRepo.findOrderById.mockResolvedValue(buildOrder());
    mockRepo.create.mockResolvedValue(buildShipment());
    const service = new ShipmentService(supabase);

    const result = await service.createShipment(
      {
        orderId: "order-1",
        carrier: "Blue Dart",
        trackingNumber: "BD123",
        notes: "  handle with care  ",
      },
      SHIPPER,
      "user-1"
    );

    expect(result.success).toBe(true);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: SHIPPER,
        counterparty_organization_id: RECIPIENT,
        order_id: "order-1",
        provider: "manual",
        carrier: "Blue Dart",
        tracking_number: "BD123",
        status: "pending",
        notes: "handle with care",
        created_by: "user-1",
      })
    );
  });

  it("returns unknown when the insert fails", async () => {
    mockRepo.findOrderById.mockResolvedValue(buildOrder());
    mockRepo.create.mockResolvedValue(null);
    const service = new ShipmentService(supabase);
    const result = await service.createShipment(
      { orderId: "order-1" },
      SHIPPER,
      "user-1"
    );
    expect(result).toMatchObject({
      success: false,
      error: { code: "unknown" },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// advanceStatus
// ─────────────────────────────────────────────────────────────

describe("ShipmentService.advanceStatus", () => {
  function advance(
    status: ShipmentTransitionTarget,
    callerOrgId: string,
    version = 1
  ) {
    const service = new ShipmentService(supabase);
    return service.advanceStatus(
      "ship-1",
      { status, version },
      callerOrgId,
      "user-1"
    );
  }

  it("fails when the shipment is not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const result = await advance("in_transit", SHIPPER);
    expect(result).toMatchObject({
      success: false,
      error: { code: "not_found" },
    });
  });

  it("forbids a non-participant", async () => {
    mockRepo.findById.mockResolvedValue(buildShipment());
    const result = await advance("in_transit", STRANGER);
    expect(result).toMatchObject({
      success: false,
      error: { code: "forbidden" },
    });
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("rejects an invalid transition (pending → delivered)", async () => {
    mockRepo.findById.mockResolvedValue(buildShipment({ status: "pending" }));
    const result = await advance("delivered", SHIPPER);
    expect(result).toMatchObject({
      success: false,
      error: { code: "invalid_transition" },
    });
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("rejects transitions out of a terminal state", async () => {
    mockRepo.findById.mockResolvedValue(buildShipment({ status: "delivered" }));
    const result = await advance("cancelled", SHIPPER);
    expect(result).toMatchObject({
      success: false,
      error: { code: "invalid_transition" },
    });
  });

  it("forbids the recipient from marking in_transit", async () => {
    mockRepo.findById.mockResolvedValue(buildShipment({ status: "pending" }));
    const result = await advance("in_transit", RECIPIENT);
    expect(result).toMatchObject({
      success: false,
      error: { code: "forbidden" },
    });
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });

  it("forbids the recipient from cancelling", async () => {
    mockRepo.findById.mockResolvedValue(
      buildShipment({ status: "in_transit" })
    );
    const result = await advance("cancelled", RECIPIENT);
    expect(result).toMatchObject({
      success: false,
      error: { code: "forbidden" },
    });
  });

  it("lets the shipper mark in_transit and stamps shipped_at", async () => {
    mockRepo.findById.mockResolvedValue(
      buildShipment({ status: "pending", version: 2 })
    );
    mockRepo.updateStatus.mockResolvedValue(
      buildShipment({ status: "in_transit", version: 3 })
    );
    const result = await advance("in_transit", SHIPPER, 2);
    expect(result.success).toBe(true);
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      "ship-1",
      expect.objectContaining({
        status: "in_transit",
        shipped_at: expect.any(String),
      }),
      "user-1",
      2
    );
  });

  it("lets the recipient confirm delivery and stamps delivered_at", async () => {
    mockRepo.findById.mockResolvedValue(
      buildShipment({
        status: "in_transit",
        shippedAt: new Date("2026-01-02"),
        version: 3,
      })
    );
    mockRepo.updateStatus.mockResolvedValue(
      buildShipment({ status: "delivered", version: 4 })
    );
    const result = await advance("delivered", RECIPIENT, 3);
    expect(result.success).toBe(true);
    const patch = mockRepo.updateStatus.mock.calls[0][1];
    expect(patch).toMatchObject({
      status: "delivered",
      delivered_at: expect.any(String),
    });
    // Already shipped, so shipped_at is not overwritten.
    expect(patch.shipped_at).toBeUndefined();
  });

  it("back-fills shipped_at when delivering a never-shipped shipment", async () => {
    mockRepo.findById.mockResolvedValue(
      buildShipment({ status: "in_transit", shippedAt: null })
    );
    mockRepo.updateStatus.mockResolvedValue(
      buildShipment({ status: "delivered" })
    );
    await advance("delivered", SHIPPER, 1);
    const patch = mockRepo.updateStatus.mock.calls[0][1];
    expect(patch.shipped_at).toEqual(expect.any(String));
    expect(patch.delivered_at).toEqual(expect.any(String));
  });

  it("maps a version mismatch to a conflict (optimistic lock)", async () => {
    mockRepo.findById.mockResolvedValue(
      buildShipment({ status: "pending", version: 5 })
    );
    mockRepo.updateStatus.mockResolvedValue(null);
    const result = await advance("in_transit", SHIPPER, 1);
    expect(result).toMatchObject({
      success: false,
      error: { code: "conflict" },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// reads
// ─────────────────────────────────────────────────────────────

describe("ShipmentService reads", () => {
  it("getShipment returns the shipment when found", async () => {
    mockRepo.findById.mockResolvedValue(buildShipment());
    const service = new ShipmentService(supabase);
    const result = await service.getShipment("ship-1");
    expect(result.success).toBe(true);
  });

  it("getShipment fails when not found", async () => {
    mockRepo.findById.mockResolvedValue(null);
    const service = new ShipmentService(supabase);
    const result = await service.getShipment("ship-x");
    expect(result).toMatchObject({
      success: false,
      error: { code: "not_found" },
    });
  });

  it("listShipments delegates to the repository", async () => {
    const page = { items: [], total: 0, page: 1, pageSize: 20 };
    mockRepo.listForOrg.mockResolvedValue(page);
    const service = new ShipmentService(supabase);
    const result = await service.listShipments(SHIPPER, { status: "pending" });
    expect(result).toBe(page);
    expect(mockRepo.listForOrg).toHaveBeenCalledWith(SHIPPER, {
      status: "pending",
    });
  });
});
