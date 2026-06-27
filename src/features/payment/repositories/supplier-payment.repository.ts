import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  SupplierPayment,
  SupplierPaymentAllocation,
  SupplierPaymentListParams,
  SupplierPaymentListResult,
} from "@/features/payment/types/payment.types";

type DbSupplierPayment =
  Database["public"]["Tables"]["supplier_payments"]["Row"];
type DbSupplierPaymentAllocation =
  Database["public"]["Tables"]["supplier_payment_allocations"]["Row"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapPayment(
  row: DbSupplierPayment & { suppliers?: { name: string } | null }
): SupplierPayment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    paymentNumber: row.payment_number,
    supplierId: row.supplier_id,
    supplierName: row.suppliers?.name ?? undefined,
    paymentDate: row.payment_date,
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    referenceNumber: row.reference_number,
    notes: row.notes,
    status: row.status,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

function mapAllocation(
  row: DbSupplierPaymentAllocation
): SupplierPaymentAllocation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    supplierPaymentId: row.supplier_payment_id,
    purchaseInvoiceId: row.purchase_invoice_id,
    allocatedAmount: Number(row.allocated_amount),
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function sanitizeSearch(term: string): string {
  return term.trim().replace(/[,()%]/g, " ").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class SupplierPaymentRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findAll(
    orgId: string,
    params: SupplierPaymentListParams = {}
  ): Promise<SupplierPaymentListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("supplier_payments")
      .select("*, suppliers(name)", { count: "exact" })
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.search) {
      const term = sanitizeSearch(params.search);
      if (term) {
        query = query.or(
          `payment_number.ilike.%${term}%,reference_number.ilike.%${term}%`
        );
      }
    }

    const { data, error, count } = await query
      .order("payment_date", { ascending: false })
      .range(from, to);

    if (error || !data) {
      return { payments: [], total: 0, page, pageSize };
    }

    return {
      payments: data.map(mapPayment),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async findById(id: string): Promise<SupplierPayment | null> {
    const { data, error } = await this.supabase
      .from("supplier_payments")
      .select("*, suppliers(name)")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapPayment(data);
  }

  async findBySupplier(
    supplierId: string,
    orgId: string
  ): Promise<SupplierPayment[]> {
    const { data, error } = await this.supabase
      .from("supplier_payments")
      .select("*, suppliers(name)")
      .eq("supplier_id", supplierId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("payment_date", { ascending: false });

    if (error || !data) {
      return [];
    }
    return data.map(mapPayment);
  }

  async findAllocations(
    paymentId: string
  ): Promise<SupplierPaymentAllocation[]> {
    const { data, error } = await this.supabase
      .from("supplier_payment_allocations")
      .select("*")
      .eq("supplier_payment_id", paymentId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapAllocation);
  }

  async countByOrg(orgId: string): Promise<number> {
    const { count } = await this.supabase
      .from("supplier_payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    return count ?? 0;
  }
}
