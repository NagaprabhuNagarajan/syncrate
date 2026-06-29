import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database, Json } from "@/types/database.types";
import type {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from "@/features/workflows/types/workflow.types";

type DbInstance = Database["public"]["Tables"]["workflow_instances"]["Row"];
type DbInstanceInsert =
  Database["public"]["Tables"]["workflow_instances"]["Insert"];

// ─────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────

function mapInstance(row: DbInstance): WorkflowInstance {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workflowId: row.workflow_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    status: row.status,
    currentStepIndex: row.current_step_index,
    context: (row.context as Record<string, unknown>) ?? {},
    error: row.error,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: row.version,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export interface InstanceUpdatePatch {
  status?: WorkflowInstanceStatus;
  current_step_index?: number;
  error?: string | null;
  context?: Json;
  started_at?: string | null;
  completed_at?: string | null;
}

export class WorkflowInstanceRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async create(input: DbInstanceInsert): Promise<WorkflowInstance | null> {
    const { data, error } = await this.supabase
      .from("workflow_instances")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapInstance(data);
  }

  async findById(id: string): Promise<WorkflowInstance | null> {
    const { data, error } = await this.supabase
      .from("workflow_instances")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }
    return mapInstance(data);
  }

  async listByWorkflow(workflowId: string): Promise<WorkflowInstance[]> {
    const { data, error } = await this.supabase
      .from("workflow_instances")
      .select("*")
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }
    return data.map(mapInstance);
  }

  async listByOrg(organizationId: string): Promise<WorkflowInstance[]> {
    const { data, error } = await this.supabase
      .from("workflow_instances")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }
    return data.map(mapInstance);
  }

  /**
   * Advances an instance guarded by optimistic locking. Returns null when no
   * row matches the id + expected version (a stale write / conflict).
   */
  async update(
    id: string,
    patch: InstanceUpdatePatch,
    expectedVersion: number
  ): Promise<WorkflowInstance | null> {
    const { data, error } = await this.supabase
      .from("workflow_instances")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
        version: expectedVersion + 1,
      })
      .eq("id", id)
      .eq("version", expectedVersion)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapInstance(data);
  }
}
