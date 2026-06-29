import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Database, Json } from "@/types/database.types";
import { definitionSchema } from "@/features/workflows/schemas/workflow.schemas";
import type { Workflow, WorkflowStep } from "@/features/workflows/types/workflow.types";

type DbWorkflow = Database["public"]["Tables"]["workflows"]["Row"];
type DbWorkflowInsert = Database["public"]["Tables"]["workflows"]["Insert"];

// ─────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────

/**
 * Parses the stored `definition` jsonb into a trusted `WorkflowStep[]`. The raw
 * JSON is NEVER trusted — anything that fails validation degrades to no steps.
 */
function parseSteps(definition: Json): WorkflowStep[] {
  const parsed = definitionSchema.safeParse(definition);
  if (!parsed.success) {
    return [];
  }
  return parsed.data.steps as WorkflowStep[];
}

function mapWorkflow(row: DbWorkflow): Workflow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    triggerEvent: row.trigger_event,
    steps: parseSteps(row.definition),
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    version: row.version,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────

export interface WorkflowUpdatePatch {
  name?: string;
  description?: string | null;
  trigger_event?: string;
  definition?: Json;
  is_active?: boolean;
}

export class WorkflowRepository {
  constructor(private readonly supabase: AppSupabaseClient) {}

  async list(organizationId: string): Promise<Workflow[]> {
    const { data, error } = await this.supabase
      .from("workflows")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }
    return data.map(mapWorkflow);
  }

  async findById(id: string): Promise<Workflow | null> {
    const { data, error } = await this.supabase
      .from("workflows")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return null;
    }
    return mapWorkflow(data);
  }

  async create(input: DbWorkflowInsert): Promise<Workflow | null> {
    const { data, error } = await this.supabase
      .from("workflows")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }
    return mapWorkflow(data);
  }

  /**
   * Updates a workflow guarded by optimistic locking. Returns null when no row
   * matches the id + expected version (i.e. a stale write / conflict).
   */
  async update(
    id: string,
    patch: WorkflowUpdatePatch,
    updatedBy: string,
    expectedVersion: number
  ): Promise<Workflow | null> {
    const { data, error } = await this.supabase
      .from("workflows")
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
    return mapWorkflow(data);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("workflows")
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
