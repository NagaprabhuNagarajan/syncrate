import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type { CbnEvent, CbnEventListParams } from "@/features/cbn/types/cbn.types";

type DbRow = Database["public"]["Tables"]["cbn_events"]["Row"];

// ─────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────

function mapRow(row: DbRow): CbnEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    connectionId: row.connection_id,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    sourceOrganizationId: row.source_organization_id,
    targetOrganizationId: row.target_organization_id,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    correlationId: row.correlation_id,
    metadata: row.metadata,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: new Date(row.created_at),
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class CbnEventsRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async listByOrg(
    orgId: string,
    params?: CbnEventListParams
  ): Promise<CbnEvent[]> {
    let query = this.supabase
      .from("cbn_events")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (params?.eventType) {
      query = query.eq("event_type", params.eventType);
    }
    if (params?.limit) {
      const limit = params.limit;
      const offset = params.offset ?? 0;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (error || !data) {return [];}
    return data.map(mapRow);
  }

  async listByConnection(
    connectionId: string,
    params?: CbnEventListParams
  ): Promise<CbnEvent[]> {
    let query = this.supabase
      .from("cbn_events")
      .select("*")
      .eq("connection_id", connectionId)
      .order("created_at", { ascending: false });

    if (params?.eventType) {
      query = query.eq("event_type", params.eventType);
    }
    if (params?.limit) {
      const limit = params.limit;
      const offset = params.offset ?? 0;
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;
    if (error || !data) {return [];}
    return data.map(mapRow);
  }
}
