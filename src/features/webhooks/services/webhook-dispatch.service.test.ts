import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { WebhookEndpointWithSecret } from "@/features/webhooks/types/webhook.types";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  EVENT_HEADER,
} from "@/features/webhooks/utils/signing";
import { WebhookDispatchService } from "./webhook-dispatch.service";

// ─────────────────────────────────────────────────────────────
// Mock the repositories the service instantiates internally
// ─────────────────────────────────────────────────────────────

const { endpointRepo, deliveryRepo } = vi.hoisted(() => ({
  endpointRepo: {
    findActiveForDispatch: vi.fn(),
    findByIdForDispatch: vi.fn(),
  },
  deliveryRepo: {
    create: vi.fn(),
    listByEndpoint: vi.fn(),
  },
}));

vi.mock("@/features/webhooks/repositories/webhook.repository", () => ({
  WebhookEndpointRepository: vi.fn(() => endpointRepo),
  WebhookDeliveryRepository: vi.fn(() => deliveryRepo),
}));

const supabase = {} as AppSupabaseClient;

function buildEndpoint(
  overrides: Partial<WebhookEndpointWithSecret> = {}
): WebhookEndpointWithSecret {
  return {
    id: "ep-1",
    organizationId: "org-1",
    url: "https://example.com/hook",
    secret: "whsec_test",
    eventTypes: ["invoice.paid"],
    isActive: true,
    ...overrides,
  };
}

// fetch responses
function okResponse(status = 200) {
  return { ok: true, status } as Response;
}
function errResponse(status = 500) {
  return { ok: false, status } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  // The delivery repo echoes the insert back as a mapped delivery.
  deliveryRepo.create.mockImplementation((input) =>
    Promise.resolve({
      id: "del-1",
      organizationId: input.organization_id,
      endpointId: input.endpoint_id,
      eventType: input.event_type,
      status: input.status,
      attempts: input.attempts,
      responseStatus: input.response_status,
      error: input.error,
      createdAt: new Date(),
      deliveredAt: input.delivered_at ? new Date(input.delivered_at) : null,
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebhookDispatchService.dispatch", () => {
  it("signs and POSTs to a subscribed active endpoint and records success", async () => {
    endpointRepo.findActiveForDispatch.mockResolvedValue([buildEndpoint()]);
    const fetchMock = vi.fn().mockResolvedValue(okResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const service = new WebhookDispatchService(supabase);
    const summary = await service.dispatch({
      organizationId: "org-1",
      eventType: "invoice.paid",
      payload: { invoiceId: "inv-1" },
    });

    expect(summary.dispatched).toBe(1);
    expect(summary.deliveries).toHaveLength(1);

    // fetch called once with a signed POST.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/hook");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers[SIGNATURE_HEADER]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(headers[TIMESTAMP_HEADER]).toMatch(/^\d+$/);
    expect(headers[EVENT_HEADER]).toBe("invoice.paid");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      event: "invoice.paid",
      data: { invoiceId: "inv-1" },
    });

    // Recorded as a success.
    const insert = deliveryRepo.create.mock.calls[0]?.[0];
    expect(insert.status).toBe("success");
    expect(insert.attempts).toBe(1);
    expect(insert.response_status).toBe(200);
    expect(insert.error).toBeNull();
    expect(insert.delivered_at).not.toBeNull();
  });

  it("records a failure after exhausting retries on non-2xx responses", async () => {
    endpointRepo.findActiveForDispatch.mockResolvedValue([buildEndpoint()]);
    const fetchMock = vi.fn().mockResolvedValue(errResponse(500));
    vi.stubGlobal("fetch", fetchMock);

    const service = new WebhookDispatchService(supabase);
    await service.dispatch({
      organizationId: "org-1",
      eventType: "invoice.paid",
      payload: {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const insert = deliveryRepo.create.mock.calls[0]?.[0];
    expect(insert.status).toBe("failed");
    expect(insert.attempts).toBe(3);
    expect(insert.response_status).toBe(500);
    expect(insert.error).toContain("500");
    expect(insert.delivered_at).toBeNull();
  });

  it("records a failure when the network request throws", async () => {
    endpointRepo.findActiveForDispatch.mockResolvedValue([buildEndpoint()]);
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const service = new WebhookDispatchService(supabase);
    await service.dispatch({
      organizationId: "org-1",
      eventType: "invoice.paid",
      payload: {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const insert = deliveryRepo.create.mock.calls[0]?.[0];
    expect(insert.status).toBe("failed");
    expect(insert.attempts).toBe(3);
    expect(insert.response_status).toBeNull();
    expect(insert.error).toBe("ECONNREFUSED");
  });

  it("retries and succeeds on a later attempt", async () => {
    endpointRepo.findActiveForDispatch.mockResolvedValue([buildEndpoint()]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errResponse(503))
      .mockResolvedValueOnce(okResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const service = new WebhookDispatchService(supabase);
    await service.dispatch({
      organizationId: "org-1",
      eventType: "invoice.paid",
      payload: {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const insert = deliveryRepo.create.mock.calls[0]?.[0];
    expect(insert.status).toBe("success");
    expect(insert.attempts).toBe(2);
    expect(insert.response_status).toBe(200);
  });

  it("skips delivery when no active subscribed endpoint exists", async () => {
    endpointRepo.findActiveForDispatch.mockResolvedValue([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const service = new WebhookDispatchService(supabase);
    const summary = await service.dispatch({
      organizationId: "org-1",
      eventType: "invoice.paid",
      payload: {},
    });

    expect(summary.dispatched).toBe(0);
    expect(summary.deliveries).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(deliveryRepo.create).not.toHaveBeenCalled();
  });

  it("delivers to every matching endpoint", async () => {
    endpointRepo.findActiveForDispatch.mockResolvedValue([
      buildEndpoint({ id: "ep-1", url: "https://a.example.com" }),
      buildEndpoint({ id: "ep-2", url: "https://b.example.com" }),
    ]);
    const fetchMock = vi.fn().mockResolvedValue(okResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const service = new WebhookDispatchService(supabase);
    const summary = await service.dispatch({
      organizationId: "org-1",
      eventType: "invoice.paid",
      payload: {},
    });

    expect(summary.dispatched).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(deliveryRepo.create).toHaveBeenCalledTimes(2);
  });
});

describe("WebhookDispatchService.sendTestEvent", () => {
  it("delivers a synthetic test event to a single endpoint", async () => {
    endpointRepo.findByIdForDispatch.mockResolvedValue(buildEndpoint());
    const fetchMock = vi.fn().mockResolvedValue(okResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const service = new WebhookDispatchService(supabase);
    const result = await service.sendTestEvent("ep-1", "org-1");

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers[EVENT_HEADER]).toBe("webhook.test");
    const insert = deliveryRepo.create.mock.calls[0]?.[0];
    expect(insert.event_type).toBe("webhook.test");
    expect(insert.status).toBe("success");
  });

  it("returns not_found when the endpoint does not exist", async () => {
    endpointRepo.findByIdForDispatch.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const service = new WebhookDispatchService(supabase);
    const result = await service.sendTestEvent("missing", "org-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("not_found");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
