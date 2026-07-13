import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { BillRepository } from "@/features/purchase/repositories/bill.repository";
import type {
  CreateBillInput,
  CreateBillItemInput,
  Bill,
  BillActionResult,
  BillError,
  BillErrorCode,
  BillListItem,
  BillListParams,
  BillListResult,
  BillStats,
  BillWithItems,
  OutstandingBillSummary,
  UpdateBillInput,
} from "@/features/purchase/types/bill.types";

type DbBillItemInsert =
  Database["public"]["Tables"]["purchase_invoice_items"]["Insert"];

function ok<T>(data: T): BillActionResult<T> {
  return { success: true, data };
}

function fail(
  code: BillErrorCode,
  message: string
): BillActionResult<never> {
  const error: BillError = { code, message };
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

/**
 * Maps a raw `post_purchase_invoice` RPC error message to a domain error code.
 * The Postgres function raises messages that CONTAIN a stable token.
 */
function mapPostError(message: string): BillErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes("not_found")) {
    return "not_found";
  }
  if (lower.includes("invalid_status")) {
    return "invalid_status";
  }
  return "unknown";
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
function computeItem(input: CreateBillItemInput): ComputedItem {
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

export class BillService {
  private readonly repo: BillRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new BillRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listBills(
    organizationId: string,
    params?: BillListParams
  ): Promise<BillListResult> {
    return this.repo.list(organizationId, params);
  }

  /** Bills linked to a purchase order (for the PO detail page). */
  async listBillsForPurchaseOrder(
    purchaseOrderId: string
  ): Promise<BillListItem[]> {
    return this.repo.findByPurchaseOrder(purchaseOrderId);
  }

  /**
   * A supplier's bills with a balance due, for the make-payment picker.
   * Each row's `outstandingAmount` (= total − paid) is guaranteed > 0.
   */
  async listOutstandingBillsForSupplier(
    organizationId: string,
    supplierId: string
  ): Promise<OutstandingBillSummary[]> {
    return this.repo.listOutstandingBySupplier(organizationId, supplierId);
  }

  async getBill(
    id: string
  ): Promise<BillActionResult<BillWithItems>> {
    const invoice = await this.repo.findWithItems(id);
    if (!invoice) {
      return fail("not_found", "Bill not found");
    }
    return ok(invoice);
  }

  async getBillStats(
    organizationId: string
  ): Promise<BillStats> {
    return this.repo.getStats(organizationId);
  }

  // ── Create ─────────────────────────────────────────────────

  async createBill(
    input: CreateBillInput,
    organizationId: string,
    userId: string
  ): Promise<BillActionResult<BillWithItems>> {
    const provided = nz(input.invoiceNumber);
    const invoiceNumber =
      provided?.toUpperCase() ?? (await this.nextBillNumber(organizationId));
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
        "Failed to create bill. Please try again."
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

  async updateBill(
    billId: string,
    input: UpdateBillInput,
    organizationId: string,
    userId: string,
    expectedVersion: number
  ): Promise<BillActionResult<BillWithItems>> {
    const existing = await this.repo.findById(billId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Bill not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft bills can be edited. Posted invoices are immutable."
      );
    }

    const computed = input.items.map(computeItem);
    const totals = computeTotals(computed);
    const provided = nz(input.invoiceNumber);

    const header = await this.repo.updateHeader(
      billId,
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
      userId,
      expectedVersion
    );

    if (!header) {
      // The draft existed and was a draft, so a missing row here means the
      // optimistic lock failed: someone edited it since this form loaded.
      return fail(
        "conflict",
        "This bill was changed by someone else. Reload and try again."
      );
    }

    const replaced = await this.repo.replaceItems(
      billId,
      this.buildItemRows(
        input.items,
        computed,
        organizationId,
        billId,
        userId
      )
    );

    if (!replaced) {
      return fail("unknown", "Failed to update line items. Please try again.");
    }

    const full = await this.repo.findWithItems(billId);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Post (draft → posted; atomic via RPC) ──────────────────

  /**
   * Posts a draft invoice atomically. The `post_purchase_invoice` Postgres
   * function stamps the invoice posted AND appends the supplier-ledger credit
   * (a bill INCREASES the payable) in a single transaction, so this
   * service only delegates to the RPC, maps any raised error and re-fetches.
   */
  async postBill(
    billId: string,
    _organizationId: string,
    _userId: string
  ): Promise<BillActionResult<Bill>> {
    const { error } = await this.repo.postInvoiceRpc(billId);
    if (error) {
      return fail(
        mapPostError(error.message),
        "Failed to post bill."
      );
    }

    const posted = await this.repo.findById(billId);
    if (!posted) {
      return fail("not_found", "Bill not found");
    }
    return ok(posted);
  }

  // ── Cancel (draft only; posted invoices are immutable) ─────

  async cancelBill(
    billId: string,
    organizationId: string,
    userId: string
  ): Promise<BillActionResult<Bill>> {
    const existing = await this.repo.findById(billId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Bill not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft bills can be cancelled. Posted invoices are immutable."
      );
    }

    const cancelled = await this.repo.updateStatus(
      billId,
      "cancelled",
      userId
    );
    if (!cancelled) {
      return fail(
        "unknown",
        "Failed to cancel bill. Please try again."
      );
    }
    return ok(cancelled);
  }

  // ── Helpers ────────────────────────────────────────────────

  private buildItemRows(
    inputs: readonly CreateBillItemInput[],
    computed: readonly ComputedItem[],
    organizationId: string,
    billId: string,
    userId: string
  ): DbBillItemInsert[] {
    return inputs.map((input, index) => {
      const line = computed[index];
      return {
        organization_id: organizationId,
        purchase_invoice_id: billId,
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

  /** Generates the next sequential bill number: `BILL-#####`. */
  private async nextBillNumber(organizationId: string): Promise<string> {
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `BILL-${String(total + 1).padStart(5, "0")}`;
  }
}
