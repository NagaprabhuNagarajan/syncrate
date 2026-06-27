import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { PurchaseInvoiceRepository } from "@/features/purchase/repositories/purchase-invoice.repository";
import type {
  CreatePurchaseInvoiceInput,
  CreatePurchaseInvoiceItemInput,
  PurchaseInvoice,
  PurchaseInvoiceActionResult,
  PurchaseInvoiceError,
  PurchaseInvoiceErrorCode,
  PurchaseInvoiceListParams,
  PurchaseInvoiceListResult,
  PurchaseInvoiceWithItems,
  UpdatePurchaseInvoiceInput,
} from "@/features/purchase/types/purchase-invoice.types";

type DbPurchaseInvoiceItemInsert =
  Database["public"]["Tables"]["purchase_invoice_items"]["Insert"];

function ok<T>(data: T): PurchaseInvoiceActionResult<T> {
  return { success: true, data };
}

function fail(
  code: PurchaseInvoiceErrorCode,
  message: string
): PurchaseInvoiceActionResult<never> {
  const error: PurchaseInvoiceError = { code, message };
  return { success: false, error };
}

/** Normalizes an optional string: trims and converts "" → null. */
function nz(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Rounds to 2 decimal places, avoiding binary float drift. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────
// Totals computation
// ─────────────────────────────────────────────────────────────

interface ComputedItem {
  readonly net: number;
  readonly taxAmount: number;
  readonly lineTotal: number;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly taxRate: number;
}

interface ComputedTotals {
  readonly subtotal: number;
  readonly taxAmount: number;
  readonly totalAmount: number;
}

/**
 * Computes a single line item's monetary breakdown (no per-line discount):
 *   net      = qty * unitPrice
 *   tax      = net * taxRate/100
 *   lineTotal= net + tax
 */
function computeItem(input: CreatePurchaseInvoiceItemInput): ComputedItem {
  const quantity = input.quantity;
  const unitPrice = input.unitPrice;
  const taxRate = input.taxRate ?? 0;

  const net = quantity * unitPrice;
  const taxAmount = round2(net * (taxRate / 100));
  const lineTotal = round2(net + taxAmount);

  return { net, taxAmount, lineTotal, quantity, unitPrice, taxRate };
}

/**
 * Aggregates header totals from computed line items:
 *   subtotal = Σ net
 *   tax      = Σ line tax
 *   total    = subtotal + tax
 */
function computeTotals(items: readonly ComputedItem[]): ComputedTotals {
  const subtotal = round2(items.reduce((sum, i) => sum + i.net, 0));
  const taxAmount = round2(items.reduce((sum, i) => sum + i.taxAmount, 0));
  const totalAmount = round2(subtotal + taxAmount);
  return { subtotal, taxAmount, totalAmount };
}

export class PurchaseInvoiceService {
  private readonly repo: PurchaseInvoiceRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new PurchaseInvoiceRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listPurchaseInvoices(
    organizationId: string,
    params?: PurchaseInvoiceListParams
  ): Promise<PurchaseInvoiceListResult> {
    return this.repo.list(organizationId, params);
  }

  async getPurchaseInvoice(
    id: string
  ): Promise<PurchaseInvoiceActionResult<PurchaseInvoiceWithItems>> {
    const invoice = await this.repo.findWithItems(id);
    if (!invoice) {
      return fail("not_found", "Purchase invoice not found");
    }
    return ok(invoice);
  }

  // ── Create ─────────────────────────────────────────────────

  async createPurchaseInvoice(
    input: CreatePurchaseInvoiceInput,
    organizationId: string,
    userId: string
  ): Promise<PurchaseInvoiceActionResult<PurchaseInvoiceWithItems>> {
    const provided = nz(input.invoiceNumber);
    const invoiceNumber =
      provided?.toUpperCase() ?? (await this.nextInvoiceNumber(organizationId));
    const computed = input.items.map(computeItem);
    const totals = computeTotals(computed);

    const header = await this.repo.createHeader({
      organization_id: organizationId,
      invoice_number: invoiceNumber,
      supplier_invoice_number: nz(input.supplierInvoiceNumber),
      purchase_order_id: nz(input.purchaseOrderId),
      supplier_id: input.supplierId,
      status: "draft",
      invoice_date:
        nz(input.invoiceDate) ?? new Date().toISOString().slice(0, 10),
      due_date: nz(input.dueDate),
      subtotal: totals.subtotal,
      discount_amount: 0,
      tax_amount: totals.taxAmount,
      total_amount: totals.totalAmount,
      amount_paid: 0,
      notes: nz(input.notes),
      created_by: userId,
    });

    if (!header) {
      return fail(
        "unknown",
        "Failed to create purchase invoice. Please try again."
      );
    }

    const itemsInserted = await this.repo.insertItems(
      this.buildItemRows(input.items, computed, organizationId, header.id, userId)
    );

    if (!itemsInserted) {
      // Roll back the orphaned header so we never leave an item-less invoice.
      await this.repo.softDelete(header.id, userId);
      return fail("unknown", "Failed to save line items. Please try again.");
    }

    const full = await this.repo.findWithItems(header.id);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Update (draft only) ────────────────────────────────────

  async updatePurchaseInvoice(
    purchaseInvoiceId: string,
    input: UpdatePurchaseInvoiceInput,
    organizationId: string,
    userId: string
  ): Promise<PurchaseInvoiceActionResult<PurchaseInvoiceWithItems>> {
    const existing = await this.repo.findById(purchaseInvoiceId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Purchase invoice not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft purchase invoices can be edited. Posted invoices are immutable."
      );
    }

    const computed = input.items.map(computeItem);
    const totals = computeTotals(computed);
    const provided = nz(input.invoiceNumber);

    const header = await this.repo.updateHeader(
      purchaseInvoiceId,
      {
        invoice_number: provided?.toUpperCase() ?? existing.invoiceNumber,
        supplier_invoice_number: nz(input.supplierInvoiceNumber),
        purchase_order_id: nz(input.purchaseOrderId),
        supplier_id: input.supplierId,
        invoice_date:
          nz(input.invoiceDate) ?? existing.invoiceDate.toISOString().slice(0, 10),
        due_date: nz(input.dueDate),
        subtotal: totals.subtotal,
        discount_amount: 0,
        tax_amount: totals.taxAmount,
        total_amount: totals.totalAmount,
        notes: nz(input.notes),
      },
      userId
    );

    if (!header) {
      return fail(
        "unknown",
        "Failed to update purchase invoice. Please try again."
      );
    }

    const replaced = await this.repo.replaceItems(
      purchaseInvoiceId,
      this.buildItemRows(
        input.items,
        computed,
        organizationId,
        purchaseInvoiceId,
        userId
      )
    );

    if (!replaced) {
      return fail("unknown", "Failed to update line items. Please try again.");
    }

    const full = await this.repo.findWithItems(purchaseInvoiceId);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Post (draft → posted; writes the supplier ledger) ──────

  /**
   * Posts a draft invoice. A purchase invoice INCREASES the amount payable to
   * the supplier, so we CREDIT the supplier ledger by the invoice total. The
   * new running balance is the supplier's latest balance plus the total.
   */
  async postPurchaseInvoice(
    purchaseInvoiceId: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseInvoiceActionResult<PurchaseInvoice>> {
    const existing = await this.repo.findById(purchaseInvoiceId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Purchase invoice not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft purchase invoices can be posted"
      );
    }

    const posted = await this.repo.setPosted(purchaseInvoiceId, userId);
    if (!posted) {
      return fail("unknown", "Failed to post purchase invoice. Please try again.");
    }

    const lastBalance = await this.repo.getLastLedgerBalance(existing.supplierId);
    const total = posted.totalAmount;
    const newBalance = round2(lastBalance + total);

    const ledgerWritten = await this.repo.insertLedgerEntry({
      organization_id: organizationId,
      supplier_id: existing.supplierId,
      entry_date: posted.invoiceDate.toISOString().slice(0, 10),
      reference_type: "purchase_invoice",
      reference_id: purchaseInvoiceId,
      description: `Purchase invoice ${posted.invoiceNumber}`,
      debit: 0,
      credit: total,
      running_balance: newBalance,
      created_by: userId,
    });

    if (!ledgerWritten) {
      return fail(
        "unknown",
        "Invoice posted but the supplier ledger could not be updated."
      );
    }

    return ok(posted);
  }

  // ── Cancel (draft only; posted invoices are immutable) ─────

  async cancelPurchaseInvoice(
    purchaseInvoiceId: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseInvoiceActionResult<PurchaseInvoice>> {
    const existing = await this.repo.findById(purchaseInvoiceId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Purchase invoice not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft purchase invoices can be cancelled. Posted invoices are immutable."
      );
    }

    const cancelled = await this.repo.updateStatus(
      purchaseInvoiceId,
      "cancelled",
      userId
    );
    if (!cancelled) {
      return fail(
        "unknown",
        "Failed to cancel purchase invoice. Please try again."
      );
    }
    return ok(cancelled);
  }

  // ── Helpers ────────────────────────────────────────────────

  private buildItemRows(
    inputs: readonly CreatePurchaseInvoiceItemInput[],
    computed: readonly ComputedItem[],
    organizationId: string,
    purchaseInvoiceId: string,
    userId: string
  ): DbPurchaseInvoiceItemInsert[] {
    return inputs.map((input, index) => {
      const line = computed[index];
      return {
        organization_id: organizationId,
        purchase_invoice_id: purchaseInvoiceId,
        product_id: input.productId,
        description: nz(input.description),
        quantity: line.quantity,
        unit_price: line.unitPrice,
        tax_rate: line.taxRate,
        tax_amount: line.taxAmount,
        line_total: line.lineTotal,
        created_by: userId,
      };
    });
  }

  /** Generates the next sequential invoice number: `PINV-#####`. */
  private async nextInvoiceNumber(organizationId: string): Promise<string> {
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `PINV-${String(total + 1).padStart(5, "0")}`;
  }
}
