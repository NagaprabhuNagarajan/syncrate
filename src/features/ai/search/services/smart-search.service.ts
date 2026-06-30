import type { AppSupabaseClient } from "@/lib/supabase/types";
import { AiGatewayService } from "@/features/ai/services/ai-gateway.service";
import { AI_MODELS } from "@/features/ai/client/anthropic-client";
import type { AiContext, AiResult } from "@/features/ai/types/ai.types";
import {
  searchIntentSchema,
  type SearchEntity,
  type SearchIntent,
} from "@/features/ai/search/schemas/searchIntentSchema";
import type {
  SearchResultGroup,
  SearchResultItem,
  SmartSearchResult,
} from "@/features/ai/search/types/search.types";
import { InvoiceRepository } from "@/features/sales/repositories/invoice.repository";
import { CustomerRepository } from "@/features/customer/repositories/customer.repository";
import { ProductRepository } from "@/features/product/repositories/product.repository";
import { InventoryRepository } from "@/features/inventory/repositories/inventory.repository";
import { SupplierRepository } from "@/features/supplier/repositories/supplier.repository";
import { CustomerPaymentRepository } from "@/features/payment/repositories/customer-payment.repository";
import { SupplierPaymentRepository } from "@/features/payment/repositories/supplier-payment.repository";
import type { InvoiceStatus, InvoiceSortField } from "@/features/sales/types/invoice.types";
import type { CustomerStatus } from "@/features/customer/types/customer.types";
import type { ProductStatus } from "@/features/product/types/product.types";
import type { SupplierStatus } from "@/features/supplier/types/supplier.types";
import type { PaymentStatus } from "@/features/payment/types/payment.types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * The frozen system prompt for intent parsing. Kept stable so the gateway can
 * cache it across requests (spec §10). The model parses ONLY — it never runs
 * a query.
 */
const SEARCH_SYSTEM_PROMPT = `You are the query parser for Syncrate's Smart Search.
Convert the user's natural-language business query into a single structured search intent.

You may target exactly one of these entities:
- invoice: sales invoices (statuses: draft, posted, cancelled; payment standing: unpaid, partial, paid, overdue)
- customer: customers/CRM (statuses: active, inactive, blacklisted, archived)
- product: catalog products (statuses: draft, active, discontinued, archived)
- inventory: stock levels per product/branch (use lowStock=true for "below/at reorder level" or "low stock")
- supplier: suppliers (statuses: active, inactive, archived)
- customer_payment: payments received from customers
- supplier_payment: payments made to suppliers

Rules:
- Choose the single best-fitting entity.
- Set only the filters the query clearly implies; leave the rest null.
- "unpaid invoices" -> entity=invoice, filters.paymentStatus=unpaid.
- "overdue invoices" or "customers with overdue payments" -> entity=invoice, filters.paymentStatus=overdue.
- "products below reorder level" / "low stock" -> entity=inventory, filters.lowStock=true.
- "sales this month" -> entity=invoice with a timeRange covering the current month.
- Put any free-text name/code/number into filters.keyword.
- Always provide a short 'explanation' restating the query, and a confidence in [0,1].`;

const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  "draft",
  "posted",
  "cancelled",
];
const CUSTOMER_STATUSES: readonly CustomerStatus[] = [
  "active",
  "inactive",
  "blacklisted",
  "archived",
];
const PRODUCT_STATUSES: readonly ProductStatus[] = [
  "draft",
  "active",
  "discontinued",
  "archived",
];
const SUPPLIER_STATUSES: readonly SupplierStatus[] = [
  "active",
  "inactive",
  "archived",
];
const PAYMENT_STATUSES: readonly PaymentStatus[] = ["completed", "voided"];
const INVOICE_SORT_FIELDS: readonly InvoiceSortField[] = [
  "invoice_number",
  "invoice_date",
  "created_at",
  "total_amount",
];

