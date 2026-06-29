import type { AppSupabaseClient } from "@/lib/supabase/types";
import type { Json } from "@/types/database.types";
import { ApprovalRuleRepository } from "@/features/approvals/repositories/approval-rule.repository";
import { ApprovalRequestRepository } from "@/features/approvals/repositories/approval-request.repository";
import { evaluateCondition } from "@/features/approvals/utils/evaluate-condition";
import type {
  ApprovalErrorCode,
  ApprovalRequest,
  ApprovalRequestStatus,
  ApprovalResult,
  ApprovalRule,
  CreateRuleInput,
  EvaluateAndRaiseInput,
  UpdateRuleInput,
} from "@/features/approvals/types/approval.types";

function ok<T>(data: T): ApprovalResult<T> {
  return { success: true, data };
}

function fail(code: ApprovalErrorCode, message: string): ApprovalResult<never> {
  return { success: false, error: { code, message } };
}

/** Normalizes an optional string: trims and converts "" → null. */
function nz(value: string | undefined | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export class ApprovalService {
  private readonly rules: ApprovalRuleRepository;
  private readonly requests: ApprovalRequestRepository;

  constructor(supabase: AppSupabaseClient) {
    this.rules = new ApprovalRuleRepository(supabase);
    this.requests = new ApprovalRequestRepository(supabase);
  }

  // ── Rule reads ─────────────────────────────────────────────

  async listRules(organizationId: string): Promise<ApprovalRule[]> {
    return this.rules.list(organizationId);
  }

  async getRule(id: string): Promise<ApprovalResult<ApprovalRule>> {
    const rule = await this.rules.findById(id);
    if (!rule) {
      return fail("not_found", "Approval rule not found");
    }
    return ok(rule);
  }

  // ── Rule mutations ─────────────────────────────────────────

  async createRule(
    input: CreateRuleInput,
    organizationId: string,
    userId: string
  ): Promise<ApprovalResult<ApprovalRule>> {
    const rule = await this.rules.create({
      organization_id: organizationId,
      name: input.name.trim(),
      description: nz(input.description),
      entity_type: input.entityType.trim(),
      condition: input.condition as unknown as Json,
      approver_role_id: nz(input.approverRoleId),
      is_active: input.isActive ?? true,
      created_by: userId,
    });

    if (!rule) {
      return fail("unknown", "Failed to create approval rule. Please try again.");
    }
    return ok(rule);
  }

  async updateRule(
    id: string,
    input: UpdateRuleInput,
    userId: string
  ): Promise<ApprovalResult<ApprovalRule>> {
    const existing = await this.rules.findById(id);
    if (!existing) {
      return fail("not_found", "Approval rule not found");
    }
    if (existing.version !== input.version) {
      return fail(
        "conflict",
        "This rule was modified by someone else. Reload and try again."
      );
    }

    const patch: {
      name?: string;
      description?: string | null;
      entity_type?: string;
      condition?: Json;
      approver_role_id?: string | null;
      is_active?: boolean;
    } = {};

    if (input.name !== undefined) {
      patch.name = input.name.trim();
    }
    if (input.description !== undefined) {
      patch.description = nz(input.description);
    }
    if (input.entityType !== undefined) {
      patch.entity_type = input.entityType.trim();
    }
    if (input.condition !== undefined) {
      patch.condition = input.condition as unknown as Json;
    }
    if (input.approverRoleId !== undefined) {
      patch.approver_role_id = nz(input.approverRoleId);
    }
    if (input.isActive !== undefined) {
      patch.is_active = input.isActive;
    }

    const updated = await this.rules.update(id, patch, userId, input.version);
    if (!updated) {
      return fail(
        "conflict",
        "This rule was modified by someone else. Reload and try again."
      );
    }
    return ok(updated);
  }

  async deleteRule(
    id: string,
    userId: string
  ): Promise<ApprovalResult<void>> {
    const existing = await this.rules.findById(id);
    if (!existing) {
      return fail("not_found", "Approval rule not found");
    }
    const deleted = await this.rules.softDelete(id, userId);
    if (!deleted) {
      return fail("unknown", "Failed to delete approval rule. Please try again.");
    }
    return ok(undefined);
  }

  // ── Request reads ──────────────────────────────────────────

  async listRequests(
    organizationId: string,
    status?: ApprovalRequestStatus
  ): Promise<ApprovalRequest[]> {
    return this.requests.listByOrg(organizationId, status);
  }

  async listPendingRequests(
    organizationId: string
  ): Promise<ApprovalRequest[]> {
    return this.requests.listByOrg(organizationId, "pending");
  }

  // ── Evaluate & raise ───────────────────────────────────────

  /**
   * Finds every active rule for the entity type, evaluates each condition
   * against the supplied fields, and raises a pending approval request for
   * each match. Returns the created requests (empty when nothing matched, in
   * which case the caller may proceed without approval).
   */
  async evaluateAndRaise(
    input: EvaluateAndRaiseInput
  ): Promise<ApprovalResult<ApprovalRequest[]>> {
    const rules = await this.rules.listActiveByEntityType(
      input.organizationId,
      input.entityType
    );

    const matched = rules.filter((rule) =>
      evaluateCondition(rule.condition, input.fields)
    );

    const created: ApprovalRequest[] = [];
    for (const rule of matched) {
      const request = await this.requests.create({
        organization_id: input.organizationId,
        rule_id: rule.id,
        entity_type: input.entityType,
        entity_id: input.entityId,
        requested_by: input.requestedBy,
        status: "pending",
        metadata: { fields: input.fields } as unknown as Json,
      });
      if (request) {
        created.push(request);
      }
    }

    return ok(created);
  }

  // ── Decisions ──────────────────────────────────────────────

  async approveRequest(
    id: string,
    deciderId: string,
    reason?: string
  ): Promise<ApprovalResult<ApprovalRequest>> {
    return this.decide(id, "approved", deciderId, reason);
  }

  async rejectRequest(
    id: string,
    deciderId: string,
    reason?: string
  ): Promise<ApprovalResult<ApprovalRequest>> {
    return this.decide(id, "rejected", deciderId, reason);
  }

  async cancelRequest(
    id: string,
    deciderId: string,
    reason?: string
  ): Promise<ApprovalResult<ApprovalRequest>> {
    return this.decide(id, "cancelled", deciderId, reason);
  }

  /**
   * Shared decision path. A request can only be decided once: it must be
   * `pending` and at the expected version, otherwise a conflict is returned.
   */
  private async decide(
    id: string,
    status: ApprovalRequestStatus,
    deciderId: string,
    reason?: string
  ): Promise<ApprovalResult<ApprovalRequest>> {
    const existing = await this.requests.findById(id);
    if (!existing) {
      return fail("not_found", "Approval request not found");
    }
    if (existing.status !== "pending") {
      return fail(
        "conflict",
        `This request has already been ${existing.status}.`
      );
    }

    const updated = await this.requests.decide(
      id,
      { status, decided_by: deciderId, decision_reason: nz(reason) },
      existing.version
    );
    if (!updated) {
      return fail(
        "conflict",
        "This request was already decided. Reload and try again."
      );
    }
    return ok(updated);
  }
}
