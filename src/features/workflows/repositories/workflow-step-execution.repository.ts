import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database, Json } from "@/types/database.types";
import type {
  WorkflowStepExecution,
  WorkflowStepExecutionStatus,
} from "@/features/workflows/types/workflow.types";

type DbStep = Database["public"]["Tables"]["workflow_step_executions"]["Row"];
type DbStepInsert =
  Database["public"]["Tables"]["workflow_step_executions"]["Insert"];

// ─────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────

function mapStep(row: DbStep): WorkflowStepExecution {
  return {
    id: row.id,
    organizationId: row.organization_id,
    instanceId: row.instance_id,
    stepId: row.step_id,
    stepIndex: row.step_index,
    stepType: row.step_type,
    status: row.status,
    output: (row.output as Record<string, unknown>) ?? {},
    error: row.error,
    startedAt: row.started_at ? new Date(row.started_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    createdAt: new Date(row.created_at),
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export interface StepExecutionUpdatePatch {
  status?: WorkflowStepExecutionStatus;
  output?: Json;
  error?: string | null;
  completed_at?: string | null;
}

export class WorkflowStepExecutionRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async create(input: DbStepInsert): Promise<WorkflowStepExecution | null> {
    const { data, error } = await this.supabase
      .from("workflow_step_executions")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapStep(data);
  }

  async update(
    id: string,
    patch: StepExecutionUpdatePatch
  ): Promise<WorkflowStepExecution | null> {
    const { data, error } = await this.supabase
      .from("workflow_step_executions")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapStep(data);
  }

  async listByInstance(instanceId: string): Promise<WorkflowStepExecution[]> {
    const { data, error } = await this.supabase
      .from("workflow_step_executions")
      .select("*")
      .eq("instance_id", instanceId)
      .order("step_index", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapStep);
  }

  async listByOrg(organizationId: string): Promise<WorkflowStepExecution[]> {
    const { data, error } = await this.supabase
      .from("workflow_step_executions")
      .select("*")
      .eq("organization_id", organizationId)
      .order("step_index", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map(mapStep);
  }
}
