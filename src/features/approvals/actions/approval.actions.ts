"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrganizationService } from "@/features/organization/services/organization.service";
import { AuditService } from "@/features/audit/services/audit.service";
import { ApprovalService } from "@/features/approvals/services/approval.service";
import {
  conditionFromFormSchema,
  createRuleSchema,
  decisionSchema,
  updateRuleSchema,
} from "@/features/approvals/schemas/approval.schemas";
import type {
  ApprovalRequest,
  ApprovalResult,
  ApprovalRule,
} from "@/features/approvals/types/approval.types";

const SETTINGS_PATH = "/settings/approvals";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function forbidden(message: string): ApprovalResult<never> {
  return { success: false, error: { code: "forbidden", message } };
}

function invalid(message: string): ApprovalResult<never> {
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
  | { ok: true; userId: string; roleId: string; canManage: boolean }
  | { ok: false; result: ApprovalResult<never> }
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

  return {
    ok: true,
    userId: authData.user.id,
    roleId: context.member.roleId,
    // Rule managers (org admins) may decide regardless of a rule's named role.
    canManage: context.permissions.includes("approval.manage"),
  };
}

/** Builds a validated condition from raw form fields. */
function parseCondition(formData: FormData) {
  return conditionFromFormSchema.safeParse({
    field: formData.get("conditionField"),
    operator: formData.get("conditionOperator"),
    value: formData.get("conditionValue"),
  });
}

// ─────────────────────────────────────────────────────────────
// Create rule
// ─────────────────────────────────────────────────────────────

export async function createRuleAction(
  organizationId: string,
  formData: FormData
): Promise<ApprovalResult<ApprovalRule>> {
  const condition = parseCondition(formData);
  if (!condition.success) {
    return invalid(condition.error.errors[0]?.message ?? "Invalid condition");
  }

  const parsed = createRuleSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    entityType: formData.get("entityType"),
    condition: condition.data,
    approverRoleId: formData.get("approverRoleId") || undefined,
    isActive: formData.get("isActive") === "true",
  });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "approval.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ApprovalService(supabase);
  const result = await service.createRule(
    {
      name: parsed.data.name,
      description: parsed.data.description || undefined,
      entityType: parsed.data.entityType,
      condition: parsed.data.condition,
      approverRoleId: parsed.data.approverRoleId || null,
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
      action: "approval.rule.create",
      entityType: "approval_rule",
      entityId: result.data.id,
      summary: `Created approval rule "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Update rule
// ─────────────────────────────────────────────────────────────

export async function updateRuleAction(
  organizationId: string,
  ruleId: string,
  formData: FormData
): Promise<ApprovalResult<ApprovalRule>> {
  const condition = parseCondition(formData);
  if (!condition.success) {
    return invalid(condition.error.errors[0]?.message ?? "Invalid condition");
  }

  const parsed = updateRuleSchema.safeParse({
    name: formData.get("name") || undefined,
    description: formData.get("description") ?? undefined,
    entityType: formData.get("entityType") || undefined,
    condition: condition.data,
    approverRoleId: formData.get("approverRoleId") ?? undefined,
    isActive: formData.get("isActive") === "true",
    version: formData.get("version"),
  });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "approval.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ApprovalService(supabase);
  const result = await service.updateRule(
    ruleId,
    {
      name: parsed.data.name,
      description: parsed.data.description ?? undefined,
      entityType: parsed.data.entityType,
      condition: parsed.data.condition,
      approverRoleId:
        parsed.data.approverRoleId === undefined
          ? undefined
          : parsed.data.approverRoleId || null,
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
      action: "approval.rule.update",
      entityType: "approval_rule",
      entityId: ruleId,
      summary: `Updated approval rule "${result.data.name}"`,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Delete rule
// ─────────────────────────────────────────────────────────────

export async function deleteRuleAction(
  organizationId: string,
  ruleId: string
): Promise<ApprovalResult<void>> {
  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "approval.manage");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ApprovalService(supabase);
  const result = await service.deleteRule(ruleId, auth.userId);

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: "approval.rule.delete",
      entityType: "approval_rule",
      entityId: ruleId,
      summary: "Deleted approval rule",
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Decisions (approve / reject / cancel)
// ─────────────────────────────────────────────────────────────

type Decision = "approved" | "rejected" | "cancelled";

async function decideAction(
  decision: Decision,
  organizationId: string,
  requestId: string,
  reason: string | undefined
): Promise<ApprovalResult<ApprovalRequest>> {
  const parsed = decisionSchema.safeParse({ reason: reason ?? "" });
  if (!parsed.success) {
    return invalid(parsed.error.errors[0]?.message ?? "Invalid reason");
  }
  const cleanReason = parsed.data.reason || undefined;

  const supabase = await createServerSupabaseClient();
  const auth = await authorize(supabase, organizationId, "approval.decide");
  if (!auth.ok) {
    return auth.result;
  }

  const service = new ApprovalService(supabase);
  const enforce = { deciderRoleId: auth.roleId, canOverride: auth.canManage };
  let result: ApprovalResult<ApprovalRequest>;
  if (decision === "approved") {
    result = await service.approveRequest(
      requestId,
      auth.userId,
      cleanReason,
      enforce
    );
  } else if (decision === "rejected") {
    result = await service.rejectRequest(
      requestId,
      auth.userId,
      cleanReason,
      enforce
    );
  } else {
    result = await service.cancelRequest(requestId, auth.userId, cleanReason);
  }

  if (result.success) {
    revalidatePath(SETTINGS_PATH);
    await new AuditService(supabase).log({
      organizationId,
      actorUserId: auth.userId,
      action: `approval.request.${decision}`,
      entityType: "approval_request",
      entityId: requestId,
      summary: `Approval request ${decision}`,
      metadata: cleanReason ? { reason: cleanReason } : undefined,
    });
  }
  return result;
}

export async function approveRequestAction(
  organizationId: string,
  requestId: string,
  reason?: string
): Promise<ApprovalResult<ApprovalRequest>> {
  return decideAction("approved", organizationId, requestId, reason);
}

export async function rejectRequestAction(
  organizationId: string,
  requestId: string,
  reason?: string
): Promise<ApprovalResult<ApprovalRequest>> {
  return decideAction("rejected", organizationId, requestId, reason);
}

export async function cancelRequestAction(
  organizationId: string,
  requestId: string,
  reason?: string
): Promise<ApprovalResult<ApprovalRequest>> {
  return decideAction("cancelled", organizationId, requestId, reason);
}
