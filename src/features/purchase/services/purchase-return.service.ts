import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { PurchaseReturnRepository } from "@/features/purchase/repositories/purchase-return.repository";
import { InventoryRepository } from "@/features/inventory/repositories/inventory.repository";
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
  private readonly inventory: InventoryRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new PurchaseReturnRepository(supabase);
    this.inventory = new InventoryRepository(supabase);
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
      reason: input.reason,
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
    userId: string
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
        reason: input.reason,
        subtotal: totals.subtotal,
        tax_amount: totals.taxAmount,
        total_amount: totals.totalAmount,
        notes: nz(input.notes),
      },
      userId
    );

    if (!header) {
      return fail("unknown", "Failed to update purchase return. Please try again.");
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

  // ── Complete (draft → completed) ───────────────────────────

  /**
   * Completes a return: each line DECREASES stock via the atomic `adjust_stock`
   * RPC (negative quantity, type `purchase_return`), then the supplier ledger is
   * reversed by DEBITING the supplier (a return reduces the payable we owe), and
   * finally the header flips to `completed`.
   */
  async completePurchaseReturn(
    purchaseReturnId: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseReturnActionResult<PurchaseReturn>> {
    const existing = await this.repo.findWithItems(purchaseReturnId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Purchase return not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft purchase returns can be completed."
      );
    }
    if (!existing.warehouseId) {
      return fail(
        "validation",
        "A warehouse is required to complete a purchase return."
      );
    }

    // 1) Decrease stock for each line (goods leave our warehouse).
    for (const item of existing.items) {
      const { error } = await this.inventory.adjustStockRpc({
        p_organization_id: organizationId,
        p_product_id: item.productId,
        p_warehouse_id: existing.warehouseId,
        p_quantity: -item.quantity,
        p_type: "purchase_return",
        p_reference_type: "purchase_return",
        p_reference_id: purchaseReturnId,
        p_batch_id: item.batchId ?? undefined,
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("negative") || message.includes("insufficient")) {
          return fail(
            "insufficient_stock",
            "Not enough stock on hand to return these goods."
          );
        }
        return fail(
          "unknown",
          "Failed to update inventory for this return. Please try again."
        );
      }
    }

    // 2) Reverse the supplier ledger: a return reduces the payable → DEBIT.
    const lastBalance = await this.repo.getLastLedgerBalance(
      existing.supplierId
    );
    const newBalance = round2(lastBalance - existing.totalAmount);

    const ledgerWritten = await this.repo.insertLedgerEntry({
      organization_id: organizationId,
      supplier_id: existing.supplierId,
      entry_date: existing.returnDate.toISOString().slice(0, 10),
      reference_type: "purchase_return",
      reference_id: purchaseReturnId,
      description: `Purchase return ${existing.returnNumber}`,
      debit: existing.totalAmount,
      credit: 0,
      running_balance: newBalance,
      created_by: userId,
    });

    if (!ledgerWritten) {
      return fail(
        "unknown",
        "Failed to update the supplier ledger. Please try again."
      );
    }

    // 3) Flip the header to completed.
    const updated = await this.repo.updateStatus(
      purchaseReturnId,
      "completed",
      userId
    );
    if (!updated) {
      return fail("unknown", "Failed to complete purchase return. Please try again.");
    }
    return ok(updated);
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
