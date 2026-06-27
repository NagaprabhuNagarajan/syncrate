import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { PurchaseOrderRepository } from "@/features/purchase/repositories/purchase-order.repository";
import type {
  CreatePurchaseOrderInput,
  CreatePurchaseOrderItemInput,
  PurchaseOrder,
  PurchaseOrderActionResult,
  PurchaseOrderError,
  PurchaseOrderErrorCode,
  PurchaseOrderListParams,
  PurchaseOrderListResult,
  PurchaseOrderWithItems,
  UpdatePurchaseOrderInput,
} from "@/features/purchase/types/purchase-order.types";

type DbPurchaseOrderItemInsert =
  Database["public"]["Tables"]["purchase_order_items"]["Insert"];

function ok<T>(data: T): PurchaseOrderActionResult<T> {
  return { success: true, data };
}

function fail(
  code: PurchaseOrderErrorCode,
  message: string
): PurchaseOrderActionResult<never> {
  const error: PurchaseOrderError = { code, message };
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
  readonly gross: number;
  readonly discountAmount: number;
  readonly net: number;
  readonly taxAmount: number;
  readonly lineTotal: number;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountPercent: number;
  readonly taxRate: number;
}

interface ComputedTotals {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly taxAmount: number;
  readonly totalAmount: number;
}

/**
 * Computes a single line item's monetary breakdown:
 *   net      = qty * unitPrice * (1 - discount/100)
 *   tax      = net * taxRate/100
 *   lineTotal= net + tax
 */
function computeItem(input: CreatePurchaseOrderItemInput): ComputedItem {
  const quantity = input.quantity;
  const unitPrice = input.unitPrice;
  const discountPercent = input.discountPercent ?? 0;
  const taxRate = input.taxRate ?? 0;

  const gross = quantity * unitPrice;
  const discountAmount = gross * (discountPercent / 100);
  const net = gross - discountAmount;
  const taxAmount = round2(net * (taxRate / 100));
  const lineTotal = round2(net + taxAmount);

  return {
    gross,
    discountAmount,
    net,
    taxAmount,
    lineTotal,
    quantity,
    unitPrice,
    discountPercent,
    taxRate,
  };
}

/**
 * Aggregates header totals from computed line items:
 *   subtotal = Σ gross (before discount)
 *   discount = Σ line discount
 *   tax      = Σ line tax
 *   total    = subtotal - discount + tax
 */
function computeTotals(items: readonly ComputedItem[]): ComputedTotals {
  const subtotal = round2(items.reduce((sum, i) => sum + i.gross, 0));
  const discountAmount = round2(
    items.reduce((sum, i) => sum + i.discountAmount, 0)
  );
  const taxAmount = round2(items.reduce((sum, i) => sum + i.taxAmount, 0));
  const totalAmount = round2(subtotal - discountAmount + taxAmount);
  return { subtotal, discountAmount, taxAmount, totalAmount };
}

export class PurchaseOrderService {
  private readonly repo: PurchaseOrderRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new PurchaseOrderRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listPurchaseOrders(
    organizationId: string,
    params?: PurchaseOrderListParams
  ): Promise<PurchaseOrderListResult> {
    return this.repo.list(organizationId, params);
  }

  async getPurchaseOrder(
    id: string
  ): Promise<PurchaseOrderActionResult<PurchaseOrderWithItems>> {
    const order = await this.repo.findWithItems(id);
    if (!order) {
      return fail("not_found", "Purchase order not found");
    }
    return ok(order);
  }

  // ── Create ─────────────────────────────────────────────────