const ENTITY_LABELS: Record<SearchEntity, string> = {
  invoice: "Invoices",
  customer: "Customers",
  product: "Products",
  inventory: "Inventory",
  supplier: "Suppliers",
  customer_payment: "Customer payments",
  supplier_payment: "Supplier payments",
};

function clampLimit(limit: number | null): number {
  if (limit === null) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, limit));
}

function pickStatus<T extends string>(
  value: string | null,
  allowed: readonly T[]
): T | undefined {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return undefined;
}

/**
 * Smart Search (spec §10): natural language -> structured intent (via the AI
 * gateway) -> real, tenant-scoped repository query (here) -> typed results.
 */
export class SmartSearchService {
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

  /**
   * Parses the query into an intent and executes it against the repositories.
   */
  async search(
    query: string,
    organizationId: string,
    userId: string | null
  ): Promise<AiResult<SmartSearchResult>> {
    const context: AiContext = { organizationId, userId };

    const parsed = await this.gateway.generateStructured({
      capability: "search",
      context,
      system: SEARCH_SYSTEM_PROMPT,
      prompt: query,
      schema: searchIntentSchema,
      cacheSystem: true,
      model: AI_MODELS.fast,
    });

    if (!parsed.success) {
      return parsed;
    }

    const intent = parsed.data.data;
    const group = await this.executeIntent(intent, organizationId);

    return {
      success: true,
      data: { query, intent, groups: [group] },
    };
  }

  /** Maps a parsed intent to its repository and returns a result group. */
  private async executeIntent(
    intent: SearchIntent,
    organizationId: string
  ): Promise<SearchResultGroup> {
    switch (intent.entity) {
      case "invoice":
        return this.searchInvoices(intent, organizationId);
      case "customer":
        return this.searchCustomers(intent, organizationId);
      case "product":
        return this.searchProducts(intent, organizationId);
      case "inventory":
        return this.searchInventory(intent, organizationId);
      case "supplier":
        return this.searchSuppliers(intent, organizationId);
      case "customer_payment":
        return this.searchCustomerPayments(intent, organizationId);
      case "supplier_payment":
        return this.searchSupplierPayments(intent, organizationId);
      default: {
        // Exhaustive — keeps the switch total if entities are added.
        const _never: never = intent.entity;
        return this.emptyGroup(_never);
      }
    }
  }

  private emptyGroup(entity: SearchEntity): SearchResultGroup {
    return { entity, label: ENTITY_LABELS[entity], total: 0, items: [] };
  }

  private group(
    entity: SearchEntity,
    items: readonly SearchResultItem[]
  ): SearchResultGroup {
    return { entity, label: ENTITY_LABELS[entity], total: items.length, items };
  }

  private async searchInvoices(
    intent: SearchIntent,
    organizationId: string
  ): Promise<SearchResultGroup> {
    const limit = clampLimit(intent.limit);
    const sortBy = pickStatus(intent.sort?.field ?? null, INVOICE_SORT_FIELDS);
    const result = await this.invoices.list(organizationId, {
      search: intent.filters.keyword ?? undefined,
      status: pickStatus(intent.filters.status, INVOICE_STATUSES),
      dateFrom: intent.timeRange?.from ?? undefined,
      dateTo: intent.timeRange?.to ?? undefined,
      sortBy,
      sortDir: intent.sort?.direction ?? undefined,
      // Fetch the cap then post-filter payment standing (not a DB column param).
      pageSize: limit,
    });

    let items = [...result.items];
    const wantOverdue = intent.filters.overdue === true;
    const paymentStatus = intent.filters.paymentStatus;
    if (paymentStatus) {
      items = items.filter((i) => i.paymentStatus === paymentStatus);
    } else if (wantOverdue) {
      items = items.filter((i) => i.paymentStatus === "overdue");
    }

    return this.group(
      "invoice",
      items.map((i) => ({
        id: i.id,
        title: i.invoiceNumber,
        subtitle: i.customerName,
        meta: i.paymentStatus,
        amount: i.totalAmount,
      }))
    );
  }

