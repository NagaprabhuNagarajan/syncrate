"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { WorkflowService } from "@/features/workflows/services/workflow.service";
import { WorkflowEngineService } from "@/features/workflows/services/workflow-engine.service";
import {
  createWorkflowSchema,
  parseStepsJson,
  updateWorkflowSchema,
} from "@/features/workflows/schemas/workflow.schemas";
import type {
  Workflow,
  WorkflowInstance,
  WorkflowResult,
  WorkflowStep,
} from "@/features/workflows/types/workflow.types";

const SETTINGS_PATH = "/settings/workflows";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): WorkflowResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): WorkflowResult<never> {
  return { success: false, error: { code: "validation", message } };
}

/**
 * Resolves the caller, verifies org membership, and checks a permission.
 * Returns the authenticated userId on success.
 */
async function authorize(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  permission: string
): Promise<
  { ok: true; userId: string } | { ok: false; result: WorkflowResult<never> }
> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return { ok: false, result: forbidden("Not authenticated") };
  }

  const orgService = new OrganizationService(supabase);
  const context = await orgService.getOrganizationContext(
    organizationId,
    authData.user.id
  );
  if (!context) {
    return {
      ok: false,
      result: forbidden("You do not have access to this organization"),
    };
  }
  if (!context.permissions.includes(permission)) {
    return {
      ok: false,
      result: forbidden("You do not have permission to perform this action"),
    };
  }

  return { ok: true, userId: authData.user.id };
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export async function createWorkflowAction(
  organizationId: string,
  formData: FormData
): Promise<WorkflowResult<Workflow>> {
  const steps = parseStepsJson(formData.get("steps"));
  if (!steps.success) {
    return invalid(steps.message);
  }

  const parsed = createWorkflowSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    triggerEvent: formData.get("triggerEvent"),
    steps: steps.data,
    isActive: formData.get("isActive") === "true",
  });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "workflow.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new WorkflowService(supabase);
  const result = await service.createWorkflow(
    {
      name: parsed.data.name,
      description: parsed.data.description || undefined,
      triggerEvent: parsed.data.triggerEvent,
      steps: parsed.data.steps as WorkflowStep[],
      isActive: parsed.data.isActive,
    },
    organizationId,
    auth.userId
  );

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "workflow.create",
      entityType: "workflow",
      entityId: result.data.id,
      summary: `Created workflow "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────

export async function updateWorkflowAction(
  organizationId: string,
  workflowId: string,
  formData: FormData
): Promise<WorkflowResult<Workflow>> {
  const steps = parseStepsJson(formData.get("steps"));
  if (!steps.success) {
    return invalid(steps.message);
  }

  const parsed = updateWorkflowSchema.safeParse({
    name: formData.get("name") || undefined,
    description: formData.get("description") ?? undefined,
    triggerEvent: formData.get("triggerEvent") || undefined,
    steps: steps.data,
    isActive: formData.get("isActive") === "true",
    version: formData.get("version"),
  });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "workflow.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new WorkflowService(supabase);
  const result = await service.updateWorkflow(
    workflowId,
    {
      name: parsed.data.name,
      description: parsed.data.description ?? undefined,
      triggerEvent: parsed.data.triggerEvent,
      steps: parsed.data.steps as WorkflowStep[] | undefined,
      isActive: parsed.data.isActive,
      version: parsed.data.version,
    },
    auth.userId
  );

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "workflow.update",
      entityType: "workflow",
      entityId: workflowId,
      summary: `Updated workflow "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Delete (soft)
// ─────────────────────────────────────────────────────────────

export async function deleteWorkflowAction(
  organizationId: string,
  workflowId: string
): Promise<WorkflowResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "workflow.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new WorkflowService(supabase);
  const result = await service.deleteWorkflow(workflowId, auth.userId);

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "workflow.delete",
      entityType: "workflow",
      entityId: workflowId,
      summary: "Deleted workflow",
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Run (manual trigger)
// ─────────────────────────────────────────────────────────────

export async function runWorkflowAction(
  organizationId: string,
  workflowId: string
): Promise<WorkflowResult<WorkflowInstance>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "workflow.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const engine = new WorkflowEngineService(supabase);
  const result = await engine.startWorkflow({
    organizationId,
    workflowId,
    context: { triggeredManually: true },
    actorUserId: auth.userId,
  });

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "workflow.run",
      entityType: "workflow",
      entityId: workflowId,
      summary: `Started workflow run (status: ${result.data.status})`,
      metadata: { instanceId: result.data.id, status: result.data.status },
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Resume (after an approval decision)
// ─────────────────────────────────────────────────────────────

export async function resumeWorkflowInstanceAction(
  organizationId: string,
  instanceId: string,
  approved: boolean
): Promise<WorkflowResult<WorkflowInstance>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "workflow.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const engine = new WorkflowEngineService(supabase);
  const result = await engine.resumeInstance({ instanceId, approved });

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: approved ? "workflow.resume.approved" : "workflow.resume.rejected",
      entityType: "workflow",
      entityId: result.data.workflowId,
      summary: `Resumed workflow instance (${approved ? "approved" : "rejected"}) → ${result.data.status}`,
      metadata: { instanceId, status: result.data.status },
    });
  }
  return result;
}
