import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  InventoryLevel,
  InventoryLevelListParams,
  InventoryLevelListResult,
  InventoryTransaction,
  InventoryTransactionListParams,
  InventoryTransactionType,
  StockLevel,
} from "@/features/inventory/types/inventory.types";

type AdjustStockArgs = Database["public"]["Functions"]["adjust_stock"]["Args"];
type TransferStockArgs =
  Database["public"]["Functions"]["transfer_stock"]["Args"];

/** Minimal error shape surfaced by Supabase RPC calls. */
export interface RpcError {
  readonly message: string;
}

/** Passthrough result of an atomic RPC call. */
export interface RpcResult<T> {
  readonly data: T | null;
  readonly error: RpcError | null;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_TX_LIMIT = 50;
const MAX_TX_LIMIT = 200;

// ─────────────────────────────────────────────────────────────
// Row shapes for embedded selects (PostgREST returns to-one joins as objects)
// ─────────────────────────────────────────────────────────────

interface ProductJoin {
  name: string;
  code: string;
  reorder_level: number;
  purchase_price: number;
}

interface BranchJoin {
  name: string;
  code: string;
}

interface LevelRow {
  id: string;
  organization_id: string;
  product_id: string;
  branch_id: string;
  quantity: number;
  reserved_quantity: number;
  products: ProductJoin | ProductJoin[] | null;
  branches: BranchJoin | BranchJoin[] | null;
}

interface TransactionRow {
  id: string;
  organization_id: string;
  product_id: string;
  branch_id: string;
  batch_id: string | null;
  type: InventoryTransactionType;
  quantity: number;
  running_balance: number;
  reference_type: string | null;
  reference_id: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
  products: Pick<ProductJoin, "name" | "code"> | ProductJoin[] | null;
  branches: BranchJoin | BranchJoin[] | null;
}

interface RawLevelRow {
  id: string;
  organization_id: string;
  product_id: string;
  branch_id: string;
  quantity: number;
  reserved_quantity: number;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** PostgREST may return an embedded to-one relation as an object or array. */
function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function sanitizeSearch(term: string): string {
  return term.trim().replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
}

function mapRawLevel(row: RawLevelRow): StockLevel {
  return {
    id: row.id,
    organizationId: row.organization_id,
    productId: row.product_id,
    branchId: row.branch_id,
    quantity: Number(row.quantity),
    reservedQuantity: Number(row.reserved_quantity),
  };
}

function mapLevel(row: LevelRow): InventoryLevel {
  const product = one(row.products);
  const branch = one(row.branches);
  return {
    id: row.id,
    organizationId: row.organization_id,
    productId: row.product_id,
    branchId: row.branch_id,
    quantity: Number(row.quantity),
    reservedQuantity: Number(row.reserved_quantity),
    productName: product?.name ?? "",
    productCode: product?.code ?? "",
    reorderLevel: product ? Number(product.reorder_level) : 0,
    purchasePrice: product ? Number(product.purchase_price) : 0,
    branchName: branch?.name ?? "",
    branchCode: branch?.code ?? "",
  };
}

function mapTransaction(row: TransactionRow): InventoryTransaction {
  const product = one(row.products);
  const branch = one(row.branches);
  return {
    id: row.id,
    organizationId: row.organization_id,
    productId: row.product_id,
    branchId: row.branch_id,
    batchId: row.batch_id,
    type: row.type,
    quantity: Number(row.quantity),
    runningBalance: Number(row.running_balance),
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    note: row.note,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
    productName: product?.name ?? null,
    productCode: product?.code ?? null,
    branchName: branch?.name ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

const LEVEL_SELECT =
  "id,organization_id,product_id,branch_id,quantity,reserved_quantity,products!inner(name,code,reorder_level,purchase_price),branches!inner(name,code)";

const TX_SELECT =
  "id,organization_id,product_id,branch_id,batch_id,type,quantity,running_balance,reference_type,reference_id,note,created_at,created_by,products(name,code),branches(name,code)";

export class InventoryRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  /** Raw snapshot for one (product, branch) pair, or null if untracked. */
  async getLevel(
    productId: string,
    branchId: string
  ): Promise<StockLevel | null> {
    const { data, error } = await this.supabase
      .from("inventory")
      .select("id,organization_id,product_id,branch_id,quantity,reserved_quantity")
      .eq("product_id", productId)
      .eq("branch_id", branchId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    return mapRawLevel(data as unknown as RawLevelRow);
  }

  async listLevels(
    organizationId: string,
    params: InventoryLevelListParams = {}
  ): Promise<InventoryLevelListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("inventory")
      .select(LEVEL_SELECT, { count: "exact" })
      .eq("organization_id", organizationId);

    if (params.branchId) {
      query = query.eq("branch_id", params.branchId);
    }

    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%`, {
          foreignTable: "products",
        });
      }
    }

    const { data, error, count } = await query
      .order("quantity", { ascending: true })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    let items = (data as unknown as LevelRow[]).map(mapLevel);

    // Low-stock is a column-to-column comparison PostgREST cannot express, so
    // it is applied to the fetched page. Total reflects the unfiltered count.
    if (params.lowStockOnly) {
      items = items.filter((item) => item.quantity <= item.reorderLevel);
    }

    return {
      items,
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async listTransactions(
    organizationId: string,
    params: InventoryTransactionListParams = {}
  ): Promise<InventoryTransaction[]> {
    const limit = Math.min(
      MAX_TX_LIMIT,
      Math.max(1, params.limit ?? DEFAULT_TX_LIMIT)
    );

    let query = this.supabase
      .from("inventory_transactions")
      .select(TX_SELECT)
      .eq("organization_id", organizationId);

    if (params.productId) {
      query = query.eq("product_id", params.productId);
    }
    if (params.branchId) {
      query = query.eq("branch_id", params.branchId);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }
    return (data as unknown as TransactionRow[]).map(mapTransaction);
  }

  /**
   * Applies a signed stock adjustment atomically. The Postgres function writes
   * the immutable ledger row and updates the snapshot in a single transaction,
   * and raises on `negative_stock`. Returns the new snapshot quantity.
   */
  async adjustStockRpc(args: AdjustStockArgs): Promise<RpcResult<number>> {
    const { data, error } = await this.supabase.rpc("adjust_stock", args);
    return { data: data ?? null, error };
  }

  /**
   * Moves stock between two branches atomically. The Postgres function writes
   * both ledger rows and updates both snapshots in a single transaction, and
   * raises on `invalid_quantity`, `same_warehouse`, or `insufficient_stock`.
   */
  async transferStockRpc(args: TransferStockArgs): Promise<RpcResult<null>> {
    const { error } = await this.supabase.rpc("transfer_stock", args);
    return { data: null, error };
  }
}
