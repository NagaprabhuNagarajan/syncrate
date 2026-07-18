import "server-only";

import type { AppSupabaseClient } from "@/lib/supabase/types";
import { ApprovalService } from "@/features/approvals/services/approval.service";
import type { EntityApproval } from "@/features/approvals/types/approval.types";

interface ApprovalViewer {
  /** The viewer's role in the organization. */
  readonly roleId: string;
  /** Whether the viewer holds the approval.decide permission. */
  readonly canDecide: boolean;
  /** Whether the viewer can override a rule's named approver (org admins). */
  readonly canManage: boolean;
}

/**
 * Loads the approval requests raised against a document (bill / invoice) and
 * shapes them for the detail page: each carries its rule name and whether this
 * particular viewer may decide it (pending + holds decide permission + is the
 * rule's named approver, or can override).
 */
export async function getEntityApprovals(
  supabase: AppSupabaseClient,
  organizationId: string,
  entityType: string,
  entityId: string,
  viewer: ApprovalViewer
): Promise<EntityApproval[]> {
  const service = new ApprovalService(supabase);
  const requests = await service.listRequestsForEntity(
    organizationId,
    entityType,
    entityId
  );
  if (requests.length === 0) {
    return [];
  }

  const rules = await service.listRules(organizationId);
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));

  // Resolve the display names of the people involved. requestedBy/decidedBy are
  // always org members, so the users_select_org_members RLS policy permits this.
  const userIds = new Set<string>();
  for (const request of requests) {
    if (request.requestedBy) {
      userIds.add(request.requestedBy);
    }
    if (request.decidedBy) {
      userIds.add(request.decidedBy);
    }
  }

  const personById = new Map<
    string,
    { readonly name: string; readonly role: string | null }
  >();
  if (userIds.size > 0) {
    // organization_members has several FKs to users, so the embed must name the
    // user_id relationship; roles(name) resolves the member's role in this org.
    const { data } = await supabase
      .from("organization_members")
      .select("user_id, users!user_id(full_name, email), roles(name)")
      .eq("organization_id", organizationId)
      .in("user_id", [...userIds])
      .is("deleted_at", null);
    const rows = (data ?? []) as unknown as ReadonlyArray<{
      readonly user_id: string;
      readonly users: {
        readonly full_name: string | null;
        readonly email: string | null;
      } | null;
      readonly roles: { readonly name: string | null } | null;
    }>;
    for (const row of rows) {
      personById.set(row.user_id, {
        name: row.users?.full_name ?? row.users?.email ?? "Unknown user",
        role: row.roles?.name ?? null,
      });
    }
  }

  return requests.map((request) => {
    const rule = request.ruleId ? ruleById.get(request.ruleId) : undefined;
    const namedRole = rule?.approverRoleId ?? null;
    const canDecide =
      request.status === "pending" &&
      viewer.canDecide &&
      (namedRole === null ||
        namedRole === viewer.roleId ||
        viewer.canManage);

    return {
      id: request.id,
      status: request.status,
      ruleName: rule?.name ?? null,
      decisionReason: request.decisionReason,
      decidedAt: request.decidedAt,
      createdAt: request.createdAt,
      canDecide,
      requestedByName: request.requestedBy
        ? (personById.get(request.requestedBy)?.name ?? null)
        : null,
      requestedByRole: request.requestedBy
        ? (personById.get(request.requestedBy)?.role ?? null)
        : null,
      decidedByName: request.decidedBy
        ? (personById.get(request.decidedBy)?.name ?? null)
        : null,
      decidedByRole: request.decidedBy
        ? (personById.get(request.decidedBy)?.role ?? null)
        : null,
    };
  });
}
