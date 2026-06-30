import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { SalesReturnRepository } from "@/features/sales/repositories/sales-return.repository";
import type {
  CreateSalesReturnInput,
  CreateSalesReturnItemInput,
  SalesReturn,
  SalesReturnActionResult,
  SalesReturnError,
  SalesReturnErrorCode,
  SalesReturnListParams,
  SalesReturnListResult,
  SalesReturnWithItems,
  UpdateSalesReturnInput,
} from "@/features/sales/types/sales-return.types";

type DbSalesReturnItemInsert =
  Database["public"]["Tables"]["sales_return_items"]["Insert"];
type DbSalesReturnReason =
  Database["public"]["Tables"]["sales_returns"]["Row"]["reason"];

function ok<T>(data: T): SalesReturnActionResult<T> {
  return { success: true, data };
}

function fail(
  code: SalesReturnErrorCode,
  message: string
): SalesReturnActionResult<never> {
  const error: SalesReturnError = { code, message };
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
 * Maps a raw `complete_sales_return` RPC error message to a domain error code.
 * The Postgres function raises messages that CONTAIN a stable token.
 */
function mapCompleteError(message: string): SalesReturnErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes("insufficient_stock")) {
    return "insufficient_stock";
  }
  if (lower.includes("invalid_status")) {
    return "invalid_status";
  }
  if (lower.includes("not_found")) {
    return "not_found";
  }
  if (lower.includes("validation")) {
    return "validation";
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
 * Computes a single line item's monetary breakdown:
 *   net      = qty * unitPrice
 *   tax      = net * taxRate/100
 *   lineTotal= net + tax
 */
function computeItem(input: CreateSalesReturnItemInput): ComputedItem {
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

export class SalesReturnService {
  private readonly repo: SalesReturnRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new SalesReturnRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listSalesReturns(
    organizationId: string,
    params?: SalesReturnListParams
  ): Promise<SalesReturnListResult> {
    return this.repo.list(organizationId, params);
  }

  async getSalesReturn(
    id: string
  ): Promise<SalesReturnActionResult<SalesReturnWithItems>> {
    const found = await this.repo.findWithItems(id);
    if (!found) {
      return fail("not_found", "Sales return not found");
    }
    return ok(found);
  }

  // ── Create ─────────────────────────────────────────────────

  async createSalesReturn(
    input: CreateSalesReturnInput,
    organizationId: string,
    userId: string
  ): Promise<SalesReturnActionResult<SalesReturnWithItems>> {
    const returnNumber =
      nz(input.returnNumber) ?? (await this.nextReturnNumber(organizationId));
    const computed = input.items.map(computeItem);
    const totals = computeTotals(computed);

    const header = await this.repo.createHeader({
      organization_id: organizationId,
      return_number: returnNumber,
      invoice_id: nz(input.invoiceId),
      customer_id: input.customerId,
      branch_id: nz(input.branchId),
      status: "draft",
      return_date:
        nz(input.returnDate) ?? new Date().toISOString().slice(0, 10),
      reason: input.reason as DbSalesReturnReason,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total_amount: totals.totalAmount,
      notes: nz(input.notes),
      created_by: userId,
    });

    if (!header) {
      return fail(
        "unknown",
        "Failed to create sales return. Please try again."
      );
    }

    const itemsInserted = await this.repo.insertItems(
      this.buildItemRows(
        input.items,
        computed,
        organizationId,
        header.id,
        userId
      )
    );

    if (!itemsInserted) {
      // Roll back the orphaned header so we never leave an item-less return.
      await this.repo.softDelete(header.id, userId);
      return fail("unknown", "Failed to save line items. Please try again.");
    }

    const full = await this.repo.findWithItems(header.id);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Update (draft only) ────────────────────────────────────

  async updateSalesReturn(
    salesReturnId: string,
    input: UpdateSalesReturnInput,
    organizationId: string,
    userId: string,
    expectedVersion: number
  ): Promise<SalesReturnActionResult<SalesReturnWithItems>> {
    const existing = await this.repo.findById(salesReturnId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Sales return not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft sales returns can be edited."
      );
    }

    const computed = input.items.map(computeItem);
    const totals = computeTotals(computed);

    const header = await this.repo.updateHeader(
      salesReturnId,
      {
        invoice_id: nz(input.invoiceId),
        customer_id: input.customerId,
        branch_id: nz(input.branchId),
        return_date:
          nz(input.returnDate) ??
          existing.returnDate.toISOString().slice(0, 10),
        reason: input.reason as DbSalesReturnReason,
        subtotal: totals.subtotal,
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
        "This sales return was changed by someone else. Reload and try again."
      );
    }

    const replaced = await this.repo.replaceItems(
      salesReturnId,
      this.buildItemRows(
        input.items,
        computed,
        organizationId,
        salesReturnId,
        userId
      )
    );

    if (!replaced) {
      return fail("unknown", "Failed to update line items. Please try again.");
    }

    const full = await this.repo.findWithItems(salesReturnId);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Complete (draft → completed; atomic via RPC) ───────────

  /**
   * Completes a return atomically. The `complete_sales_return` Postgres
   * function increases stock per line (positive `sales_return` events via
   * `adjust_stock`), CREDITS the customer ledger (a return reduces receivable)
   * and auto-generates a credit note — all in one transaction. This service
   * only delegates to the RPC, maps any raised error and re-fetches.
   */
  async completeSalesReturn(
    salesReturnId: string,
    _organizationId: string,
    _userId: string
  ): Promise<SalesReturnActionResult<SalesReturn>> {
    const { error } = await this.repo.completeReturnRpc(salesReturnId);
    if (error) {
      return fail(
        mapCompleteError(error.message),
        "Failed to complete sales return."
      );
    }

    const completed = await this.repo.findById(salesReturnId);
    if (!completed) {
      return fail("not_found", "Sales return not found");
    }
    return ok(completed);
  }

  // ── Cancel (draft only) ────────────────────────────────────

  async cancelSalesReturn(
    salesReturnId: string,
    organizationId: string,
    userId: string
  ): Promise<SalesReturnActionResult<SalesReturn>> {
    const existing = await this.repo.findById(salesReturnId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Sales return not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft sales returns can be cancelled."
      );
    }
    const updated = await this.repo.updateStatus(
      salesReturnId,
      "cancelled",
      userId
    );
    if (!updated) {
      return fail(
        "unknown",
        "Failed to cancel sales return. Please try again."
      );
    }
    return ok(updated);
  }

  // ── Helpers ────────────────────────────────────────────────

  private buildItemRows(
    inputs: readonly CreateSalesReturnItemInput[],
    computed: readonly ComputedItem[],
    organizationId: string,
    salesReturnId: string,
    userId: string
  ): DbSalesReturnItemInsert[] {
    return inputs.map((input, index) => {
      const line = computed[index];
      return {
        organization_id: organizationId,
        sales_return_id: salesReturnId,
        product_id: input.productId,
        quantity: line.quantity,
        unit_price: line.unitPrice,
        tax_rate: line.taxRate,
        tax_amount: line.taxAmount,
        line_total: line.lineTotal,
        batch_id: nz(input.batchId),
        created_by: userId,
      };
    });
  }

  /** Generates the next sequential return number: `SR-#####`. */
  private async nextReturnNumber(organizationId: string): Promise<string> {
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `SR-${String(total + 1).padStart(5, "0")}`;
  }
}