  private async searchCustomers(
    intent: SearchIntent,
    organizationId: string
  ): Promise<SearchResultGroup> {
    const result = await this.customers.list(organizationId, {
      search: intent.filters.keyword ?? undefined,
      status: pickStatus(intent.filters.status, CUSTOMER_STATUSES),
      sortDir: intent.sort?.direction ?? undefined,
      pageSize: clampLimit(intent.limit),
    });

    return this.group(
      "customer",
      result.items.map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: c.company ?? c.code,
        meta: c.status,
        amount: c.creditLimit > 0 ? c.creditLimit : null,
      }))
    );
  }

  private async searchProducts(
    intent: SearchIntent,
    organizationId: string
  ): Promise<SearchResultGroup> {
    const result = await this.products.list(organizationId, {
      search: intent.filters.keyword ?? undefined,
      status: pickStatus(intent.filters.status, PRODUCT_STATUSES),
      sortDir: intent.sort?.direction ?? undefined,
      pageSize: clampLimit(intent.limit),
    });

    return this.group(
      "product",
      result.items.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: p.sku ?? p.code,
        meta: p.status,
        amount: p.sellingPrice > 0 ? p.sellingPrice : null,
      }))
    );
  }

  private async searchInventory(
    intent: SearchIntent,
    organizationId: string
  ): Promise<SearchResultGroup> {
    const result = await this.inventory.listLevels(organizationId, {
      search: intent.filters.keyword ?? undefined,
      lowStockOnly: intent.filters.lowStock ?? undefined,
      pageSize: clampLimit(intent.limit),
    });

    return this.group(
      "inventory",
      result.items.map((lvl) => ({
        id: lvl.id,
        title: lvl.productName,
        subtitle: lvl.branchName,
        meta: `${lvl.quantity} in stock (reorder ${lvl.reorderLevel})`,
        amount: null,
      }))
    );
  }

  private async searchSuppliers(
    intent: SearchIntent,
    organizationId: string
  ): Promise<SearchResultGroup> {
    const result = await this.suppliers.list(organizationId, {
      search: intent.filters.keyword ?? undefined,
      status: pickStatus(intent.filters.status, SUPPLIER_STATUSES),
      sortDir: intent.sort?.direction ?? undefined,
      pageSize: clampLimit(intent.limit),
    });

    return this.group(
      "supplier",
      result.items.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: s.contactPerson ?? s.code,
        meta: s.status,
        amount: null,
      }))
    );
  }

  private async searchCustomerPayments(
    intent: SearchIntent,
    organizationId: string
  ): Promise<SearchResultGroup> {
    const result = await this.customerPayments.findAll(organizationId, {
      search: intent.filters.keyword ?? undefined,
      status: pickStatus(intent.filters.status, PAYMENT_STATUSES),
      pageSize: clampLimit(intent.limit),
    });

    return this.group(
      "customer_payment",
      result.payments.map((p) => ({
        id: p.id,
        title: p.paymentNumber,
        subtitle: p.customerName ?? null,
        meta: p.paymentMethod,
        amount: p.amount,
      }))
    );
  }

  private async searchSupplierPayments(
    intent: SearchIntent,
    organizationId: string
  ): Promise<SearchResultGroup> {
    const result = await this.supplierPayments.findAll(organizationId, {
      search: intent.filters.keyword ?? undefined,
      status: pickStatus(intent.filters.status, PAYMENT_STATUSES),
      pageSize: clampLimit(intent.limit),
    });

    return this.group(
      "supplier_payment",
      result.payments.map((p) => ({
        id: p.id,
        title: p.paymentNumber,
        subtitle: p.supplierName ?? null,
        meta: p.paymentMethod,
        amount: p.amount,
      }))
    );
  }
}
