import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AiGatewayService } from "@/features/ai/services/ai-gateway.service";
import type { AiContext } from "@/features/ai/types/ai.types";
import { ProductService } from "@/features/product/services/product.service";
import { InventoryService } from "@/features/inventory/services/inventory.service";
import { SupplierService } from "@/features/supplier/services/supplier.service";
import { CustomerService } from "@/features/customer/services/customer.service";
import { InvoiceService } from "@/features/sales/services/invoice.service";
import type { InvoiceListItem } from "@/features/sales/types/invoice.types";
import { recommendationOutputSchema } from "../schemas/recommendation.schema";
import type {
  CustomerActivitySummary,
  RecommendationResult,
  RecommendationSnapshot,
} from "../types/recommendation.types";

/**
 * The AI Recommendation Engine (spec §9).
 *
 * Distills compact, tenant-scoped aggregates from existing domain services
 * (products, inventory, suppliers, customers, invoices), serializes them into
 * a prompt, and asks the gateway for structured, explainable recommendations.
 * Every recommendation carries a confidence, a reason, and the supporting
 * figures — the engine never invents business logic, it surfaces decisions.
 */

/** How many records to pull per domain to keep the prompt compact. */
const SAMPLE_SIZE = 100;
/** How many distilled items to actually send the model. */
const TOP_N = 20;

const SYSTEM_PROMPT = `You are Syncrate's Recommendation Engine for small and medium businesses.
You receive a compact JSON snapshot of a single tenant's current business state.
Produce concrete, actionable recommendations across these categories only:
- reorder: products that should be reordered now
- best_supplier: which supplier to prefer for sourcing
- customer_followup: customers worth re-engaging or chasing for payment
- discount: where a targeted discount would help
- inventory_optimization: reduce overstock / free up working capital
- cross_sell / upsell: revenue-expansion opportunities

Strict rules:
- Ground EVERY recommendation in the figures provided. Never invent data.
- Each recommendation must include a clear reason and the supporting figures used.
- Set confidence honestly: lower it when the snapshot is sparse or ambiguous.
- Order recommendations by business priority (highest impact first).
- If the snapshot is essentially empty, return an empty recommendations array
  with a low overall confidence and a summary explaining there is not enough data.`;

export class RecommendationService {
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

  /**
   * Gathers a compact business snapshot from existing repositories. Public so
   * it can be unit-tested independently of the model call.
   */
  async gatherSnapshot(
    organizationId: string,
    currency = "INR"
  ): Promise<RecommendationSnapshot> {
    const [products, lowStock, suppliers, customers, invoices] =
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
      ]);

    const lowStockItems = lowStock.items.slice(0, TOP_N).map((level) => ({
      code: level.productCode,
      name: level.productName,
      quantity: level.quantity,
      reorderLevel: level.reorderLevel,
      purchasePrice: level.purchasePrice,
    }));

    const topSuppliers = suppliers.items.slice(0, TOP_N).map((supplier) => ({
      name: supplier.name,
      rating: supplier.rating,
      paymentTermsDays: supplier.paymentTermsDays,
    }));

    const customerActivity = this.aggregateCustomers(invoices.items);

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

    return {
      currency,
      activeProductCount: products.total,
      lowStockCount: lowStock.items.length,
      lowStockItems,
      supplierCount: suppliers.total,
      topSuppliers,
      customerCount: customers.total,
      topCustomers: customerActivity,
      postedInvoiceCount: invoices.items.length,
      totalRevenue: round2(totalRevenue),
      outstandingAmount: round2(outstandingAmount),
      overdueInvoiceCount,
    };
  }

  /**
   * Builds the snapshot and asks the gateway for structured recommendations.
   */
  async generate(context: AiContext): Promise<RecommendationResult> {
    const snapshot = await this.gatherSnapshot(context.organizationId);

    const result = await this.gateway.generateStructured({
      capability: "recommendation",
      context,
      system: SYSTEM_PROMPT,
      prompt: this.buildPrompt(snapshot),
      schema: recommendationOutputSchema,
      cacheSystem: true,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: result.data.data };
  }

  private buildPrompt(snapshot: RecommendationSnapshot): string {
    return [
      "Here is the current business snapshot (all monetary values are in",
      `${snapshot.currency}). Generate recommendations grounded only in these`,
      "figures:",
      "",
      JSON.stringify(snapshot, null, 2),
    ].join("\n");
  }

  private aggregateCustomers(
    invoices: readonly InvoiceListItem[]
  ): readonly CustomerActivitySummary[] {
    const byCustomer = new Map<
      string,
      {
        name: string;
        totalBilled: number;
        invoiceCount: number;
        overdueCount: number;
        lastInvoiceDate: number | null;
      }
    >();

    for (const invoice of invoices) {
      const key = invoice.customerId;
      const existing = byCustomer.get(key) ?? {
        name: invoice.customerName ?? "Unknown customer",
        totalBilled: 0,
        invoiceCount: 0,
        overdueCount: 0,
        lastInvoiceDate: null,
      };
      existing.totalBilled += invoice.totalAmount;
      existing.invoiceCount += 1;
      if (invoice.paymentStatus === "overdue") {
        existing.overdueCount += 1;
      }
      const ts = invoice.invoiceDate.getTime();
      if (existing.lastInvoiceDate === null || ts > existing.lastInvoiceDate) {
        existing.lastInvoiceDate = ts;
      }
      byCustomer.set(key, existing);
    }

    return [...byCustomer.values()]
      .sort((a, b) => b.totalBilled - a.totalBilled)
      .slice(0, TOP_N)
      .map((entry) => ({
        name: entry.name,
        totalBilled: round2(entry.totalBilled),
        invoiceCount: entry.invoiceCount,
        overdueCount: entry.overdueCount,
        lastInvoiceDate:
          entry.lastInvoiceDate === null
            ? null
            : new Date(entry.lastInvoiceDate).toISOString().slice(0, 10),
      }));
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
