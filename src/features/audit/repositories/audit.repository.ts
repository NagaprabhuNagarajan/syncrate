import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database, Json } from "@/types/database.types";
import type {
  AuditLog,
  AuditListParams,
  LogAuditInput,
} from "@/features/audit/types/audit.types";

type DbAuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function mapAuditLog(row: DbAuditLog): AuditLog {
  return {
    id: row.id,
    organizationId: row.organization_id,
    actorUserId: row.actor_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at),
  };
}

export class AuditRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  /** Appends an audit entry. Returns false on failure (never throws). */
  async insert(input: LogAuditInput): Promise<boolean> {
    const { error } = await this.supabase.from("audit_logs").insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      summary: input.summary ?? null,
      metadata: (input.metadata ?? {}) as Json,
    });

    return !error;
  }

  async listByOrg(
    organizationId: string,
    params: AuditListParams = {}
  ): Promise<AuditLog[]> {
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));

    let query = this.supabase
      .from("audit_logs")
      .select("*")
      .eq("organization_id", organizationId);

    if (params.entityType) {
      query = query.eq("entity_type", params.entityType);
    }
    if (params.entityId) {
      query = query.eq("entity_id", params.entityId);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }
    return data.map(mapAuditLog);
  }
}
