import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  PaymentStats,
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

  /**
   * The supplier's unallocated advance credit — Σ over their completed payments
   * of `(amount − Σ its allocations)`, clamped to `>= 0`. Mirrors the
   * `apply_supplier_credit` RPC's availability calc (completed payments only, no
   * soft-delete filter) so the UI never offers more credit than the RPC will
   * draw down. Returns 0 when the supplier has no completed payments.
   */
  async getAvailableCredit(
    organizationId: string,
    supplierId: string
  ): Promise<number> {
    const { data: payments, error } = await this.supabase
      .from("supplier_payments")
      .select("id, amount")
      .eq("organization_id", organizationId)
      .eq("supplier_id", supplierId)
      .eq("status", "completed");

    if (error || !payments || payments.length === 0) {
      return 0;
    }

    const paymentIds = payments.map((p) => p.id);
    const { data: allocations } = await this.supabase
      .from("supplier_payment_allocations")
      .select("supplier_payment_id, allocated_amount")
      .in("supplier_payment_id", paymentIds);

    const allocatedByPayment = new Map<string, number>();
    for (const row of allocations ?? []) {
      const prior = allocatedByPayment.get(row.supplier_payment_id) ?? 0;
      allocatedByPayment.set(
        row.supplier_payment_id,
        prior + Number(row.allocated_amount)
      );
    }

    const total = payments.reduce((sum, p) => {
      const unallocated =
        Number(p.amount) - (allocatedByPayment.get(p.id) ?? 0);
      return sum + Math.max(0, unallocated);
    }, 0);

    return Math.max(0, total);
  }

  async countByOrg(orgId: string): Promise<number> {
    const { count } = await this.supabase
      .from("supplier_payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    return count ?? 0;
  }

  /**
   * Aggregate counts + money sums for the list header tiles. Head-only count
   * queries run in parallel for the status tiles. The money aggregates (total
   * paid + this month) need sums PostgREST cannot compute via head queries, so
   * we fetch the minimal `amount`/`payment_date` columns for completed
   * payments and reduce in JS.
   */
  async getStats(orgId: string): Promise<PaymentStats> {
    const base = () =>
      this.supabase
        .from("supplier_payments")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .is("deleted_at", null);

    const [total, completed, voided] = await Promise.all([
      base(),
      base().eq("status", "completed"),
      base().eq("status", "voided"),
    ]);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString().slice(0, 10);

    const { data: amountRows } = await this.supabase
      .from("supplier_payments")
      .select("amount, payment_date")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .eq("status", "completed");

    let totalAmount = 0;
    let thisMonth = 0;
    for (const row of amountRows ?? []) {
      const amount = Number(row.amount);
      totalAmount += amount;
      if (row.payment_date >= monthStartIso) {
        thisMonth += amount;
      }
    }

    return {
      total: total.count ?? 0,
      completed: completed.count ?? 0,
      voided: voided.count ?? 0,
      totalAmount,
      thisMonth,
    };
  }
}
