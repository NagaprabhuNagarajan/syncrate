import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  GoodsReceipt,
  GoodsReceiptItem,
  GoodsReceiptListParams,
  GoodsReceiptListResult,
  GoodsReceiptWithItems,
} from "@/features/purchase/types/goods-receipt.types";

type DbGoodsReceipt = Database["public"]["Tables"]["goods_receipts"]["Row"];
type DbGoodsReceiptItem =
  Database["public"]["Tables"]["goods_receipt_items"]["Row"];

/** Arguments accepted by the atomic `receive_goods` Postgres function. */
export type ReceiveGoodsArgs =
  Database["public"]["Functions"]["receive_goods"]["Args"];

/** Minimal error shape surfaced by Supabase RPC calls. */
export interface RpcError {
  readonly message: string;
}

/** Passthrough result of the atomic `receive_goods` RPC: the new GRN id. */
export interface ReceiveGoodsResult {
  readonly data: string | null;
  readonly error: RpcError | null;
}

/** Shape of the nested PO + supplier join used by list rows. */
interface PurchaseOrderJoin {
  po_number: string;
  suppliers: { name: string } | { name: string }[] | null;
}

type DbGoodsReceiptListRow = DbGoodsReceipt & {
  purchase_orders: PurchaseOrderJoin | PurchaseOrderJoin[] | null;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const LIST_SELECT =
  "*, purchase_orders(po_number, suppliers(name))";

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapGoodsReceipt(row: DbGoodsReceipt): GoodsReceipt {
  return {
    id: row.id,
    organizationId: row.organization_id,
    grnNumber: row.grn_number,
    purchaseOrderId: row.purchase_order_id,
    warehouseId: row.warehouse_id,
    receivedDate: new Date(row.received_date),
    status: row.status,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

function mapItem(row: DbGoodsReceiptItem): GoodsReceiptItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    goodsReceiptId: row.goods_receipt_id,
    purchaseOrderItemId: row.purchase_order_item_id,
    productId: row.product_id,
    orderedQuantity: Number(row.ordered_quantity),
    receivedQuantity: Number(row.received_quantity),
    rejectedQuantity: Number(row.rejected_quantity),
    batchId: row.batch_id,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
  };
}

/** PostgREST may return an embedded to-one relation as an object or array. */
function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function readSupplierName(po: PurchaseOrderJoin | null): string | null {
  if (!po) {
    return null;
  }
  const supplier = one(po.suppliers);
  return supplier?.name ?? null;
}

/** Escapes PostgREST `or()`/ILIKE meta-characters so search stays safe. */
function sanitizeSearch(term: string): string {
  return term.trim().replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class GoodsReceiptRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<GoodsReceipt | null> {
    const { data, error } = await this.supabase
      .from("goods_receipts")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapGoodsReceipt(data);
  }

  async findItems(goodsReceiptId: string): Promise<GoodsReceiptItem[]> {
    const { data, error } = await this.supabase
      .from("goods_receipt_items")
      .select("*")
      .eq("goods_receipt_id", goodsReceiptId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapItem);
  }

  async findWithItems(id: string): Promise<GoodsReceiptWithItems | null> {
    const header = await this.findById(id);
    if (!header) {
      return null;
    }
    const items = await this.findItems(id);
    return { ...header, items };
  }

  async list(
    organizationId: string,
    params: GoodsReceiptListParams = {}
  ): Promise<GoodsReceiptListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("goods_receipts")
      .select(LIST_SELECT, { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.ilike("grn_number", `%${term}%`);
      }
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    const rows = data as unknown as DbGoodsReceiptListRow[];
    return {
      items: rows.map((row) => {
        const po = one(row.purchase_orders);
        return {
          ...mapGoodsReceipt(row),
          poNumber: po?.po_number ?? null,
          supplierName: readSupplierName(po),
        };
      }),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  /**
   * Records a goods receipt atomically via the `receive_goods` Postgres
   * function. In a single transaction it inserts the GRN header + items, writes
   * one `purchase` stock event per received line, bumps each PO line's
   * received quantity, and advances the PO status. It raises on `not_found`,
   * `invalid_status`, `negative_stock`, or `insufficient_stock`. Returns the
   * new GRN id.
   */
  async receiveGoodsRpc(args: ReceiveGoodsArgs): Promise<ReceiveGoodsResult> {
    const { data, error } = await this.supabase.rpc("receive_goods", args);
    return { data: data ?? null, error };
  }
}
