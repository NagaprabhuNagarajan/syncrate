import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AiGatewayService } from "@/features/ai/services/ai-gateway.service";
import type { AiContext } from "@/features/ai/types/ai.types";
import { ProductService } from "@/features/product/services/product.service";
import { InventoryService } from "@/features/inventory/services/inventory.service";
import { SupplierService } from "@/features/supplier/services/supplier.service";
import { CustomerService } from "@/features/customer/services/customer.service";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import type { Product } from "@/features/product/types/product.types";
import type { InvoiceListItem } from "@/features/sales/types/invoice.types";
import type { Supplier } from "@/features/supplier/types/supplier.types";
import { insightOutputSchema } from "../schemas/insight.schema";
import type {
  InsightServiceResult,
  InsightSnapshot,
  MonthlyRevenue,
} from "../types/insight.types";

/**
 * AI Business-Intelligence Insights (spec §13).
 *
 * Continuously-analyzable signals — revenue growth, declining sales,
 * slow-moving inventory, customer churn risk, supplier performance, and
 * profitability trends — distilled from existing domain services into a
 * compact snapshot and turned into explainable insights by the gateway.
 */

const SAMPLE_SIZE = 100;
const TOP_N = 20;
/** A customer with no posted invoice within this window is "at churn risk". */
const CHURN_WINDOW_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `You are Syncrate's Business-Intelligence engine for small and medium businesses.
You receive a compact JSON snapshot of a single tenant's recent performance.
Produce concise, decision-grade insights across these categories only:
- revenue_growth, declining_sales, slow_moving_inventory,
  customer_churn_risk, supplier_performance, profitability_trend.

Strict rules:
- Ground EVERY insight in the figures provided. Never invent data.
- Each insight needs a title, a plain-language explanation, a trend
  (up/down/flat), a severity (positive/info/warning/critical), a confidence,
  and a single headline metric with its value and percent change where known.
- Set confidence honestly: lower it when the snapshot is sparse.
- Order insights by importance (most material first).
- If the snapshot is essentially empty, return an empty insights array with a
  low overall confidence and a summary noting there is not enough data yet.`;

export class InsightService {
  private readonly gateway: AiGatewayService;
  private readonly products: ProductService;
  private readonly inventory: InventoryService;
  private readonly suppliers: SupplierService;
  private readonly customers: CustomerService;
  private readonly invoices: InvoiceService;

  constructor(supabase: AppSupabaseClient) {
    this.gateway = new AiGatewayService(supabase);
    this.products = new ProductService(supabase);
    this.inventory = new InventoryService(supabase);
    this.suppliers = new SupplierService(supabase);
    this.customers = new CustomerService(supabase);
    this.invoices = new InvoiceService(supabase);
  }

  /** Gathers a compact BI snapshot. Public for independent unit testing. */
  async gatherSnapshot(
    organizationId: string,
    currency = "INR",
    now: Date = new Date()
  ): Promise<InsightSnapshot> {
    const [products, lowStock, suppliers, customers, invoices, inventoryValue] =
      await Promise.all([
        this.products.listProducts(organizationId, {
          status: "active",
          pageSize: SAMPLE_SIZE,
        }),
        this.inventory.listLevels(organizationId, {
          lowStockOnly: true,
          pageSize: SAMPLE_SIZE,
        }),
        this.suppliers.listSuppliers(organizationId, {
          status: "active",
          pageSize: SAMPLE_SIZE,
        }),
        this.customers.listCustomers(organizationId, { pageSize: SAMPLE_SIZE }),
        this.invoices.listInvoices(organizationId, {
          status: "posted",
          pageSize: SAMPLE_SIZE,
          sortBy: "invoice_date",
          sortDir: "desc",
        }),
        this.inventory.getStockValue(organizationId),
      ]);

    let totalRevenue = 0;
    let outstandingAmount = 0;
    let overdueInvoiceCount = 0;
    for (const invoice of invoices.items) {
      totalRevenue += invoice.totalAmount;
      outstandingAmount += invoice.totalAmount - invoice.amountPaid;
      if (invoice.paymentStatus === "overdue") {
        overdueInvoiceCount += 1;
      }
    }

    const slowMoving = products.items.filter((p) => p.isSlowMoving);
    const slowMovingProducts = slowMoving.slice(0, TOP_N).map((p) => ({
      code: p.code,
      name: p.name,
      sellingPrice: p.sellingPrice,
      purchasePrice: p.purchasePrice,
    }));

    return {
      currency,
      monthlyRevenue: this.aggregateMonthlyRevenue(invoices.items),
      totalRevenue: round2(totalRevenue),
      outstandingAmount: round2(outstandingAmount),
      overdueInvoiceCount,
      inventoryValue: round2(inventoryValue),
      lowStockCount: lowStock.items.length,
      slowMovingCount: slowMoving.length,
      slowMovingProducts,
      avgGrossMarginPercent: this.averageMargin(products.items),
      customerCount: customers.total,
      inactiveCustomerCount: this.countChurnRisk(invoices.items, now),
      supplierCount: suppliers.total,
      avgSupplierRating: this.averageRating(suppliers.items),
    };
  }

