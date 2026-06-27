import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Batch,
  BatchListParams,
  BatchListResult,
} from "@/features/inventory/types/batch.types";

type DbBatch = Database["public"]["Tables"]["batches"]["Row"];
type DbBatchInsert = Database["public"]["Tables"]["batches"]["Insert"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function mapBatch(row: DbBatch): Batch {
  return {
    id: row.id,
    organizationId: row.organization_id,
    productId: row.product_id,
    batchNumber: row.batch_number,
    manufacturingDate: row.manufacturing_date,
    expiryDate: row.expiry_date,
    supplierBatch: row.supplier_batch,
    receivedQuantity: Number(row.received_quantity),
    remainingQuantity: Number(row.remaining_quantity),
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

export class BatchRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<Batch | null> {
    const { data, error } = await this.supabase
      .from("batches")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapBatch(data);
  }

  async findByNumber(
    productId: string,
    batchNumber: string
  ): Promise<Batch | null> {
    const { data, error } = await this.supabase
      .from("batches")
      .select("*")
      .eq("product_id", productId)
      .eq("batch_number", batchNumber.trim())
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapBatch(data);
  }

  async list(
    organizationId: string,
    params: BatchListParams = {}
  ): Promise<BatchListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("batches")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (params.productId) {
      query = query.eq("product_id", params.productId);
    }

    const { data, error, count } = await query
      .order("expiry_date", { ascending: true, nullsFirst: false })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    return {
      items: data.map(mapBatch),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async create(input: DbBatchInsert): Promise<Batch | null> {
    const { data, error } = await this.supabase
      .from("batches")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapBatch(data);
  }
}
