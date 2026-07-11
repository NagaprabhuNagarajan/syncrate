import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { SalesOrderRepository } from "@/features/sales/repositories/sales-order.repository";
import { computeGST } from "@/features/sales/utils/gst-engine";
import { computeDiscount } from "@/features/sales/utils/discount-engine";
import type {
  CreateSalesOrderInput,
  CreateSalesOrderItemInput,
  SalesOrder,
  SalesOrderActionResult,
  SalesOrderError,
  SalesOrderErrorCode,
  SalesOrderItem,
  SalesOrderListParams,
  SalesOrderListResult,
  SalesOrderStats,
  SalesOrderWithItems,
  UpdateSalesOrderInput,
} from "@/features/sales/types/sales-order.types";

type DbSalesOrderItemInsert =
  Database["public"]["Tables"]["sales_order_items"]["Insert"];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): SalesOrderActionResult<T> {
  return { success: true, data };
}

function fail(
  code: SalesOrderErrorCode,
  message: string
): SalesOrderActionResult<never> {
  const error: SalesOrderError = { code, message };
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
// Line-item computation
// ─────────────────────────────────────────────────────────────

interface ComputedSalesOrderLine {
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountPercent: number;
  readonly discountAmount: number;
  readonly taxableAmount: number;
  readonly gstRate: number;
  readonly cgstRate: number;
  readonly sgstRate: number;
  readonly igstRate: number;
  readonly cgstAmount: number;
  readonly sgstAmount: number;
  readonly igstAmount: number;
  readonly taxAmount: number;
  readonly lineTotal: number;
}

interface ComputedSalesOrderTotals {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly cgstAmount: number;
  readonly sgstAmount: number;
  readonly igstAmount: number;
  readonly taxAmount: number;
  readonly roundOff: number;
  readonly totalAmount: number;
  readonly isInterstate: boolean;
}

/**
 * Computes a single line item's full monetary breakdown:
 *   gross          = qty × unitPrice
 *   discountAmount = gross × discountPercent / 100
 *   taxableAmount  = gross − discountAmount
 *   GST            = computed via gst-engine (CGST+SGST or IGST)
 *   lineTotal      = taxableAmount + taxAmount
 */
function computeLine(
  input: CreateSalesOrderItemInput,
  orgState: string | null | undefined,
  supplyState: string | null | undefined
): ComputedSalesOrderLine {
  const quantity = input.quantity;
  const unitPrice = input.unitPrice;
  const gstRate = input.gstRate ?? 0;

  const gross = round2(quantity * unitPrice);

  const discount = computeDiscount({
    type: "percentage",
    value: input.discountPercent ?? 0,
    lineAmount: gross,
  });

  const taxableAmount = round2(gross - discount.discountAmount);

  const gst = computeGST({
    taxableAmount,
    gstRate,
    orgState,
    supplyState,
  });

  const lineTotal = round2(taxableAmount + gst.taxAmount);

  return {
    quantity,
    unitPrice,
    discountPercent: discount.discountPercent,
    discountAmount: discount.discountAmount,
    taxableAmount,
    gstRate,
    cgstRate: gst.cgstRate,
    sgstRate: gst.sgstRate,
    igstRate: gst.igstRate,
    cgstAmount: gst.cgstAmount,
    sgstAmount: gst.sgstAmount,
    igstAmount: gst.igstAmount,
    taxAmount: gst.taxAmount,
    lineTotal,
  };
}

/**
 * Aggregates header totals from computed line items.
 * roundOff = rounded total − actual total (e.g., 1234.60 → roundOff = −0.60).
 */
function computeTotals(
  lines: readonly ComputedSalesOrderLine[]
): ComputedSalesOrderTotals {
  const subtotal = round2(
    lines.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0)
  );
  const discountAmount = round2(
    lines.reduce((s, l) => s + l.discountAmount, 0)
  );
  const cgstAmount = round2(lines.reduce((s, l) => s + l.cgstAmount, 0));
  const sgstAmount = round2(lines.reduce((s, l) => s + l.sgstAmount, 0));
  const igstAmount = round2(lines.reduce((s, l) => s + l.igstAmount, 0));
  const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);
  const rawTotal = round2(subtotal - discountAmount + taxAmount);
  const roundedTotal = Math.round(rawTotal);
  const roundOff = round2(roundedTotal - rawTotal);
  const totalAmount = round2(rawTotal + roundOff);

  const isInterstate =
    igstAmount > 0 ||
    lines.some((l) => l.igstRate > 0 && l.taxableAmount > 0);

  return {
    subtotal,
    discountAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    roundOff,
    totalAmount,
    isInterstate,
  };
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export class SalesOrderService {
  private readonly repo: SalesOrderRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new SalesOrderRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listSalesOrders(
    organizationId: string,
    params?: SalesOrderListParams
  ): Promise<SalesOrderListResult> {
    return this.repo.list(organizationId, params);
  }

  async getSalesOrder(
    id: string
  ): Promise<SalesOrderActionResult<SalesOrderWithItems>> {
    const so = await this.repo.findWithItems(id);
    if (!so) {
      return fail("not_found", "Sales order not found");
    }
    return ok(so);
  }

  async getSalesOrderStats(organizationId: string): Promise<SalesOrderStats> {
    return this.repo.getStats(organizationId);
  }

  // ── Create ─────────────────────────────────────────────────

  async createSalesOrder(
    input: CreateSalesOrderInput,
    organizationId: string,
    userId: string,
    orgState?: string | null
  ): Promise<SalesOrderActionResult<SalesOrderWithItems>> {
    const soNumber = await this.nextSoNumber(organizationId);
    const supplyState = nz(input.supplyState);
    const lines = input.items.map((item) =>
      computeLine(item, orgState, supplyState)
    );
    const totals = computeTotals(lines);

    const header = await this.repo.createHeader({
      organization_id: organizationId,
      so_number: soNumber,
      customer_id: input.customerId,
      branch_id: nz(input.branchId),
      salesperson_id: nz(input.salespersonId),
      reference_number: nz(input.referenceNumber),
      order_date:
        nz(input.orderDate) ?? new Date().toISOString().slice(0, 10),
      delivery_date: nz(input.deliveryDate),
      payment_terms_days: input.paymentTermsDays ?? 0,
      supply_state: supplyState,
      is_interstate: totals.isInterstate,
      status: "draft",
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      cgst_amount: totals.cgstAmount,
      sgst_amount: totals.sgstAmount,
      igst_amount: totals.igstAmount,
      tax_amount: totals.taxAmount,
      round_off: totals.roundOff,
      total_amount: totals.totalAmount,
      notes: nz(input.notes),
      terms: nz(input.terms),
      created_by: userId,
    });

    if (!header) {
      return fail("unknown", "Failed to create sales order. Please try again.");
    }

    const itemsInserted = await this.repo.insertItems(
      this.buildItemRows(input.items, lines, organizationId, header.id, userId)
    );

    if (!itemsInserted) {
      await this.repo.softDelete(header.id, userId);
      return fail("unknown", "Failed to save line items. Please try again.");
    }

    const full = await this.repo.findWithItems(header.id);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Update (draft only) ────────────────────────────────────

  async updateSalesOrder(
    salesOrderId: string,
    input: UpdateSalesOrderInput,
    organizationId: string,
    userId: string,
    orgState?: string | null
  ): Promise<SalesOrderActionResult<SalesOrderWithItems>> {
    const existing = await this.repo.findById(salesOrderId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Sales order not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft sales orders can be edited."
      );
    }

    const supplyState = nz(input.supplyState);
    const lines = input.items.map((item) =>
      computeLine(item, orgState, supplyState)
    );
    const totals = computeTotals(lines);

    const headerResult = await this.repo.updateHeader(
      salesOrderId,
      {
        customer_id: input.customerId,
        branch_id: nz(input.branchId),
        salesperson_id: nz(input.salespersonId),
        reference_number: nz(input.referenceNumber),
        order_date:
          nz(input.orderDate) ?? existing.orderDate.toISOString().slice(0, 10),
        delivery_date: nz(input.deliveryDate),
        payment_terms_days: input.paymentTermsDays ?? existing.paymentTermsDays,
        supply_state: supplyState,
        is_interstate: totals.isInterstate,
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        cgst_amount: totals.cgstAmount,
        sgst_amount: totals.sgstAmount,
        igst_amount: totals.igstAmount,
        tax_amount: totals.taxAmount,
        round_off: totals.roundOff,
        total_amount: totals.totalAmount,
        notes: nz(input.notes),
        terms: nz(input.terms),
      },
      userId,
      input.version
    );

    if (headerResult.status === "conflict") {
      return fail(
        "conflict",
        "This sales order was changed by someone else. Reload and try again."
      );
    }
    if (headerResult.status === "error") {
      return fail("unknown", "Failed to update sales order. Please try again.");
    }

    const replaced = await this.repo.replaceItems(
      salesOrderId,
      this.buildItemRows(
        input.items,
        lines,
        organizationId,
        salesOrderId,
        userId
      )
    );

    if (!replaced) {
      return fail("unknown", "Failed to update line items. Please try again.");
    }

    const full = await this.repo.findWithItems(salesOrderId);
    return ok(full ?? { ...headerResult.salesOrder, items: [] });
  }

  // ── Status transitions ─────────────────────────────────────

  async submitSalesOrder(
    salesOrderId: string,
    organizationId: string,
    userId: string
  ): Promise<SalesOrderActionResult<SalesOrder>> {
    return this.transition(
      salesOrderId,
      organizationId,
      userId,
      (s) => s === "draft",
      "submitted",
      "Only draft sales orders can be submitted",
      false
    );
  }

  async approveSalesOrder(
    salesOrderId: string,
    organizationId: string,
    userId: string
  ): Promise<SalesOrderActionResult<SalesOrder>> {
    return this.transition(
      salesOrderId,
      organizationId,
      userId,
      (s) => s === "submitted",
      "approved",
      "Only submitted sales orders can be approved",
      true
    );
  }

  async cancelSalesOrder(
    salesOrderId: string,
    organizationId: string,
    userId: string
  ): Promise<SalesOrderActionResult<SalesOrder>> {
    return this.transition(
      salesOrderId,
      organizationId,
      userId,
      (s) => s !== "completed" && s !== "cancelled",
      "cancelled",
      "Completed or already-cancelled sales orders cannot be cancelled",
      false
    );
  }

  // ── Fulfilment (delivery) ──────────────────────────────────

  /**
   * Records delivered quantities against a sales order's line items and
   * recomputes the header status from the resulting totals:
   *   - every item fully delivered  → `completed`
   *   - some quantity delivered     → `partially_delivered`
   *   - nothing delivered           → status left unchanged
   *
   * Delivery is only permitted from `approved`, `processing` or
   * `partially_delivered`. When a `version` is supplied the load is checked
   * against it so a stale client is reported as a `conflict`.
   */
  async recordDelivery(
    organizationId: string,
    salesOrderId: string,
    userId: string,
    lines: readonly { readonly itemId: string; readonly deliverQty: number }[],
    version?: number
  ): Promise<SalesOrderActionResult<SalesOrderWithItems>> {
    const existing = await this.repo.findWithItems(salesOrderId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Sales order not found");
    }

    if (
      existing.status !== "approved" &&
      existing.status !== "processing" &&
      existing.status !== "partially_delivered"
    ) {
      return fail(
        "invalid_status",
        "Only approved, processing or partially delivered sales orders can be delivered"
      );
    }

    if (version !== undefined && existing.version !== version) {
      return fail(
        "conflict",
        "This sales order was changed by someone else. Reload and try again."
      );
    }

    const itemsById = new Map(existing.items.map((item) => [item.id, item]));
    const nextQtyById = new Map<string, number>();

    for (const line of lines) {
      const item = itemsById.get(line.itemId);
      if (!item) {
        return fail("validation", "Delivery line refers to an unknown item");
      }
      if (line.deliverQty < 0) {
        return fail("validation", "Delivered quantity cannot be negative");
      }
      const resulting = round2(item.deliveredQty + line.deliverQty);
      if (resulting > item.quantity) {
        const label = item.description ?? item.productId;
        return fail(
          "validation",
          `Cannot deliver more than the ordered quantity for ${label}`
        );
      }
      if (line.deliverQty > 0) {
        nextQtyById.set(line.itemId, resulting);
      }
    }

    const updates = [...nextQtyById.entries()].map(([itemId, deliveredQty]) => ({
      itemId,
      deliveredQty,
    }));

    if (updates.length > 0) {
      const applied = await this.repo.recordItemDeliveries(
        organizationId,
        salesOrderId,
        updates
      );
      if (!applied) {
        return fail(
          "unknown",
          "Failed to record delivery. Please try again."
        );
      }
    }

    // Recompute status from the resulting per-item delivered totals.
    const resolvedQty = (item: SalesOrderItem): number =>
      nextQtyById.get(item.id) ?? item.deliveredQty;

    const everyFullyDelivered = existing.items.every(
      (item) => resolvedQty(item) >= item.quantity
    );
    const anyDelivered = existing.items.some((item) => resolvedQty(item) > 0);

    let nextStatus: SalesOrder["status"] = existing.status;
    if (everyFullyDelivered) {
      nextStatus = "completed";
    } else if (anyDelivered) {
      nextStatus = "partially_delivered";
    }

    if (nextStatus !== existing.status) {
      const updated = await this.repo.updateStatus(
        salesOrderId,
        nextStatus,
        userId,
        false
      );
      if (!updated) {
        return fail(
          "unknown",
          "Failed to update sales order. Please try again."
        );
      }
    }

    const full = await this.repo.findWithItems(salesOrderId);
    return ok(full ?? existing);
  }

  // ── Helpers ────────────────────────────────────────────────

  private async transition(
    salesOrderId: string,
    organizationId: string,
    userId: string,
    allowed: (current: SalesOrder["status"]) => boolean,
    next: SalesOrder["status"],
    invalidMessage: string,
    approve: boolean
  ): Promise<SalesOrderActionResult<SalesOrder>> {
    const existing = await this.repo.findById(salesOrderId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Sales order not found");
    }
    if (!allowed(existing.status)) {
      return fail("invalid_status", invalidMessage);
    }
    const updated = await this.repo.updateStatus(
      salesOrderId,
      next,
      userId,
      approve
    );
    if (!updated) {
      return fail("unknown", "Failed to update sales order. Please try again.");
    }
    return ok(updated);
  }

  private buildItemRows(
    inputs: readonly CreateSalesOrderItemInput[],
    lines: readonly ComputedSalesOrderLine[],
    organizationId: string,
    salesOrderId: string,
    userId: string
  ): DbSalesOrderItemInsert[] {
    return inputs.map((input, index) => {
      const line = lines[index];
      if (!line) {
        throw new Error(`Assertion failed: computed line missing at index ${index}`);
      }
      return {
        organization_id: organizationId,
        sales_order_id: salesOrderId,
        product_id: input.productId,
        description: nz(input.description),
        hsn_code: nz(input.hsnCode),
        quantity: line.quantity,
        unit_price: line.unitPrice,
        discount_percent: line.discountPercent,
        discount_amount: line.discountAmount,
        taxable_amount: line.taxableAmount,
        gst_rate: line.gstRate,
        cgst_rate: line.cgstRate,
        sgst_rate: line.sgstRate,
        igst_rate: line.igstRate,
        cgst_amount: line.cgstAmount,
        sgst_amount: line.sgstAmount,
        igst_amount: line.igstAmount,
        tax_amount: line.taxAmount,
        line_total: line.lineTotal,
        sort_order: input.sortOrder ?? index,
        created_by: userId,
      };
    });
  }

  /** Generates the next sequential SO number: `SO-#####`. */
  private async nextSoNumber(organizationId: string): Promise<string> {
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `SO-${String(total + 1).padStart(5, "0")}`;
  }
}
