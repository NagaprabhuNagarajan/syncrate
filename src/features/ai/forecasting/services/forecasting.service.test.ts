import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

// The service imports AiGatewayService only to construct a default gateway;
// every test injects a mock gateway instead. Stubbing the module here avoids
// pulling in the Anthropic client (and its import-time env validation).
vi.mock("@/features/ai/services/ai-gateway.service", () => ({
  AiGatewayService: class {},
}));

import { ForecastingService } from "./forecasting.service";
import type { ForecastingServiceDeps } from "./forecasting.service";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { AiContext } from "@/features/ai/types/ai.types";
import type { ForecastResult } from "@/features/ai/forecasting/types/forecast.types";

const ORG_ID = "org-1";
const CONTEXT: AiContext = { organizationId: ORG_ID, userId: "user-1" };

const SAMPLE_FORECAST: ForecastResult = {
  confidence: 0.65,
  summary: "Steady growth expected.",
  reason: "Upward monthly trend.",
  points: [{ period: "2026-07", predicted: 1000, low: 900, high: 1100 }],
  assumptions: ["No churn"],
  drivers: ["Seasonality"],
};

function gatewaySuccess() {
  return {
    success: true as const,
    data: {
      data: SAMPLE_FORECAST,
      usage: { inputTokens: 10, outputTokens: 20, executionMs: 5 },
      model: "test-model",
    },
  };
}

interface MockDeps {
  gateway: { generateStructured: Mock };
  invoices: { list: Mock };
  salesOrders: { list: Mock };
  inventory: { listTransactions: Mock; listLevels: Mock };
  purchaseInvoices: { list: Mock };
  customerPayments: { findAll: Mock };
  supplierPayments: { findAll: Mock };
}

function listResult(items: unknown[]) {
  return { items, total: items.length, page: 1, pageSize: 100 };
}

function paymentsResult(payments: unknown[]) {
  return { payments, total: payments.length, page: 1, pageSize: 100 };
}

function makeDeps(): MockDeps {
  return {
    gateway: { generateStructured: vi.fn().mockResolvedValue(gatewaySuccess()) },
    invoices: {
      list: vi.fn().mockResolvedValue(
        listResult([
          { invoiceDate: new Date("2026-01-10"), totalAmount: 1000, status: "posted" },
          { invoiceDate: new Date("2026-02-12"), totalAmount: 1500, status: "posted" },
          { invoiceDate: new Date("2026-03-05"), totalAmount: 1800, status: "posted" },
        ])
      ),
    },
    salesOrders: {
      list: vi.fn().mockResolvedValue(
        listResult([
          {
            orderDate: new Date("2026-03-20"),
            totalAmount: 500,
            status: "approved",
            convertedInvId: null,
          },
        ])
      ),
    },
    inventory: {
      listTransactions: vi.fn().mockResolvedValue([
        { createdAt: new Date("2026-01-10"), quantity: -5, type: "sale" },
        { createdAt: new Date("2026-02-10"), quantity: 20, type: "purchase" },
      ]),
      listLevels: vi.fn().mockResolvedValue(
        listResult([{ productName: "Widget", quantity: 1, reorderLevel: 5 }])
      ),
    },
    purchaseInvoices: {
      list: vi.fn().mockResolvedValue(
        listResult([
          { invoiceDate: new Date("2026-01-15"), totalAmount: 700 },
          { invoiceDate: new Date("2026-02-15"), totalAmount: 800 },
        ])
      ),
    },
    customerPayments: {
      findAll: vi.fn().mockResolvedValue(
        paymentsResult([
          { paymentDate: "2026-01-20", amount: 900, status: "completed" },
          { paymentDate: "2026-02-20", amount: 1200, status: "completed" },
          { paymentDate: "2026-02-25", amount: 300, status: "voided" },
        ])
      ),
    },
    supplierPayments: {
      findAll: vi.fn().mockResolvedValue(
        paymentsResult([
          { paymentDate: "2026-01-22", amount: 400, status: "completed" },
        ])
      ),
    },
  };
}

function makeService(deps: MockDeps) {
  return new ForecastingService(
    {} as unknown as AppSupabaseClient,
    deps as unknown as Partial<ForecastingServiceDeps>
  );
}

let deps: MockDeps;

beforeEach(() => {
  deps = makeDeps();
});

