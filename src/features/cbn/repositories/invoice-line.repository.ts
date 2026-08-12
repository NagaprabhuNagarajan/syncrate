import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  CbnDocumentKind,
  CbnInvoiceLine,
} from "@/features/cbn/types/cbn.types";

type DbInvoiceRow = Database["public"]["Tables"]["cbn_invoice_items"]["Row"];
type DbPoRow = Database["public"]["Tables"]["cbn_purchase_order_items"]["Row"];
type DbRow = DbInvoiceRow | DbPoRow;

/**
 * The two payload tables are structurally identical apart from the parent key
 * and the product-id column name, so one mapper serves both.
 */
function parentIdOf(row: DbRow): string {
  return "cbn_invoice_id" in row ? row.cbn_invoice_id : row.cbn_purchase_order_id;
}

function counterpartyProductIdOf(row: DbRow): string | null {
  return "supplier_product_id" in row
    ? row.supplier_product_id
    : row.counterparty_product_id;
}

function mapRow(row: DbRow): CbnInvoiceLine {
  return {
    id: row.id,
    cbnInvoiceId: parentIdOf(row),
    sortOrder: row.sort_order,
    supplierProductId: counterpartyProductIdOf(row),
    productName: row.product_name,
    productSku: row.product_sku,
    productBarcode: row.product_barcode,
    hsnCode: row.hsn_code,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    gstRate: Number(row.gst_rate),
    taxAmount: Number(row.tax_amount),
    lineTotal: Number(row.line_total),
  };
}

/**
 * Reads the line snapshot that travelled with a CBN invoice. Both the sender
 * and the receiving organization can select these rows (see the RLS policy on
 * cbn_invoice_items), which is what lets the buyer map them to their own
 * products before accepting.
 */
export class InvoiceLineRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  /**
   * Returns null — not an empty array — when the read itself fails. The two
   * cases mean opposite things: an empty array is "this invoice genuinely has
   * no lines, ask the sender to resend", whereas a failed read is "the table is
   * missing or RLS blocked us". Collapsing them into `[]` sent us chasing the
   * wrong cause once already.
   */
  async listByCbnInvoice(
    cbnInvoiceId: string,
    kind: CbnDocumentKind = "invoice"
  ): Promise<readonly CbnInvoiceLine[] | null> {
    // Branched rather than parameterized: the two tables have different key
    // columns, and the generated types narrow `eq()` per table, so a computed
    // column name would not typecheck.
    const { data, error } =
      kind === "invoice"
        ? await this.supabase
            .from("cbn_invoice_items")
            .select("*")
            .eq("cbn_invoice_id", cbnInvoiceId)
            .is("deleted_at", null)
            .order("sort_order", { ascending: true })
        : await this.supabase
            .from("cbn_purchase_order_items")
            .select("*")
            .eq("cbn_purchase_order_id", cbnInvoiceId)
            .is("deleted_at", null)
            .order("sort_order", { ascending: true });

    if (error || !data) {
      return null;
    }
    return (data as DbRow[]).map(mapRow);
  }
}
