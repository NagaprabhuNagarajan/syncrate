import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  BusinessConnection,
  ConnectionListParams,
  ConnectionStatus,
} from "@/features/cbn/types/cbn.types";

type DbRow = Database["public"]["Tables"]["business_connections"]["Row"];

// ─────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────

function mapRow(row: DbRow): BusinessConnection {
  return {
    id: row.id,
    organizationId: row.organization_id,
    requesterOrganizationId: row.requester_organization_id,
    recipientOrganizationId: row.recipient_organization_id,
    status: row.status,
    connectionMessage: row.connection_message,
    requesterGrants: row.requester_grants,
    recipientGrants: row.recipient_grants,
    requestedAt: new Date(row.requested_at),
    acceptedAt: row.accepted_at ? new Date(row.accepted_at) : null,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at) : null,
    disconnectedAt: row.disconnected_at ? new Date(row.disconnected_at) : null,
    rejectionReason: row.rejection_reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class ConnectionRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async findById(id: string): Promise<BusinessConnection | null> {
    const { data, error } = await this.supabase
      .from("business_connections")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {return null;}
    return mapRow(data);
  }

  /**
   * Lists all connections where the org is either requester or recipient.
   * The `organization_id` field is set to the caller's org by RLS.
   */
  async findByOrg(
    orgId: string,
    params?: ConnectionListParams
  ): Promise<BusinessConnection[]> {
    let query = this.supabase
      .from("business_connections")
      .select("*")
      .or(
        `requester_organization_id.eq.${orgId},recipient_organization_id.eq.${orgId}`
      )
      .is("deleted_at", null)
      .order("requested_at", { ascending: false });

    if (params?.status) {
      query = query.eq("status", params.status as ConnectionStatus);
    }
    if (params?.limit) {
      query = query.limit(params.limit);
    }
    if (params?.offset) {
      query = query.range(
        params.offset,
        params.offset + (params.limit ?? 20) - 1
      );
    }

    const { data, error } = await query;
    if (error || !data) {return [];}
    return data.map(mapRow);
  }

  async findBetweenOrgs(
    orgAId: string,
    orgBId: string
  ): Promise<BusinessConnection | null> {
    const { data, error } = await this.supabase
      .from("business_connections")
      .select("*")
      .or(
        `and(requester_organization_id.eq.${orgAId},recipient_organization_id.eq.${orgBId}),and(requester_organization_id.eq.${orgBId},recipient_organization_id.eq.${orgAId})`
      )
      .is("deleted_at", null)
      .limit(1)
      .single();

    if (error || !data) {return null;}
    return mapRow(data);
  }

  /** Returns pending incoming requests where the org is the recipient. */
  async findPendingForOrg(orgId: string): Promise<BusinessConnection[]> {
    const { data, error } = await this.supabase
      .from("business_connections")
      .select("*")
      .eq("recipient_organization_id", orgId)
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("requested_at", { ascending: false });

    if (error || !data) {return [];}
    return data.map(mapRow);
  }
}