  async createPurchaseOrder(
    input: CreatePurchaseOrderInput,
    organizationId: string,
    userId: string
  ): Promise<PurchaseOrderActionResult<PurchaseOrderWithItems>> {
    const poNumber = await this.nextPoNumber(organizationId);
    const computed = input.items.map(computeItem);
    const totals = computeTotals(computed);

    const header = await this.repo.createHeader({
      organization_id: organizationId,
      po_number: poNumber,
      supplier_id: input.supplierId,
      warehouse_id: nz(input.warehouseId),
      status: "draft",
      order_date: nz(input.orderDate) ?? new Date().toISOString().slice(0, 10),
      expected_delivery_date: nz(input.expectedDeliveryDate),
      currency: input.currency?.trim().toUpperCase() || "INR",
      notes: nz(input.notes),
      terms: nz(input.terms),
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      tax_amount: totals.taxAmount,
      total_amount: totals.totalAmount,
      created_by: userId,
    });

    if (!header) {
      return fail("unknown", "Failed to create purchase order. Please try again.");
    }

    const itemsInserted = await this.repo.insertItems(
      this.buildItemRows(input.items, computed, organizationId, header.id, userId)
    );

    if (!itemsInserted) {
      // Roll back the orphaned header so we never leave an item-less PO behind.
      await this.repo.softDelete(header.id, userId);
      return fail("unknown", "Failed to save line items. Please try again.");
    }

    const full = await this.repo.findWithItems(header.id);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Update (draft only) ────────────────────────────────────

  async updatePurchaseOrder(
    purchaseOrderId: string,
    input: UpdatePurchaseOrderInput,
    organizationId: string,
    userId: string
  ): Promise<PurchaseOrderActionResult<PurchaseOrderWithItems>> {
    const existing = await this.repo.findById(purchaseOrderId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Purchase order not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft purchase orders can be edited. Cancel the order to make changes."
      );
    }

    const computed = input.items.map(computeItem);
    const totals = computeTotals(computed);

    const header = await this.repo.updateHeader(
      purchaseOrderId,
      {
        supplier_id: input.supplierId,
        warehouse_id: nz(input.warehouseId),
        order_date:
          nz(input.orderDate) ?? existing.orderDate.toISOString().slice(0, 10),
        expected_delivery_date: nz(input.expectedDeliveryDate),
        currency: input.currency?.trim().toUpperCase() || existing.currency,
        notes: nz(input.notes),
        terms: nz(input.terms),
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total_amount: totals.totalAmount,
      },
      userId
    );

    if (!header) {
      return fail("unknown", "Failed to update purchase order. Please try again.");
    }

    const replaced = await this.repo.replaceItems(
      purchaseOrderId,
      this.buildItemRows(
        input.items,
        computed,
        organizationId,
        purchaseOrderId,
        userId
      )
    );

    if (!replaced) {
      return fail("unknown", "Failed to update line items. Please try again.");
    }

    const full = await this.repo.findWithItems(purchaseOrderId);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Status transitions ─────────────────────────────────────

  async submitPurchaseOrder(
    purchaseOrderId: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseOrderActionResult<PurchaseOrder>> {
    return this.transition(
      purchaseOrderId,
      organizationId,
      userId,
      (current) => current === "draft",
      "submitted",
      "Only draft purchase orders can be submitted",
      false
    );
  }

  async approvePurchaseOrder(
    purchaseOrderId: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseOrderActionResult<PurchaseOrder>> {
    return this.transition(
      purchaseOrderId,
      organizationId,
      userId,
      (current) => current === "submitted",
      "approved",
      "Only submitted purchase orders can be approved",
      true
    );
  }

  async cancelPurchaseOrder(
    purchaseOrderId: string,
    organizationId: string,
    userId: string
  ): Promise<PurchaseOrderActionResult<PurchaseOrder>> {
    return this.transition(
      purchaseOrderId,
      organizationId,
      userId,
      (current) => current !== "completed" && current !== "cancelled",
      "cancelled",
      "Completed or already-cancelled purchase orders cannot be cancelled",
      false
    );
  }

  // ── Helpers ────────────────────────────────────────────────

  private async transition(
    purchaseOrderId: string,
    organizationId: string,
    userId: string,
    allowed: (current: PurchaseOrder["status"]) => boolean,
    next: PurchaseOrder["status"],
    invalidMessage: string,
    approve: boolean
  ): Promise<PurchaseOrderActionResult<PurchaseOrder>> {
    const existing = await this.repo.findById(purchaseOrderId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Purchase order not found");
    }
    if (!allowed(existing.status)) {
      return fail("invalid_status", invalidMessage);
    }
    const updated = await this.repo.updateStatus(
      purchaseOrderId,
      next,
      userId,
      approve
    );
    if (!updated) {
      return fail("unknown", "Failed to update purchase order. Please try again.");
    }
    return ok(updated);
  }

  private buildItemRows(
    inputs: readonly CreatePurchaseOrderItemInput[],
    computed: readonly ComputedItem[],
    organizationId: string,
    purchaseOrderId: string,
    userId: string
  ): DbPurchaseOrderItemInsert[] {
    return inputs.map((input, index) => {
      const line = computed[index];
      return {
        organization_id: organizationId,
        purchase_order_id: purchaseOrderId,
        product_id: input.productId,
        description: nz(input.description),
        quantity: line.quantity,
        unit_price: line.unitPrice,
        discount_percent: line.discountPercent,
        tax_rate: line.taxRate,
        tax_amount: line.taxAmount,
        line_total: line.lineTotal,
        created_by: userId,
      };
    });
  }

  /** Generates the next sequential PO number: `PO-#####`. */
  private async nextPoNumber(organizationId: string): Promise<string> {
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `PO-${String(total + 1).padStart(5, "0")}`;
  }
}
