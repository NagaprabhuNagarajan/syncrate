import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { QuotationRepository } from "@/features/sales/repositories/quotation.repository";
import { computeGST } from "@/features/sales/utils/gst-engine";
import { computeDiscount } from "@/features/sales/utils/discount-engine";
import type {
  CreateQuotationInput,
  CreateQuotationItemInput,
  Quotation,
  QuotationActionResult,
  QuotationError,
  QuotationErrorCode,
  QuotationListParams,
  QuotationListResult,
  QuotationWithItems,
  UpdateQuotationInput,
} from "@/features/sales/types/quotation.types";

type DbQuotationItemInsert =
  Database["public"]["Tables"]["quotation_items"]["Insert"];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ok<T>(data: T): QuotationActionResult<T> {
  return { success: true, data };
}

function fail(
  code: QuotationErrorCode,
  message: string
): QuotationActionResult<never> {
  const error: QuotationError = { code, message };
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

interface ComputedQuotationLine {
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

interface ComputedQuotationTotals {
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
  input: CreateQuotationItemInput,
  orgState: string | null | undefined,
  supplyState: string | null | undefined
): ComputedQuotationLine {
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
  lines: readonly ComputedQuotationLine[]
): ComputedQuotationTotals {
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

  // isInterstate: true when IGST is present or when any line has IGST rate > 0
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

export class QuotationService {
  private readonly repo: QuotationRepository;

  constructor(supabase: AppSupabaseClient) {
    this.repo = new QuotationRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listQuotations(
    organizationId: string,
    params?: QuotationListParams
  ): Promise<QuotationListResult> {
    return this.repo.list(organizationId, params);
  }

  async getQuotation(
    id: string
  ): Promise<QuotationActionResult<QuotationWithItems>> {
    const quotation = await this.repo.findWithItems(id);
    if (!quotation) {
      return fail("not_found", "Quotation not found");
    }
    return ok(quotation);
  }

  // ── Create ─────────────────────────────────────────────────

  async createQuotation(
    input: CreateQuotationInput,
    organizationId: string,
    userId: string,
    orgState?: string | null
  ): Promise<QuotationActionResult<QuotationWithItems>> {
    const quotationNumber = await this.nextQuotationNumber(organizationId);
    const supplyState = nz(input.supplyState);
    const lines = input.items.map((item) =>
      computeLine(item, orgState, supplyState)
    );
    const totals = computeTotals(lines);

    const header = await this.repo.createHeader({
      organization_id: organizationId,
      quotation_number: quotationNumber,
      customer_id: input.customerId,
      branch_id: nz(input.branchId),
      salesperson_id: nz(input.salespersonId),
      reference_number: nz(input.referenceNumber),
      quotation_date:
        nz(input.quotationDate) ?? new Date().toISOString().slice(0, 10),
      expiry_date: nz(input.expiryDate),
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
      return fail("unknown", "Failed to create quotation. Please try again.");
    }

    const itemsInserted = await this.repo.insertItems(
      this.buildItemRows(input.items, lines, organizationId, header.id, userId)
    );

    if (!itemsInserted) {
      // Roll back the orphaned header so we never leave an item-less quotation
      await this.repo.softDelete(header.id, userId);
      return fail("unknown", "Failed to save line items. Please try again.");
    }

    const full = await this.repo.findWithItems(header.id);
    return ok(full ?? { ...header, items: [] });
  }

  // ── Update (draft only) ────────────────────────────────────

  async updateQuotation(
    quotationId: string,
    input: UpdateQuotationInput,
    organizationId: string,
    userId: string,
    orgState?: string | null
  ): Promise<QuotationActionResult<QuotationWithItems>> {
    const existing = await this.repo.findById(quotationId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Quotation not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft quotations can be edited."
      );
    }

    const supplyState = nz(input.supplyState);
    const lines = input.items.map((item) =>
      computeLine(item, orgState, supplyState)
    );
    const totals = computeTotals(lines);

    const headerResult = await this.repo.updateHeader(
      quotationId,
      {
        customer_id: input.customerId,
        branch_id: nz(input.branchId),
        salesperson_id: nz(input.salespersonId),
        reference_number: nz(input.referenceNumber),
        quotation_date:
          nz(input.quotationDate) ??
          existing.quotationDate.toISOString().slice(0, 10),
        expiry_date: nz(input.expiryDate),
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
        "This quotation was changed by someone else. Reload and try again."
      );
    }
    if (headerResult.status === "error") {
      return fail("unknown", "Failed to update quotation. Please try again.");
    }

    const replaced = await this.repo.replaceItems(
      quotationId,
      this.buildItemRows(
        input.items,
        lines,
        organizationId,
        quotationId,
        userId
      )
    );

    if (!replaced) {
      return fail("unknown", "Failed to update line items. Please try again.");
    }

    const full = await this.repo.findWithItems(quotationId);
    return ok(full ?? { ...headerResult.quotation, items: [] });
  }

  // ── Status transitions ─────────────────────────────────────

  async submitQuotation(
    quotationId: string,
    organizationId: string,
    userId: string
  ): Promise<QuotationActionResult<Quotation>> {
    return this.transition(
      quotationId,
      organizationId,
      userId,
      (s) => s === "draft",
      "sent",
      "Only draft quotations can be submitted"
    );
  }

  async markViewedQuotation(
    quotationId: string,
    organizationId: string,
    userId: string
  ): Promise<QuotationActionResult<Quotation>> {
    return this.transition(
      quotationId,
      organizationId,
      userId,
      (s) => s === "sent",
      "viewed",
      "Only sent quotations can be marked as viewed"
    );
  }

  async acceptQuotation(
    quotationId: string,
    organizationId: string,
    userId: string
  ): Promise<QuotationActionResult<Quotation>> {
    return this.transition(
      quotationId,
      organizationId,
      userId,
      (s) => s === "sent" || s === "viewed",
      "accepted",
      "Only sent or viewed quotations can be accepted"
    );
  }

  async rejectQuotation(
    quotationId: string,
    organizationId: string,
    userId: string
  ): Promise<QuotationActionResult<Quotation>> {
    return this.transition(
      quotationId,
      organizationId,
      userId,
      (s) => s === "sent" || s === "viewed",
      "rejected",
      "Only sent or viewed quotations can be rejected"
    );
  }

  async expireQuotation(
    quotationId: string,
    organizationId: string,
    userId: string
  ): Promise<QuotationActionResult<Quotation>> {
    return this.transition(
      quotationId,
      organizationId,
      userId,
      (s) =>
        s !== "accepted" &&
        s !== "rejected" &&
        s !== "expired" &&
        s !== "converted",
      "expired",
      "This quotation cannot be expired in its current status"
    );
  }

  /** Alias for `markViewedQuotation` — matches the spec method name. */
  async markViewed(
    quotationId: string,
    organizationId: string,
    userId: string
  ): Promise<QuotationActionResult<Quotation>> {
    return this.markViewedQuotation(quotationId, organizationId, userId);
  }

  async cancelQuotation(
    quotationId: string,
    organizationId: string,
    userId: string
  ): Promise<QuotationActionResult<Quotation>> {
    return this.transition(
      quotationId,
      organizationId,
      userId,
      (s) => s === "draft",
      "rejected",
      "Only draft quotations can be cancelled"
    );
  }

  /**
   * Marks a quotation as `converted` and stamps the SO id.
   * Actual SO creation is performed by the SalesOrderService.
   */
  async convertToSalesOrder(
    quotationId: string,
    organizationId: string,
    userId: string,
    salesOrderId: string
  ): Promise<QuotationActionResult<Quotation>> {
    const existing = await this.repo.findById(quotationId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Quotation not found");
    }
    if (
      existing.status !== "accepted" &&
      existing.status !== "sent" &&
      existing.status !== "viewed"
    ) {
      return fail(
        "invalid_status",
        "Only accepted, sent, or viewed quotations can be converted to a sales order"
      );
    }

    const updated = await this.repo.updateStatus(
      quotationId,
      "converted",
      userId,
      salesOrderId
    );
    if (!updated) {
      return fail(
        "unknown",
        "Failed to convert quotation. Please try again."
      );
    }
    return ok(updated);
  }

  // ── Helpers ────────────────────────────────────────────────

  private async transition(
    quotationId: string,
    organizationId: string,
    userId: string,
    allowed: (current: Quotation["status"]) => boolean,
    next: Quotation["status"],
    invalidMessage: string
  ): Promise<QuotationActionResult<Quotation>> {
    const existing = await this.repo.findById(quotationId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Quotation not found");
    }
    if (!allowed(existing.status)) {
      return fail("invalid_status", invalidMessage);
    }
    const updated = await this.repo.updateStatus(quotationId, next, userId);
    if (!updated) {
      return fail("unknown", "Failed to update quotation. Please try again.");
    }
    return ok(updated);
  }

  private buildItemRows(
    inputs: readonly CreateQuotationItemInput[],
    lines: readonly ComputedQuotationLine[],
    organizationId: string,
    quotationId: string,
    userId: string
  ): DbQuotationItemInsert[] {
    return inputs.map((input, index) => {
      const line = lines[index];
      if (!line) {
        throw new Error(`Assertion failed: computed line missing at index ${index}`);
      }
      return {
        organization_id: organizationId,
        quotation_id: quotationId,
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

  /** Generates the next sequential quotation number: `QT-#####`. */
  private async nextQuotationNumber(organizationId: string): Promise<string> {
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `QT-${String(total + 1).padStart(5, "0")}`;
  }
}
