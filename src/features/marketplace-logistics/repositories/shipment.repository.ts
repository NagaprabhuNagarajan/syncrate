import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  Shipment,
  ShipmentListParams,
  ShipmentListResult,
  ShipmentOrderRef,
} from "@/features/marketplace-logistics/types/logistics.types";

type DbShipment = Database["public"]["Tables"]["marketplace_shipments"]["Row"];
type DbShipmentInsert =
  Database["public"]["Tables"]["marketplace_shipments"]["Insert"];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────

function mapShipment(row: DbShipment): Shipment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    counterpartyOrganizationId: row.counterparty_organization_id,
    orderId: row.order_id,
    provider: row.provider,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    status: row.status,
    shippedAt: row.shipped_at === null ? null : new Date(row.shipped_at),
    deliveredAt: row.delivered_at === null ? null : new Date(row.delivered_at),
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

export class ShipmentRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<Shipment | null> {
    const { data, error } = await this.supabase
      .from("marketplace_shipments")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }
    return mapShipment(data);
  }

  /**
   * Lists shipments where the org is either the shipper (`organization_id`) or
   * the recipient (`counterparty_organization_id`). Both rows are visible under
   * two-party RLS; this filter scopes to a single org's involvement.
   */
  async listForOrg(
    organizationId: string,
    params: ShipmentListParams = {}
  ): Promise<ShipmentListResult> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from("marketplace_shipments")
      .select("*", { count: "exact" })
      .or(
        `organization_id.eq.${organizationId},counterparty_organization_id.eq.${organizationId}`
      );

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
      items: data.map(mapShipment),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  /**
   * Reads the minimal order projection needed to authorize and seed a shipment.
   * The order is visible to both parties under the order's two-party RLS.
   */
  async findOrderById(orderId: string): Promise<ShipmentOrderRef | null> {
    const { data, error } = await this.supabase
      .from("marketplace_orders")
      .select("id, organization_id, seller_organization_id, status")
      .eq("id", orderId)
      .single();

    if (error || !data) {
      return null;
    }
    return {
      id: data.id,
      buyerOrganizationId: data.organization_id,
      sellerOrganizationId: data.seller_organization_id,
      status: data.status,
    };
  }

  async create(input: DbShipmentInsert): Promise<Shipment | null> {
    const { data, error } = await this.supabase
      .from("marketplace_shipments")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapShipment(data);
  }

  /**
   * Optimistic-locked status update: only matches when the stored `version`
   * equals `expectedVersion`. A concurrent write bumps the version, so a stale
   * caller matches no row and gets `null` — the service maps this to a conflict.
   */
  async updateStatus(
    id: string,
    patch: Partial<DbShipment>,
    updatedBy: string,
    expectedVersion: number
  ): Promise<Shipment | null> {
    const { data, error } = await this.supabase
      .from("marketplace_shipments")
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
    return mapShipment(data);
  }
}
