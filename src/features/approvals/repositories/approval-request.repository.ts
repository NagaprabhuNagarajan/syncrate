import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database } from "@/types/database.types";
import type {
  ApprovalRequest,
  ApprovalRequestStatus,
} from "@/features/approvals/types/approval.types";

type DbRequest = Database["public"]["Tables"]["approval_requests"]["Row"];
type DbRequestInsert =
  Database["public"]["Tables"]["approval_requests"]["Insert"];

// ─────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────

function mapRequest(row: DbRequest): ApprovalRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ruleId: row.rule_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    requestedBy: row.requested_by,
    status: row.status,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at ? new Date(row.decided_at) : null,
    decisionReason: row.decision_reason,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: row.version,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class ApprovalRequestRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async create(input: DbRequestInsert): Promise<ApprovalRequest | null> {
    const { data, error } = await this.supabase
      .from("approval_requests")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapRequest(data);
  }

  async findById(id: string): Promise<ApprovalRequest | null> {
    const { data, error } = await this.supabase
      .from("approval_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }
    return mapRequest(data);
  }

  async listByOrg(
    organizationId: string,
    status?: ApprovalRequestStatus
  ): Promise<ApprovalRequest[]> {
    let query = this.supabase
      .from("approval_requests")
      .select("*")
      .eq("organization_id", organizationId);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error || !data) {
      return [];
    }
    return data.map(mapRequest);
  }

  /**
   * Transitions a request to a decided state. Guarded so it only ever moves a
   * pending request (status = 'pending') matching the expected version forward.
   * Returns null when no such row exists (already decided / stale write).
   */
  async decide(
    id: string,
    patch: {
      status: ApprovalRequestStatus;
      decided_by: string;
      decision_reason: string | null;
    },
    expectedVersion: number
  ): Promise<ApprovalRequest | null> {
    const { data, error } = await this.supabase
      .from("approval_requests")
      .update({
        status: patch.status,
        decided_by: patch.decided_by,
        decided_at: new Date().toISOString(),
        decision_reason: patch.decision_reason,
        updated_at: new Date().toISOString(),
        version: expectedVersion + 1,
      })
      .eq("id", id)
      .eq("version", expectedVersion)
      .eq("status", "pending")
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapRequest(data);
  }
}
