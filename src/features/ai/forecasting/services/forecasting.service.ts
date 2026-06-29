import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AiGatewayService } from "@/features/ai/services/ai-gateway.service";
import type { AiContext, AiResult } from "@/features/ai/types/ai.types";
import { InvoiceRepository } from "@/features/sales/repositories/invoice.repository";
import { SalesOrderRepository } from "@/features/sales/repositories/sales-order.repository";
import { InventoryRepository } from "@/features/inventory/repositories/inventory.repository";
import { PurchaseInvoiceRepository } from "@/features/purchase/repositories/purchase-invoice.repository";
import { CustomerPaymentRepository } from "@/features/payment/repositories/customer-payment.repository";
import { SupplierPaymentRepository } from "@/features/payment/repositories/supplier-payment.repository";
import { forecastResultSchema } from "@/features/ai/forecasting/schemas/forecastSchema";
import type {
  ForecastHistory,
  ForecastResult,
  ForecastType,
  HistoryPoint,
} from "@/features/ai/forecasting/types/forecast.types";

/**
 * AI Forecasting service (spec §8).
 *
 * Gathers recent, tenant-scoped historical data from existing business
 * repositories, condenses it into a compact monthly series, and asks the AI
 * Gateway for a structured, explained projection. The gateway owns auditing,
 * timing, and error mapping — this service owns *what* historical data feeds
 * each forecast and *how* the ask is framed.
 */

/** How many recent records to pull per source (kept small for a compact prompt). */
const HISTORY_PAGE_SIZE = 100;
/** How many recent inventory ledger rows to scan. */
const TX_LIMIT = 200;
/** How many trailing months of history to surface to the model. */
const MAX_MONTHS = 12;
/** How many future periods to ask the model to project. */
const FORECAST_HORIZON = 6;

const SYSTEM_PROMPT = [
  "You are a senior business forecasting analyst for Syncrate, an operations",
  "platform for small and medium enterprises. You are given a compact summary",
  "of a tenant's recent historical business data as a monthly series. Produce a",
  "realistic forward-looking forecast grounded ONLY in the data provided.",
  "Extrapolate trend and any visible seasonality; never invent figures beyond",
  "what the history supports. Always return a calibrated overall confidence",
  "between 0 and 1 (lower it when history is short or volatile), a concise",
  "plain-language summary, the reasoning behind the projection, the key",
  "assumptions it depends on, and the main drivers of the trend. Currency",
  "amounts are in Indian Rupees (INR).",
].join(" ");

const FORECAST_LABELS: Record<ForecastType, string> = {
  sales: "monthly sales (gross invoiced value)",
  inventory: "monthly net inventory movement (units)",
  purchase: "monthly purchasing spend",
  revenue: "monthly revenue collected from customers",
  cash_flow: "monthly net cash flow (collections minus supplier payments)",
  seasonal_demand: "seasonal demand pattern (monthly invoiced value)",
};

/**
 * Injectable collaborators. Defaults are constructed from the Supabase client;
 * tests pass lightweight mocks. Only the methods this service actually calls
 * are required (structural typing keeps the surface minimal).
 */
export interface ForecastingServiceDeps {
  readonly gateway: Pick<AiGatewayService, "generateStructured">;
  readonly invoices: Pick<InvoiceRepository, "list">;
  readonly salesOrders: Pick<SalesOrderRepository, "list">;
  readonly inventory: Pick<
    InventoryRepository,
    "listTransactions" | "listLevels"
  >;
  readonly purchaseInvoices: Pick<PurchaseInvoiceRepository, "list">;
  readonly customerPayments: Pick<CustomerPaymentRepository, "findAll">;
  readonly supplierPayments: Pick<SupplierPaymentRepository, "findAll">;
}

function fmtInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Extracts the "YYYY-MM" bucket from a Date or ISO date string. */
function monthKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Buckets `{ date, value }` records into a chronologically-ordered monthly
 * series, summing values per month and keeping only the trailing months.
 */