  /** Builds the snapshot and asks the gateway for structured insights. */
  async generate(context: AiContext): Promise<InsightServiceResult> {
    const snapshot = await this.gatherSnapshot(context.organizationId);

    const result = await this.gateway.generateStructured({
      capability: "insight",
      context,
      system: SYSTEM_PROMPT,
      prompt: this.buildPrompt(snapshot),
      schema: insightOutputSchema,
      cacheSystem: true,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: result.data.data };
  }

  private buildPrompt(snapshot: InsightSnapshot): string {
    return [
      "Here is the recent business performance snapshot (all monetary values",
      `are in ${snapshot.currency}). Generate insights grounded only in these`,
      "figures. monthlyRevenue is ordered oldest-to-newest:",
      "",
      JSON.stringify(snapshot, null, 2),
    ].join("\n");
  }

  private aggregateMonthlyRevenue(
    invoices: readonly InvoiceListItem[]
  ): readonly MonthlyRevenue[] {
    const byMonth = new Map<string, { revenue: number; count: number }>();
    for (const invoice of invoices) {
      const month = invoice.invoiceDate.toISOString().slice(0, 7);
      const existing = byMonth.get(month) ?? { revenue: 0, count: 0 };
      existing.revenue += invoice.totalAmount;
      existing.count += 1;
      byMonth.set(month, existing);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        month,
        revenue: round2(value.revenue),
        invoiceCount: value.count,
      }));
  }

  private averageMargin(products: readonly Product[]): number | null {
    const margins: number[] = [];
    for (const product of products) {
      if (product.sellingPrice > 0) {
        margins.push(
          ((product.sellingPrice - product.purchasePrice) /
            product.sellingPrice) *
            100
        );
      }
    }
    if (margins.length === 0) {
      return null;
    }
    const sum = margins.reduce((acc, value) => acc + value, 0);
    return round2(sum / margins.length);
  }

  private averageRating(suppliers: readonly Supplier[]): number | null {
    const ratings = suppliers
      .map((s) => s.rating)
      .filter((rating): rating is number => rating !== null);
    if (ratings.length === 0) {
      return null;
    }
    const sum = ratings.reduce((acc, value) => acc + value, 0);
    return round2(sum / ratings.length);
  }

  /** Customers whose most recent posted invoice predates the churn window. */
  private countChurnRisk(
    invoices: readonly InvoiceListItem[],
    now: Date
  ): number {
    const lastByCustomer = new Map<string, number>();
    for (const invoice of invoices) {
      const ts = invoice.invoiceDate.getTime();
      const existing = lastByCustomer.get(invoice.customerId);
      if (existing === undefined || ts > existing) {
        lastByCustomer.set(invoice.customerId, ts);
      }
    }
    const cutoff = now.getTime() - CHURN_WINDOW_DAYS * MS_PER_DAY;
    let count = 0;
    for (const lastTs of lastByCustomer.values()) {
      if (lastTs < cutoff) {
        count += 1;
      }
    }
    return count;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
