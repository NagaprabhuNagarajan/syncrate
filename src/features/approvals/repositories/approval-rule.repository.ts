import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database, Json } from "@/types/database.types";
import type {
  ApprovalCondition,
  ApprovalRule,
} from "@/features/approvals/types/approval.types";

type DbRule = Database["public"]["Tables"]["approval_rules"]["Row"];
type DbRuleInsert = Database["public"]["Tables"]["approval_rules"]["Insert"];

// ─────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────

function mapRule(row: DbRule): ApprovalRule {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    entityType: row.entity_type,
    // Conditions are written through the validated schema, so the stored JSON
    // is trusted to match the ApprovalCondition shape on read.
    condition: row.condition as unknown as ApprovalCondition,
    approverRoleId: row.approver_role_id,
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: row.version,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export class ApprovalRuleRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async list(organizationId: string): Promise<ApprovalRule[]> {
    const { data, error } = await this.supabase
      .from("approval_rules")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }
    return data.map(mapRule);
  }

  /** Active, non-deleted rules for an entity type — used by evaluateAndRaise. */
  async listActiveByEntityType(
    organizationId: string,
    entityType: string
  ): Promise<ApprovalRule[]> {
    const { data, error } = await this.supabase
      .from("approval_rules")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("entity_type", entityType)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (error || !data) {
      return [];
    }
    return data.map(mapRule);
  }

  async findById(id: string): Promise<ApprovalRule | null> {
    const { data, error } = await this.supabase
      .from("approval_rules")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapRule(data);
  }

  async create(input: DbRuleInsert): Promise<ApprovalRule | null> {
    const { data, error } = await this.supabase
      .from("approval_rules")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapRule(data);
  }

  /**
   * Updates a rule guarded by optimistic locking. Returns null when no row
   * matches the id + expected version (i.e. a stale write).
   */
  async update(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      entity_type?: string;
      condition?: Json;
      approver_role_id?: string | null;
      is_active?: boolean;
    },
    updatedBy: string,
    expectedVersion: number
  ): Promise<ApprovalRule | null> {
    const { data, error } = await this.supabase
      .from("approval_rules")
      .update({
        ...patch,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
        version: expectedVersion + 1,
      })
      .eq("id", id)
      .eq("version", expectedVersion)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapRule(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("approval_rules")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    return !error;
  }
}
