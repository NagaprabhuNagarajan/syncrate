import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AiGatewayService } from "@/features/ai/services/ai-gateway.service";
import type { AiContext, AiResult } from "@/features/ai/types/ai.types";
import {
  reportOutputSchema,
  type ReportType,
} from "@/features/ai/reports/schemas/reportSchema";
import type {
  ReportSnapshot,
  SmartReport,
} from "@/features/ai/reports/types/report.types";
import { InvoiceRepository } from "@/features/sales/repositories/invoice.repository";
import { CustomerRepository } from "@/features/customer/repositories/customer.repository";
import { ProductRepository } from "@/features/product/repositories/product.repository";
import { InventoryRepository } from "@/features/inventory/repositories/inventory.repository";
import { SupplierRepository } from "@/features/supplier/repositories/supplier.repository";
import { CustomerPaymentRepository } from "@/features/payment/repositories/customer-payment.repository";
import { SupplierPaymentRepository } from "@/features/payment/repositories/supplier-payment.repository";

/** How many rows to pull when computing compact aggregates. */
const SAMPLE_SIZE = 100;

/**
 * The frozen system prompt for report generation. Kept stable for prompt
 * caching (spec §11). The model must reason ONLY from the supplied figures.
 */
const REPORT_SYSTEM_PROMPT = `You are Syncrate's Smart Reports analyst for Indian SMEs.
You are given a compact JSON snapshot of a business's current figures and a requested report type.
Produce a structured report: an executive summary plus focused sections.

Strict rules:
- Ground EVERY statement in the provided numbers. Never invent figures.
- All currency is Indian Rupees (₹). Format large values compactly (e.g. ₹4.2L, ₹1.3Cr).
- Each section must include concrete key metrics, a trend, actionable recommendations,
  a confidence in [0,1], and a brief explanation of your reasoning.
- If the data is sparse or zero, say so plainly and lower your confidence.
- Be concise and practical — write for a busy business owner.`;

const REPORT_FOCUS: Record<ReportType, string> = {
  business_health:
    "Overall business health: revenue vs receivables, cash position, inventory risk, and growth signals.",
  profit_analysis:
    "Profitability: revenue booked, amounts collected vs outstanding, and what is eroding or driving margin.",
  inventory_summary:
    "Inventory standing: stock value, low-stock/reorder exposure, and working-capital tied in stock.",
  cash_flow:
    "Cash flow: cash received from customers vs cash paid to suppliers, and net movement plus receivables drag.",
  customer_analysis:
    "Customer base: size, receivables concentration, and collection health from the customer side.",
  supplier_performance:
    "Supplier side: payables, payments made, and supplier-related cash commitments.",
};

/**
 * Smart Reports (spec §11): gather compact figures from the real repositories,
 * then ask the gateway for a structured, explainable report.
 */
export class SmartReportService {
  private readonly gateway: AiGatewayService;
  private readonly invoices: InvoiceRepository;
  private readonly customers: CustomerRepository;
  private readonly products: ProductRepository;
  private readonly inventory: InventoryRepository;
  private readonly suppliers: SupplierRepository;
  private readonly customerPayments: CustomerPaymentRepository;
  private readonly supplierPayments: SupplierPaymentRepository;

  constructor(supabase: AppSupabaseClient) {
    this.gateway = new AiGatewayService(supabase);
    this.invoices = new InvoiceRepository(supabase);
    this.customers = new CustomerRepository(supabase);
    this.products = new ProductRepository(supabase);
    this.inventory = new InventoryRepository(supabase);
    this.suppliers = new SupplierRepository(supabase);
    this.customerPayments = new CustomerPaymentRepository(supabase);
    this.supplierPayments = new SupplierPaymentRepository(supabase);
  }

  /** Generates a structured report of the requested type. */
  async generate(
    reportType: ReportType,
    organizationId: string,
    userId: string | null
  ): Promise<AiResult<SmartReport>> {
    const snapshot = await this.gatherSnapshot(organizationId);
    const context: AiContext = { organizationId, userId };

    const prompt = [
      `Report type: ${reportType}`,
      `Focus: ${REPORT_FOCUS[reportType]}`,
      "",
      "Business data snapshot (JSON):",
      JSON.stringify(snapshot),
    ].join("\n");

    const res = await this.gateway.generateStructured({
      capability: "report",
      context,
      system: REPORT_SYSTEM_PROMPT,
      prompt,
      schema: reportOutputSchema,
      cacheSystem: true,
    });

    if (!res.success) {
      return res;
    }
    return { success: true, data: res.data.data };
  }

  /** Pulls compact, numeric aggregates from every relevant repository. */
  async gatherSnapshot(organizationId: string): Promise<ReportSnapshot> {
    const [
      invoiceList,
      inventoryList,
      customerList,
      supplierList,
      productList,
      customerPaymentList,
      supplierPaymentList,
    ] = await Promise.all([
      this.invoices.list(organizationId, { pageSize: SAMPLE_SIZE }),
      this.inventory.listLevels(organizationId, { pageSize: SAMPLE_SIZE }),
      this.customers.list(organizationId, { pageSize: 1 }),
      this.suppliers.list(organizationId, { pageSize: 1 }),
      this.products.list(organizationId, { pageSize: 1 }),
      this.customerPayments.findAll(organizationId, { pageSize: SAMPLE_SIZE }),
      this.supplierPayments.findAll(organizationId, { pageSize: SAMPLE_SIZE }),
    ]);

    const sumTotal = invoiceList.items.reduce((s, i) => s + i.totalAmount, 0);
    const sumPaid = invoiceList.items.reduce((s, i) => s + i.amountPaid, 0);
    const unpaidCount = invoiceList.items.filter(
      (i) => i.paymentStatus === "unpaid" || i.paymentStatus === "partial"
    ).length;
    const overdueCount = invoiceList.items.filter(
      (i) => i.paymentStatus === "overdue"
    ).length;

    const stockValue = inventoryList.items.reduce(
      (s, lvl) => s + lvl.quantity * lvl.purchasePrice,
      0
    );
    const lowStockCount = inventoryList.items.filter(
      (lvl) => lvl.quantity <= lvl.reorderLevel
    ).length;

    return {
      invoices: {
        total: invoiceList.total,
        sumTotal,
        sumPaid,
        outstanding: sumTotal - sumPaid,
        unpaidCount,
        overdueCount,
      },
      inventory: {
        totalItems: inventoryList.total,
        lowStockCount,
        stockValue,
      },
      customers: { total: customerList.total },
      suppliers: { total: supplierList.total },
      products: { total: productList.total },
      customerPayments: {
        total: customerPaymentList.total,
        sumAmount: customerPaymentList.payments.reduce(
          (s, p) => s + p.amount,
          0
        ),
      },
      supplierPayments: {
        total: supplierPaymentList.total,
        sumAmount: supplierPaymentList.payments.reduce(
          (s, p) => s + p.amount,
          0
        ),
      },
    };
  }
}