function toMonthlySeries(
  records: ReadonlyArray<{ date: Date | string; value: number }>
): HistoryPoint[] {
  const buckets = new Map<string, number>();
  for (const { date, value } of records) {
    const key = monthKey(date);
    if (key === "unknown") {
      continue;
    }
    buckets.set(key, (buckets.get(key) ?? 0) + value);
  }
  return [...buckets.entries()]
    .map(([period, value]) => ({ period, value }))
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-MAX_MONTHS);
}

export class ForecastingService {
  private readonly gateway: ForecastingServiceDeps["gateway"];
  private readonly invoices: ForecastingServiceDeps["invoices"];
  private readonly salesOrders: ForecastingServiceDeps["salesOrders"];
  private readonly inventory: ForecastingServiceDeps["inventory"];
  private readonly purchaseInvoices: ForecastingServiceDeps["purchaseInvoices"];
  private readonly customerPayments: ForecastingServiceDeps["customerPayments"];
  private readonly supplierPayments: ForecastingServiceDeps["supplierPayments"];

  constructor(
    supabase: AppSupabaseClient,
    deps: Partial<ForecastingServiceDeps> = {}
  ) {
    this.gateway = deps.gateway ?? new AiGatewayService(supabase);
    this.invoices = deps.invoices ?? new InvoiceRepository(supabase);
    this.salesOrders = deps.salesOrders ?? new SalesOrderRepository(supabase);
    this.inventory = deps.inventory ?? new InventoryRepository(supabase);
    this.purchaseInvoices =
      deps.purchaseInvoices ?? new PurchaseInvoiceRepository(supabase);
    this.customerPayments =
      deps.customerPayments ?? new CustomerPaymentRepository(supabase);
    this.supplierPayments =
      deps.supplierPayments ?? new SupplierPaymentRepository(supabase);
  }

  /**
   * Generates a structured, explained forecast of the requested type for an
   * organization. Returns a validation error (without calling the model) when
   * there is not enough history to forecast from.
   */
  async generateForecast(
    forecastType: ForecastType,
    context: AiContext
  ): Promise<AiResult<ForecastResult>> {
    const history = await this.gatherHistory(forecastType, context.organizationId);

    if (history.series.length === 0) {
      return {
        success: false,
        error: {
          code: "validation",
          message:
            "Not enough historical data to generate a forecast. Record some business activity first.",
        },
      };
    }

    const result = await this.gateway.generateStructured({
      capability: "forecast",
      context,
      system: SYSTEM_PROMPT,
      prompt: this.buildPrompt(forecastType, history),
      schema: forecastResultSchema,
      cacheSystem: true,
    });

    if (!result.success) {
      return result;
    }
    return { success: true, data: result.data.data };
  }

  // ── prompt assembly ─────────────────────────────────────────────

  private buildPrompt(
    forecastType: ForecastType,
    history: ForecastHistory
  ): string {
    const seriesLines = history.series
      .map((point) => `  ${point.period}: ${point.value}`)
      .join("\n");

    const lines = [
      `Forecast target: ${FORECAST_LABELS[forecastType]}.`,
      `Series unit: ${history.unit}.`,
      `Horizon: project the next ${FORECAST_HORIZON} months beyond the latest period.`,
      "",
      "Historical monthly series (period: value, oldest first):",
      seriesLines,
    ];

    if (history.context.length > 0) {
      lines.push("", "Additional context:");
      for (const line of history.context) {
        lines.push(`  - ${line}`);
      }
    }

    lines.push(
      "",
      `Produce ${FORECAST_HORIZON} forecast points (one per future month), each`,
      "with a period label, predicted value, and a low/high range where you can",
      "bound it (use null otherwise). Express monetary values in the same unit."
    );

    return lines.join("\n");
  }

  // ── historical data gathering (real repositories, tenant-scoped) ──

  private async gatherHistory(
    forecastType: ForecastType,
    organizationId: string
  ): Promise<ForecastHistory> {
    switch (forecastType) {
      case "sales":
      case "seasonal_demand":
        return this.salesHistory(organizationId);
      case "revenue":
        return this.revenueHistory(organizationId);
      case "purchase":
        return this.purchaseHistory(organizationId);
      case "cash_flow":
        return this.cashFlowHistory(organizationId);
      case "inventory":
        return this.inventoryHistory(organizationId);
      default:
        return { unit: "INR", series: [], context: [] };
    }
  }

