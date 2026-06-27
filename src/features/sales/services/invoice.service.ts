import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import { InvoiceRepository } from "@/features/sales/repositories/invoice.repository";
import { computeGST } from "@/features/sales/utils/gst-engine";
import type {
  CreateInvoiceInput,
  CreateInvoiceItemInput,
  Invoice,
  InvoiceActionResult,
  InvoiceError,
  InvoiceErrorCode,
  InvoiceItem,
  InvoiceListParams,
  InvoiceListResult,
  InvoiceType,
  InvoiceWithItems,
  UpdateInvoiceInput,
} from "@/features/sales/types/invoice.types";

type DbInvoiceItemInsert =
  Database["public"]["Tables"]["invoice_items"]["Insert"];
type DbSalesOrderItem =
  Database["public"]["Tables"]["sales_order_items"]["Row"];

function ok<T>(data: T): InvoiceActionResult<T> {
  return { success: true, data };
}

function fail(
  code: InvoiceErrorCode,
  message: string
): InvoiceActionResult<never> {
  const error: InvoiceError = { code, message };
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
 * Maps a raw `post_sales_invoice` RPC error message to a domain error code.
 * The Postgres function raises messages that CONTAIN a stable token.
 */
function mapPostError(message: string): InvoiceErrorCode {
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
// Totals computation (GST-aware)
// ─────────────────────────────────────────────────────────────

interface ComputedLine {
  readonly quantity: number;
  readonly unitPrice: number;
  readonly gross: number;
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

interface ComputedTotals {
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly cgstAmount: number;
  readonly sgstAmount: number;
  readonly igstAmount: number;
  readonly taxAmount: number;
  readonly roundOff: number;
  readonly totalAmount: number;
}

/**
 * Computes a single line item's monetary and GST breakdown.
 *
 *   gross          = qty * unitPrice
 *   discountAmount = gross * discountPercent / 100
 *   taxableAmount  = gross − discountAmount
 *   [GST from engine using taxableAmount, gstRate, orgState, supplyState]
 *   lineTotal      = taxableAmount + taxAmount
 */
function computeLine(
  input: CreateInvoiceItemInput,
  orgState: string | null,
  supplyState: string | null
): ComputedLine {
  const quantity = input.quantity;
  const unitPrice = input.unitPrice;
  const discountPercent = input.discountPercent ?? 0;
  const gstRate = input.gstRate ?? 0;

  const gross = quantity * unitPrice;
  const discountAmount = round2(gross * (discountPercent / 100));
  const taxableAmount = round2(gross - discountAmount);

  const gst = computeGST({ taxableAmount, gstRate, orgState, supplyState });
  const lineTotal = round2(taxableAmount + gst.taxAmount);

  return {
    quantity,
    unitPrice,
    gross,
    discountPercent,
    discountAmount,
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
 *
 *   subtotal       = Σ gross
 *   discountAmount = Σ line.discountAmount
 *   cgstAmount     = Σ line.cgstAmount
 *   sgstAmount     = Σ line.sgstAmount
 *   igstAmount     = Σ line.igstAmount
 *   taxAmount      = cgst + sgst + igst
 *   rawTotal       = subtotal − discount + tax
 *   roundOff       = Math.round(rawTotal) − rawTotal
 *   totalAmount    = rawTotal + roundOff
 */
function computeTotals(lines: readonly ComputedLine[]): ComputedTotals {
  const subtotal = round2(lines.reduce((s, l) => s + l.gross, 0));
  const discountAmount = round2(
    lines.reduce((s, l) => s + l.discountAmount, 0)
  );
  const cgstAmount = round2(lines.reduce((s, l) => s + l.cgstAmount, 0));
  const sgstAmount = round2(lines.reduce((s, l) => s + l.sgstAmount, 0));
  const igstAmount = round2(lines.reduce((s, l) => s + l.igstAmount, 0));
  const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);

  const rawTotal = subtotal - discountAmount + taxAmount;
  const roundOff = round2(Math.round(rawTotal) - rawTotal);
  const totalAmount = round2(rawTotal + roundOff);

  return {
    subtotal,
    discountAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    roundOff,
    totalAmount,
  };
}

export class InvoiceService {
  private readonly repo: InvoiceRepository;

  constructor(private readonly supabase: AppSupabaseClient) {
    this.repo = new InvoiceRepository(supabase);
  }

  // ── Reads ──────────────────────────────────────────────────

  async listInvoices(
    organizationId: string,
    params?: InvoiceListParams
  ): Promise<InvoiceListResult> {
    return this.repo.list(organizationId, params);
  }

  async getInvoice(
    id: string
  ): Promise<InvoiceActionResult<InvoiceWithItems>> {
    const invoice = await this.repo.findWithItems(id);
    if (!invoice) {
      return fail("not_found", "Invoice not found");
    }
    return ok(invoice);
  }

  // ── Create ─────────────────────────────────────────────────

  async createInvoice(
    input: CreateInvoiceInput,
    organizationId: string,
    userId: string,
    orgState: string | null
  ): Promise<InvoiceActionResult<InvoiceWithItems>> {
    const invoiceNumber = await this.nextInvoiceNumber(organizationId);
    const supplyState = nz(input.supplyState);
    const isInterstate = input.isInterstate ?? false;

    const lines = input.items.map((item) =>
      computeLine(item, orgState, supplyState)
    );
    const totals = computeTotals(lines);

    const header = await this.repo.createHeader({
      organization_id: organizationId,
      invoice_number: invoiceNumber,
      invoice_type: (input.invoiceType as InvoiceType) ?? "tax_invoice",
      customer_id: input.customerId,
      sales_order_id: nz(input.salesOrderId),
      quotation_id: nz(input.quotationId),
      branch_id: nz(input.branchId),
      warehouse_id: nz(input.warehouseId),
      reference_number: nz(input.referenceNumber),
      invoice_date:
        nz(input.invoiceDate) ?? new Date().toISOString().slice(0, 10),
      due_date: nz(input.dueDate),
      payment_terms_days: input.paymentTermsDays ?? 0,
      supply_state: supplyState,
      is_interstate: isInterstate,
      status: "draft",
      payment_status: "unpaid",
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      cgst_amount: totals.cgstAmount,
      sgst_amount: totals.sgstAmount,
      igst_amount: totals.igstAmount,
      tax_amount: totals.taxAmount,
      round_off: totals.roundOff,
      total_amount: totals.totalAmount,
      amount_paid: 0,
      notes: nz(input.notes),
      terms: nz(input.terms),
      created_by: userId,
    });

    if (!header) {
      return fail("unknown", "Failed to create invoice. Please try again.");
    }

    const itemsInserted = await this.repo.insertItems(
      this.buildItemRows(
        input.items,
        lines,
        organizationId,
        header.id,
        userId
      )
    );

    if (!itemsInserted) {
      // Roll back the orphaned header so we never leave an item-less invoice.
      await this.repo.softDelete(header.id, userId);
      return fail("unknown", "Failed to save line items. Please try again.");
    }

    const full = await this.repo.findWithItems(header.id);
    return ok(full ?? { ...header, items: [] as readonly InvoiceItem[] });
  }

  // ── Update (draft only) ────────────────────────────────────

  async updateInvoice(
    invoiceId: string,
    input: UpdateInvoiceInput,
    organizationId: string,
    userId: string,
    orgState: string | null
  ): Promise<InvoiceActionResult<InvoiceWithItems>> {
    const existing = await this.repo.findById(invoiceId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Invoice not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft invoices can be edited. Posted invoices are immutable."
      );
    }

    const supplyState = nz(input.supplyState);
    const isInterstate = input.isInterstate ?? existing.isInterstate;
    const lines = input.items.map((item) =>
      computeLine(item, orgState, supplyState)
    );
    const totals = computeTotals(lines);

    const header = await this.repo.updateHeader(
      invoiceId,
      {
        invoice_type:
          (input.invoiceType as InvoiceType) ?? existing.invoiceType,
        customer_id: input.customerId,
        sales_order_id: nz(input.salesOrderId),
        quotation_id: nz(input.quotationId),
        branch_id: nz(input.branchId),
        warehouse_id: nz(input.warehouseId),
        reference_number: nz(input.referenceNumber),
        invoice_date:
          nz(input.invoiceDate) ??
          existing.invoiceDate.toISOString().slice(0, 10),
        due_date: nz(input.dueDate),
        payment_terms_days:
          input.paymentTermsDays ?? existing.paymentTermsDays,
        supply_state: supplyState,
        is_interstate: isInterstate,
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

    if (!header) {
      // The draft existed and was a draft, so a missing row here means the
      // optimistic lock failed: someone edited it since this form loaded.
      return fail(
        "conflict",
        "This invoice was changed by someone else. Reload and try again."
      );
    }

    const replaced = await this.repo.replaceItems(
      invoiceId,
      this.buildItemRows(input.items, lines, organizationId, invoiceId, userId)
    );

    if (!replaced) {
      return fail("unknown", "Failed to update line items. Please try again.");
    }

    const full = await this.repo.findWithItems(invoiceId);
    return ok(full ?? { ...header, items: [] as readonly InvoiceItem[] });
  }

  // ── Post (draft → posted; atomic via RPC) ──────────────────

  /**
   * Posts a draft invoice atomically. The `post_sales_invoice` Postgres
   * function stamps the invoice posted AND appends the customer-ledger debit
   * (receivable increases) in a single transaction, so this service only
   * delegates to the RPC, maps any raised error and re-fetches.
   */
  async postInvoice(
    invoiceId: string,
    _organizationId: string,
    _userId: string
  ): Promise<InvoiceActionResult<Invoice>> {
    const { error } = await this.repo.postInvoiceRpc(invoiceId);
    if (error) {
      return fail(mapPostError(error.message), "Failed to post invoice.");
    }

    const posted = await this.repo.findById(invoiceId);
    if (!posted) {
      return fail("not_found", "Invoice not found");
    }
    return ok(posted);
  }

  // ── Cancel (draft only; posted invoices are immutable) ─────

  async cancelInvoice(
    invoiceId: string,
    organizationId: string,
    userId: string
  ): Promise<InvoiceActionResult<Invoice>> {
    const existing = await this.repo.findById(invoiceId);
    if (!existing || existing.organizationId !== organizationId) {
      return fail("not_found", "Invoice not found");
    }
    if (existing.status !== "draft") {
      return fail(
        "invalid_status",
        "Only draft invoices can be cancelled. Posted invoices are immutable."
      );
    }

    const cancelled = await this.repo.updateStatus(
      invoiceId,
      "cancelled",
      userId
    );
    if (!cancelled) {
      return fail("unknown", "Failed to cancel invoice. Please try again.");
    }
    return ok(cancelled);
  }

  // ── Convert from Sales Order ───────────────────────────────

  /**
   * Creates a draft invoice by copying all items from an approved/processing
   * sales order. The SO's supply_state and is_interstate flags drive GST
   * computation so the invoice mirrors the SO exactly.
   */
  async convertFromSalesOrder(
    salesOrderId: string,
    organizationId: string,
    userId: string,
    orgState: string | null
  ): Promise<InvoiceActionResult<InvoiceWithItems>> {
    // Fetch the sales order header
    const { data: soData, error: soError } = await this.supabase
      .from("sales_orders")
      .select("*")
      .eq("id", salesOrderId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (soError || !soData) {
      return fail("not_found", "Sales order not found");
    }

    // Fetch line items
    const { data: soItems, error: itemsError } = await this.supabase
      .from("sales_order_items")
      .select("*")
      .eq("sales_order_id", salesOrderId)
      .order("sort_order", { ascending: true });

    if (itemsError || !soItems || soItems.length === 0) {
      return fail("validation", "Sales order has no line items to convert");
    }

    // Map SO items into CreateInvoiceItemInput
    const items: CreateInvoiceItemInput[] = (
      soItems as DbSalesOrderItem[]
    ).map((item) => ({
      productId: item.product_id,
      description: item.description ?? undefined,
      hsnCode: item.hsn_code ?? undefined,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      discountPercent: Number(item.discount_percent),
      gstRate: Number(item.gst_rate),
    }));

    const input: CreateInvoiceInput = {
      customerId: soData.customer_id,
      salesOrderId,
      branchId: soData.branch_id ?? undefined,
      warehouseId: soData.warehouse_id ?? undefined,
      supplyState: soData.supply_state ?? undefined,
      isInterstate: soData.is_interstate,
      paymentTermsDays: soData.payment_terms_days,
      notes: soData.notes ?? undefined,
      terms: soData.terms ?? undefined,
      items,
    };

    return this.createInvoice(input, organizationId, userId, orgState);
  }

  // ── Helpers ────────────────────────────────────────────────

  private buildItemRows(
    inputs: readonly CreateInvoiceItemInput[],
    lines: readonly ComputedLine[],
    organizationId: string,
    invoiceId: string,
    userId: string
  ): DbInvoiceItemInsert[] {
    return inputs.map((input, index) => {
      const line = lines[index];
      return {
        organization_id: organizationId,
        invoice_id: invoiceId,
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
        sort_order: index,
        created_by: userId,
      };
    });
  }

  /** Generates the next sequential invoice number: `INV-#####`. */
  private async nextInvoiceNumber(organizationId: string): Promise<string> {
    const { total } = await this.repo.list(organizationId, { pageSize: 1 });
    return `INV-${String(total + 1).padStart(5, "0")}`;
  }
}
