import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { PurchaseReturnRepository } from "@/features/purchase/repositories/purchase-return.repository";
import type {
  CreatePurchaseReturnInput,
  CreatePurchaseReturnItemInput,
  PurchaseReturn,
  PurchaseReturnActionResult,
  PurchaseReturnError,
  PurchaseReturnErrorCode,
  PurchaseReturnListParams,
  PurchaseReturnListResult,
  PurchaseReturnWithItems,
  UpdatePurchaseReturnInput,
} from "@/features/purchase/types/purchase-return.types";

type DbPurchaseReturnItemInsert =
  Database["public"]["Tables"]["purchase_return_items"]["Insert"];
/**
 * The DB `reason` enum is regenerated separately; the `supplier_recall` reason
 * is accepted by the live schema but not yet in the generated union, so header
 * writes cast the domain reason to the DB column type.
 */
type DbReturnReason =
  Database["public"]["Tables"]["purchase_returns"]["Row"]["reason"];

function ok<T>(data: T): PurchaseReturnActionResult<T> {
  return { success: true, data };
}

function fail(
  code: PurchaseReturnErrorCode,
  message: string
): PurchaseReturnActionResult<never> {
  const error: PurchaseReturnError = { code, message };
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
 * Maps a raw `complete_purchase_return` RPC error message to a domain error
 * code. The Postgres function raises messages that CONTAIN a stable token.
 */
function mapCompleteError(message: string): PurchaseReturnErrorCode {
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
function computeItem(input: CreatePurchaseReturnItemInput): ComputedItem {
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

export class PurchaseReturnService {
  private readonly repo: PurchaseReturnRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new PurchaseReturnRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listPurchaseReturns(
    organizationId: string,
    params?: PurchaseReturnListParams
  ): Promise<PurchaseReturnListResult> {
    return this.repo.list(organizationId, params);
  }

  async getPurchaseReturn(
    id: string
  ): Promise<PurchaseReturnActionResult<PurchaseReturnWithItems>> {
    const found = await this.repo.findWithItems(id);
    if (!found) {
      return fail("not_found", "Purchase return not found");
    }
    return ok(found);
  }

  // ── Create ─────────────────────────────────────────────────

  async createPurchaseReturn(
    input: CreatePurchaseReturnInput,
    organizationId: string,
    userId: string
  ): Promise<PurchaseReturnActionResult<PurchaseReturnWithItems>> {
    const returnNumber =
      nz(input.returnNumber) ?? (await this.nextReturnNumber(organizationId));
    const computed = input.items.map(computeItem);
    const totals = computeTotals(computed);

    const header = await this.repo.createHeader({
      organization_id: organizationId,
      return_number: returnNumber,
      purchase_order_id: nz(input.purchaseOrderId),
      supplier_id: input.supplierId,
      warehouse_id: input.warehouseId,
      status: "draft",
      return_date:
        nz(input.returnDate) ?? new Date().toISOString().slice(0, 10),
      reason: input.reason as DbReturnReason,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      total_amount: totals.totalAmount,
      notes: nz(input.notes),
      created_by: userId,
    });

    if (!header) {
      return fail("unknown", "Failed to create purchase return. Please try again.");
    }

    const itemsInserted = await this.repo.insertItems(
      this.buildItemRows(input.items, computed, organizationId, header.id, userId)
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

  async updatePurchaseReturn(
    purchaseReturnId: string,
    input: UpdatePurchaseReturnInput,
    organizationId: string,
    userId: string,
    expectedVersion: number
  ): Promise<PurchaseReturnActionResult<PurchaseReturnWithItems>> {
    const existing = await this.repo.findById(purchaseReturnId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Purchase return not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft purchase returns can be edited."
      );
    }

    const computed = input.items.map(computeItem);
    const totals = computeTotals(computed);

    const header = await this.repo.updateHeader(
      purchaseReturnId,
      {
        purchase_order_id: nz(input.purchaseOrderId),
        supplier_id: input.supplierId,
        warehouse_id: input.warehouseId,
        return_date:
          nz(input.returnDate) ?? existing.returnDate.toISOString().slice(0, 10),
        reason: input.reason as DbReturnReason,
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
        "This purchase return was changed by someone else. Reload and try again."
      );
    }

    const replaced = await this.repo.replaceItems(
      purchaseReturnId,
      this.buildItemRows(
        input.items,
        computed,
        organizationId,
        purchaseReturnId,
        userId
      )
    );

    if (!replaced) {
      return fail("unknown", "Failed to update line items. Please try again.");
    }

    const full = await this.repo.findWithItems(purchaseReturnId);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Complete (draft → completed; atomic via RPC) ───────────

  /**
   * Completes a return atomically. The `complete_purchase_return` Postgres
   * function decreases stock per line (negative `purchase_return` events via
   * `adjust_stock`), DEBITS the supplier ledger (a return reduces the payable)
   * and flips the header to `completed` — all in one transaction. This service
   * only delegates to the RPC, maps any raised error and re-fetches.
   */
  async completePurchaseReturn(
    purchaseReturnId: string,
    _organizationId: string,
    _userId: string
  ): Promise<PurchaseReturnActionResult<PurchaseReturn>> {
    const { error } = await this.repo.completeReturnRpc(purchaseReturnId);
    if (error) {
      return fail(
        mapCompleteError(error.message),
        "Failed to complete purchase return."
      );
    }

    const completed = await this.repo.findById(purchaseReturnId);
    if (!completed) {
      return fail("not_found", "Purchase return not found");
    }
    return ok(completed);
  }

  // ── Cancel (draft only) ────────────────────────────────────

  async cancelPurchaseReturn(
    purchaseReturnId: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseReturnActionResult<PurchaseReturn>> {
    const existing = await this.repo.findById(purchaseReturnId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Purchase return not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft purchase returns can be cancelled."
      );
    }
    const updated = await this.repo.updateStatus(
      purchaseReturnId,
      "cancelled",
      userId
    );
    if (!updated) {
      return fail("unknown", "Failed to cancel purchase return. Please try again.");
    }
    return ok(updated);
  }

  // ── Helpers ────────────────────────────────────────────────

  private buildItemRows(
    inputs: readonly CreatePurchaseReturnItemInput[],
    computed: readonly ComputedItem[],
    organizationId: string,
    purchaseReturnId: string,
    userId: string
  ): DbPurchaseReturnItemInsert[] {
    return inputs.map((input, index) => {
      const line = computed[index];
      return {
        organization_id: organizationId,
        purchase_return_id: purchaseReturnId,
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

  /** Generates the next sequential return number: `PRET-#####`. */
  private async nextReturnNumber(organizationId: string): Promise<string> {
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `PRET-${String(total + 1).padStart(5, "0")}`;
  }
}