  private async salesHistory(organizationId: string): Promise<ForecastHistory> {
    const [invoiceResult, soResult] = await Promise.all([
      this.invoices.list(organizationId, {
        pageSize: HISTORY_PAGE_SIZE,
        sortBy: "invoice_date",
        sortDir: "asc",
      }),
      this.salesOrders.list(organizationId, {
        pageSize: HISTORY_PAGE_SIZE,
        sortDir: "desc",
      }),
    ]);

    const series = toMonthlySeries(
      invoiceResult.items.map((inv) => ({
        date: inv.invoiceDate,
        value: inv.totalAmount,
      }))
    );

    const context: string[] = [];
    const openOrders = soResult.items.filter(
      (so) => so.status !== "cancelled" && so.convertedInvId === null
    );
    if (openOrders.length > 0) {
      const pipeline = openOrders.reduce((sum, so) => sum + so.totalAmount, 0);
      context.push(
        `Open sales-order pipeline: ${openOrders.length} orders worth ${fmtInr(pipeline)}.`
      );
    }

    return { unit: "INR", series, context };
  }

  private async revenueHistory(
    organizationId: string
  ): Promise<ForecastHistory> {
    const result = await this.customerPayments.findAll(organizationId, {
      pageSize: HISTORY_PAGE_SIZE,
    });
    const collected = result.payments.filter((p) => p.status !== "voided");
    const series = toMonthlySeries(
      collected.map((p) => ({ date: p.paymentDate, value: p.amount }))
    );
    return { unit: "INR", series, context: [] };
  }

  private async purchaseHistory(
    organizationId: string
  ): Promise<ForecastHistory> {
    const result = await this.purchaseInvoices.list(organizationId, {
      pageSize: HISTORY_PAGE_SIZE,
      sortBy: "invoice_date",
      sortDir: "asc",
    });
    const series = toMonthlySeries(
      result.items.map((inv) => ({
        date: inv.invoiceDate,
        value: inv.totalAmount,
      }))
    );
    return { unit: "INR", series, context: [] };
  }

  private async cashFlowHistory(
    organizationId: string
  ): Promise<ForecastHistory> {
    const [inflow, outflow] = await Promise.all([
      this.customerPayments.findAll(organizationId, {
        pageSize: HISTORY_PAGE_SIZE,
      }),
      this.supplierPayments.findAll(organizationId, {
        pageSize: HISTORY_PAGE_SIZE,
      }),
    ]);

    const inRecords = inflow.payments
      .filter((p) => p.status !== "voided")
      .map((p) => ({ date: p.paymentDate, value: p.amount }));
    const outRecords = outflow.payments
      .filter((p) => p.status !== "voided")
      .map((p) => ({ date: p.paymentDate, value: -p.amount }));

    const series = toMonthlySeries([...inRecords, ...outRecords]);

    const totalIn = inRecords.reduce((sum, r) => sum + r.value, 0);
    const totalOut = outRecords.reduce((sum, r) => sum - r.value, 0);
    const context = [
      `Total recent collections: ${fmtInr(totalIn)}.`,
      `Total recent supplier payments: ${fmtInr(totalOut)}.`,
    ];

    return { unit: "INR", series, context };
  }

  private async inventoryHistory(
    organizationId: string
  ): Promise<ForecastHistory> {
    const [transactions, lowStock] = await Promise.all([
      this.inventory.listTransactions(organizationId, { limit: TX_LIMIT }),
      this.inventory.listLevels(organizationId, {
        lowStockOnly: true,
        pageSize: HISTORY_PAGE_SIZE,
      }),
    ]);

    const series = toMonthlySeries(
      transactions.map((tx) => ({ date: tx.createdAt, value: tx.quantity }))
    );

    const context: string[] = [];
    if (lowStock.items.length > 0) {
      context.push(
        `${lowStock.items.length} product(s) are currently at or below reorder level.`
      );
    }

    return { unit: "units", series, context };
  }
}
