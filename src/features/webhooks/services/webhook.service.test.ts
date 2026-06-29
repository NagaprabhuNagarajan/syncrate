import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { WebhookEndpoint } from "@/features/webhooks/types/webhook.types";
import { WebhookService } from "./webhook.service";

// ─────────────────────────────────────────────────────────────
// Mock the repositories the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { endpointRepo, deliveryRepo } = vi.hoisted(() => ({
  endpointRepo: {
    listByOrg: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    findActiveForDispatch: vi.fn(),
    findByIdForDispatch: vi.fn(),
  },
  deliveryRepo: {
    listByEndpoint: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/features/webhooks/repositories/webhook.repository", () => ({
  WebhookEndpointRepository: vi.fn(() => endpointRepo),
  WebhookDeliveryRepository: vi.fn(() => deliveryRepo),
}));

const supabase = {} as AppSupabaseClient;

function buildEndpoint(
  overrides: Partial<WebhookEndpoint> = {}
): WebhookEndpoint {
  return {
    id: "ep-1",
    organizationId: "org-1",
    url: "https://example.com/hook",
    description: null,
    eventTypes: ["invoice.paid"],
    isActive: true,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    createdBy: "user-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WebhookService.createEndpoint", () => {
  it("generates a secret, stores it, and returns it exactly once", async () => {
    endpointRepo.create.mockImplementation((input) =>
      Promise.resolve(
        buildEndpoint({ url: input.url, eventTypes: input.event_types })
      )
    );

    const service = new WebhookService(supabase);
    const result = await service.createEndpoint(
      {
        url: "https://example.com/hook",
        description: "desc",
        eventTypes: ["invoice.paid", "invoice.created"],
      },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.secret).toMatch(/^whsec_[0-9a-f]{48}$/);

    const insert = endpointRepo.create.mock.calls[0]?.[0];
    // The persisted secret matches the one revealed to the caller.
    expect(insert.secret).toBe(result.data.secret);
    expect(insert.organization_id).toBe("org-1");
    expect(insert.created_by).toBe("user-1");
    expect(insert.is_active).toBe(true);
    expect(insert.event_types).toEqual(["invoice.paid", "invoice.created"]);

    // The returned endpoint never carries the secret.
    expect(result.data.endpoint).not.toHaveProperty("secret");
  });

  it("defaults is_active to true and de-duplicates event types", async () => {
    endpointRepo.create.mockResolvedValue(buildEndpoint());
    const service = new WebhookService(supabase);
    await service.createEndpoint(
      { url: "https://x.example.com", eventTypes: ["invoice.paid", "invoice.paid"] },
      "org-1",
      "user-1"
    );
    const insert = endpointRepo.create.mock.calls[0]?.[0];
    expect(insert.is_active).toBe(true);
    expect(insert.event_types).toEqual(["invoice.paid"]);
  });

  it("rejects an empty URL", async () => {
    const service = new WebhookService(supabase);
    const result = await service.createEndpoint(
      { url: "   ", eventTypes: ["invoice.paid"] },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(endpointRepo.create).not.toHaveBeenCalled();
  });

  it("rejects unknown event types", async () => {
    const service = new WebhookService(supabase);
    const result = await service.createEndpoint(
      { url: "https://x.example.com", eventTypes: ["not.a.real.event"] },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    expect(endpointRepo.create).not.toHaveBeenCalled();
  });

  it("rejects an empty event-type list", async () => {
    const service = new WebhookService(supabase);
    const result = await service.createEndpoint(
      { url: "https://x.example.com", eventTypes: [] },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    expect(endpointRepo.create).not.toHaveBeenCalled();
  });

  it("returns unknown when the repository fails to insert", async () => {
    endpointRepo.create.mockResolvedValue(null);
    const service = new WebhookService(supabase);
    const result = await service.createEndpoint(
      { url: "https://x.example.com", eventTypes: ["invoice.paid"] },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("WebhookService.updateEndpoint", () => {
  it("applies a patch with the optimistic-lock version", async () => {
    endpointRepo.findById.mockResolvedValue(buildEndpoint({ version: 3 }));
    endpointRepo.update.mockResolvedValue(
      buildEndpoint({ version: 4, isActive: false })
    );

    const service = new WebhookService(supabase);
    const result = await service.updateEndpoint(
      "ep-1",
      { isActive: false, version: 3 },
      "org-1",
      "user-1"
    );

    expect(result.success).toBe(true);
    expect(endpointRepo.update).toHaveBeenCalledWith(
      "ep-1",
      "org-1",
      { is_active: false },
      3,
      "user-1"
    );
  });

  it("returns not_found when the endpoint is missing", async () => {
    endpointRepo.findById.mockResolvedValue(null);
    const service = new WebhookService(supabase);
    const result = await service.updateEndpoint(
      "missing",
      { version: 1 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(endpointRepo.update).not.toHaveBeenCalled();
  });

  it("returns conflict when the version guard fails", async () => {
    endpointRepo.findById.mockResolvedValue(buildEndpoint({ version: 5 }));
    endpointRepo.update.mockResolvedValue(null);
    const service = new WebhookService(supabase);
    const result = await service.updateEndpoint(
      "ep-1",
      { isActive: false, version: 2 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("conflict");
    }
  });

  it("rejects unknown event types on update", async () => {
    endpointRepo.findById.mockResolvedValue(buildEndpoint());
    const service = new WebhookService(supabase);
    const result = await service.updateEndpoint(
      "ep-1",
      { eventTypes: ["bogus"], version: 1 },
      "org-1",
      "user-1"
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(endpointRepo.update).not.toHaveBeenCalled();
  });
});

describe("WebhookService.deleteEndpoint", () => {
  it("soft-deletes an existing endpoint", async () => {
    endpointRepo.findById.mockResolvedValue(buildEndpoint());
    endpointRepo.softDelete.mockResolvedValue(true);
    const service = new WebhookService(supabase);
    const result = await service.deleteEndpoint("ep-1", "org-1", "user-1");
    expect(result.success).toBe(true);
    expect(endpointRepo.softDelete).toHaveBeenCalledWith(
      "ep-1",
      "org-1",
      "user-1"
    );
  });

  it("returns not_found for an unknown endpoint", async () => {
    endpointRepo.findById.mockResolvedValue(null);
    const service = new WebhookService(supabase);
    const result = await service.deleteEndpoint("missing", "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(endpointRepo.softDelete).not.toHaveBeenCalled();
  });

  it("returns unknown when the soft-delete fails", async () => {
    endpointRepo.findById.mockResolvedValue(buildEndpoint());
    endpointRepo.softDelete.mockResolvedValue(false);
    const service = new WebhookService(supabase);
    const result = await service.deleteEndpoint("ep-1", "org-1", "user-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("unknown");
    }
  });
});

describe("WebhookService reads", () => {
  it("lists endpoints via the repository", async () => {
    const endpoints = [buildEndpoint()];
    endpointRepo.listByOrg.mockResolvedValue(endpoints);
    const service = new WebhookService(supabase);
    expect(await service.listEndpoints("org-1")).toBe(endpoints);
    expect(endpointRepo.listByOrg).toHaveBeenCalledWith("org-1");
  });

  it("lists deliveries via the repository", async () => {
    deliveryRepo.listByEndpoint.mockResolvedValue([]);
    const service = new WebhookService(supabase);
    await service.listDeliveries("ep-1", "org-1", 10);
    expect(deliveryRepo.listByEndpoint).toHaveBeenCalledWith(
      "ep-1",
      "org-1",
      10
    );
  });

  it("returns not_found from getEndpoint when missing", async () => {
    endpointRepo.findById.mockResolvedValue(null);
    const service = new WebhookService(supabase);
    const result = await service.getEndpoint("missing", "org-1");
    expect(result.success).toBe(false);
  });
});