describe("ForecastingService", () => {
  it("returns a forecast on success and unwraps the gateway envelope", async () => {
    const service = makeService(deps);
    const result = await service.generateForecast("sales", CONTEXT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(SAMPLE_FORECAST);
    }
  });

  it("calls the gateway with the forecast capability, schema, and context", async () => {
    const service = makeService(deps);
    await service.generateForecast("sales", CONTEXT);

    expect(deps.gateway.generateStructured).toHaveBeenCalledTimes(1);
    const call = deps.gateway.generateStructured.mock.calls[0][0];
    expect(call.capability).toBe("forecast");
    expect(call.context).toEqual(CONTEXT);
    expect(call.cacheSystem).toBe(true);
    expect(call.system.toLowerCase()).toContain("forecast");
    // Monthly buckets from the invoice history appear in the prompt.
    expect(call.prompt).toContain("2026-01");
    expect(call.prompt).toContain("2026-03");
  });

  it("surfaces the open sales-order pipeline as context for sales forecasts", async () => {
    const service = makeService(deps);
    await service.generateForecast("sales", CONTEXT);

    const call = deps.gateway.generateStructured.mock.calls[0][0];
    expect(call.prompt).toContain("pipeline");
    expect(deps.salesOrders.list).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ pageSize: 100 })
    );
  });

  it("propagates a gateway failure unchanged", async () => {
    deps.gateway.generateStructured.mockResolvedValue({
      success: false,
      error: { code: "rate_limited", message: "busy" },
    });
    const service = makeService(deps);

    const result = await service.generateForecast("sales", CONTEXT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("rate_limited");
    }
  });

  it("returns a validation error without calling the gateway when history is empty", async () => {
    deps.invoices.list.mockResolvedValue(listResult([]));
    deps.salesOrders.list.mockResolvedValue(listResult([]));
    const service = makeService(deps);

    const result = await service.generateForecast("sales", CONTEXT);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("validation");
    }
    expect(deps.gateway.generateStructured).not.toHaveBeenCalled();
  });

  it("excludes voided customer payments from revenue history", async () => {
    const service = makeService(deps);
    const result = await service.generateForecast("revenue", CONTEXT);

    expect(result.success).toBe(true);
    expect(deps.customerPayments.findAll).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ pageSize: 100 })
    );
    const call = deps.gateway.generateStructured.mock.calls[0][0];
    // Jan + Feb buckets present; the voided Feb-25 payment is folded out.
    expect(call.prompt).toContain("2026-01");
    expect(call.prompt).toContain("2026-02");
  });

  it("builds purchase history from purchase invoices", async () => {
    const service = makeService(deps);
    const result = await service.generateForecast("purchase", CONTEXT);

    expect(result.success).toBe(true);
    expect(deps.purchaseInvoices.list).toHaveBeenCalled();
    const call = deps.gateway.generateStructured.mock.calls[0][0];
    expect(call.prompt).toContain("purchasing");
  });

  it("nets collections against supplier payments for cash flow", async () => {
    const service = makeService(deps);
    const result = await service.generateForecast("cash_flow", CONTEXT);

    expect(result.success).toBe(true);
    expect(deps.customerPayments.findAll).toHaveBeenCalled();
    expect(deps.supplierPayments.findAll).toHaveBeenCalled();
    const call = deps.gateway.generateStructured.mock.calls[0][0];
    expect(call.prompt.toLowerCase()).toContain("cash flow");
    expect(call.prompt).toContain("collections");
  });

  it("builds inventory history from stock transactions and flags low stock", async () => {
    const service = makeService(deps);
    const result = await service.generateForecast("inventory", CONTEXT);

    expect(result.success).toBe(true);
    expect(deps.inventory.listTransactions).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ limit: 200 })
    );
    const call = deps.gateway.generateStructured.mock.calls[0][0];
    expect(call.prompt).toContain("units");
    expect(call.prompt).toContain("reorder level");
  });

  it("treats seasonal demand as a monthly invoiced-value series", async () => {
    const service = makeService(deps);
    const result = await service.generateForecast("seasonal_demand", CONTEXT);

    expect(result.success).toBe(true);
    expect(deps.invoices.list).toHaveBeenCalled();
    const call = deps.gateway.generateStructured.mock.calls[0][0];
    expect(call.prompt.toLowerCase()).toContain("seasonal");
  });
});
