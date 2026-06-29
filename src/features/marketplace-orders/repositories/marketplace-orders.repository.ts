import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  MarketplaceOrder,
  MarketplacePayment,
  OrderListParams,
  OrderListResult,
} from "@/features/marketplace-orders/types/marketplace-orders.types";

type DbOrder = Database["public"]["Tables"]["marketplace_orders"]["Row"];
type DbOrderInsert =
  Database["public"]["Tables"]["marketplace_orders"]["Insert"];
type DbPayment = Database["public"]["Tables"]["marketplace_payments"]["Row"];
type DbPaymentInsert =
  Database["public"]["Tables"]["marketplace_payments"]["Insert"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapOrder(row: DbOrder): MarketplaceOrder {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sellerOrganizationId: row.seller_organization_id,
    listingId: row.listing_id,
    status: row.status,
    quantity: Number(row.quantity),
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    version: row.version,
  };
}

function mapPayment(row: DbPayment): MarketplacePayment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    counterpartyOrganizationId: row.counterparty_organization_id,
    orderId: row.order_id,
    provider: row.provider,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    externalReference: row.external_reference,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    version: row.version,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class MarketplaceOrdersRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  // ── Orders ─────────────────────────────────────────────────

  async findOrderById(id: string): Promise<MarketplaceOrder | null> {
    const { data, error } = await this.supabase
      .from("marketplace_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }
    return mapOrder(data);
  }

  /**
   * Lists orders the org participates in (buyer OR seller). RLS already scopes
   * visibility to the two parties; the perspective filter narrows further.
   */
  async listOrders(
    organizationId: string,
    params: OrderListParams = {}
  ): Promise<OrderListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const perspective = params.perspective ?? "all";

    let query = this.supabase
      .from("marketplace_orders")
      .select("*", { count: "exact" });

    if (perspective === "buying") {
      query = query.eq("organization_id", organizationId);
    } else if (perspective === "selling") {
      query = query.eq("seller_organization_id", organizationId);
    } else {
      query = query.or(
        `organization_id.eq.${organizationId},seller_organization_id.eq.${organizationId}`
      );
    }

    if (params.status) {
      query = query.eq("status", params.status);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error || !data) {
      return { items: [], total: 0, page, pageSize };
    }

    return {
      items: data.map(mapOrder),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  async createOrder(input: DbOrderInsert): Promise<MarketplaceOrder | null> {
    const { data, error } = await this.supabase
      .from("marketplace_orders")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapOrder(data);
  }

  /**
   * Optimistic-locked status change: matches only when the stored `version`
   * equals `expectedVersion`. A concurrent write bumps the version so a stale
   * caller matches no row and gets `null` — mapped to a conflict by the service.
   */
  async updateOrderStatus(
    id: string,
    status: DbOrder["status"],
    updatedBy: string,
    expectedVersion: number
  ): Promise<MarketplaceOrder | null> {
    const { data, error } = await this.supabase
      .from("marketplace_orders")
      .update({
        status,
        version: expectedVersion + 1,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("version", expectedVersion)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapOrder(data);
  }

  // ── Payments ───────────────────────────────────────────────

  async findPaymentById(id: string): Promise<MarketplacePayment | null> {
    const { data, error } = await this.supabase
      .from("marketplace_payments")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }
    return mapPayment(data);
  }

  async findPaymentByOrderId(
    orderId: string
  ): Promise<MarketplacePayment | null> {
    const { data, error } = await this.supabase
      .from("marketplace_payments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    return mapPayment(data);
  }

  async createPayment(
    input: DbPaymentInsert
  ): Promise<MarketplacePayment | null> {
    const { data, error } = await this.supabase
      .from("marketplace_payments")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapPayment(data);
  }

  /** Optimistic-locked payment state change (same contract as orders). */
  async updatePaymentStatus(
    id: string,
    patch: {
      status: DbPayment["status"];
      external_reference?: string | null;
    },
    updatedBy: string,
    expectedVersion: number
  ): Promise<MarketplacePayment | null> {
    const { data, error } = await this.supabase
      .from("marketplace_payments")
      .update({
        ...patch,
        version: expectedVersion + 1,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("version", expectedVersion)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapPayment(data);
  }
}
