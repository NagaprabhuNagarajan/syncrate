import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  CustomerPayment,
  CustomerPaymentAllocation,
  CustomerPaymentListParams,
  CustomerPaymentListResult,
} from "@/features/payment/types/payment.types";

type DbCustomerPayment =
  Database["public"]["Tables"]["customer_payments"]["Row"];
type DbCustomerPaymentAllocation =
  Database["public"]["Tables"]["customer_payment_allocations"]["Row"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapPayment(
  row: DbCustomerPayment & { customers?: { name: string } | null }
): CustomerPayment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    paymentNumber: row.payment_number,
    customerId: row.customer_id,
    customerName: row.customers?.name ?? undefined,
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

function mapAllocation(row: DbCustomerPaymentAllocation): CustomerPaymentAllocation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    customerPaymentId: row.customer_payment_id,
    invoiceId: row.invoice_id,
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

export class CustomerPaymentRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findAll(
    orgId: string,
    params: CustomerPaymentListParams = {}
  ): Promise<CustomerPaymentListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("customer_payments")
      .select("*, customers(name)", { count: "exact" })
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

  async findById(id: string): Promise<CustomerPayment | null> {
    const { data, error } = await this.supabase
      .from("customer_payments")
      .select("*, customers(name)")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapPayment(data);
  }

  async findByCustomer(
    customerId: string,
    orgId: string
  ): Promise<CustomerPayment[]> {
    const { data, error } = await this.supabase
      .from("customer_payments")
      .select("*, customers(name)")
      .eq("customer_id", customerId)
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
  ): Promise<CustomerPaymentAllocation[]> {
    const { data, error } = await this.supabase
      .from("customer_payment_allocations")
      .select("*")
      .eq("customer_payment_id", paymentId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapAllocation);
  }

  async countByOrg(orgId: string): Promise<number> {
    const { count } = await this.supabase
      .from("customer_payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    return count ?? 0;
  }
}
