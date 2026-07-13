"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Plus, Pencil, Trash2, Inbox, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBanner } from "@/components/shared/error-banner";
import { RuleForm, type RoleOption } from "@/features/approvals/components/rule-form";
import {
  approveRequestAction,
  deleteRuleAction,
  rejectRequestAction,
} from "@/features/approvals/actions/approval.actions";
import type {
  ApprovalCondition,
  ApprovalRequest,
  ApprovalRule,
} from "@/features/approvals/types/approval.types";

// ─────────────────────────────────────────────────────────────
// Presentation helpers
// ─────────────────────────────────────────────────────────────

const OPERATOR_SYMBOL: Record<ApprovalCondition["operator"], string> = {
  gte: "≥",
  gt: ">",
  lte: "≤",
  lt: "<",
  eq: "=",
};

function describeCondition(condition: ApprovalCondition): string {
  return `${condition.field} ${OPERATOR_SYMBOL[condition.operator]} ${String(
    condition.value
  )}`;
}

const INPUT_CLASS =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out hover:border-slate-400 dark:hover:border-slate-600 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";

type TabKey = "rules" | "pending";

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface ApprovalsViewProps {
  readonly organizationId: string;
  readonly rules: readonly ApprovalRule[];
  readonly pendingRequests: readonly ApprovalRequest[];
  readonly roles: readonly RoleOption[];
  readonly canManage: boolean;
  readonly canDecide: boolean;
}

export function ApprovalsView({
  organizationId,
  rules,
  pendingRequests,
  roles,
  canManage,
  canDecide,
}: ApprovalsViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("rules");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApprovalRule | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const roleNameById = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((role) => map.set(role.id, role.name));
    return map;
  }, [roles]);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (rule: ApprovalRule): void => {
    setEditing(rule);
    setFormOpen(true);
  };

  const closeForm = (): void => {
    setFormOpen(false);
    setEditing(null);
  };

  const handleSaved = (): void => {
    closeForm();
    router.refresh();
  };

  const handleDelete = (rule: ApprovalRule): void => {
    setActionError(null);
    setBusyId(rule.id);
    startTransition(async () => {
      const response = await deleteRuleAction(organizationId, rule.id);
      setBusyId(null);
      if (!response.success) {
        setActionError(response.error.message);
        return;
      }
      router.refresh();
    });
  };

  const setReason = (requestId: string, value: string): void => {
    setReasons((prev) => ({ ...prev, [requestId]: value }));
  };

  const decide = (request: ApprovalRequest, approve: boolean): void => {
    setActionError(null);
    setBusyId(request.id);
    const reason = reasons[request.id]?.trim() || undefined;
    startTransition(async () => {
      const response = approve
        ? await approveRequestAction(organizationId, request.id, reason)
        : await rejectRequestAction(organizationId, request.id, reason);
      setBusyId(null);
      if (!response.success) {
        setActionError(response.error.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Approvals"
        description="Configure rules that require sign-off, and decide pending requests"
        icon={ShieldCheck}
      >
        {canManage && tab === "rules" && !formOpen && (
          <Button type="button" variant="gradient" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New rule
          </Button>
        )}
      </PageHeader>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Approvals sections"
        className="mt-4 flex gap-1 border-b border-slate-200 dark:border-slate-800"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "rules"}
          onClick={() => setTab("rules")}
          className={tabClass(tab === "rules")}
        >
          <ListChecks className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          Rules
          <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">({rules.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pending"}
          onClick={() => setTab("pending")}
          className={tabClass(tab === "pending")}
        >
          <Inbox className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          Pending approvals
          <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
            ({pendingRequests.length})
          </span>
        </button>
      </div>

      {actionError && <ErrorBanner message={actionError} className="mt-4" />}

      {/* Rules tab */}
      {tab === "rules" && (
        <div className="mt-4">
          {formOpen && (
            <RuleForm
              organizationId={organizationId}
              roles={roles}
              rule={editing ?? undefined}
              onClose={closeForm}
              onSaved={handleSaved}
            />
          )}

          {rules.length === 0 && !formOpen ? (
            <EmptyState
              icon={ListChecks}
              title="No approval rules yet"
              description="Create a rule to require sign-off when a transaction matches a condition — for example, purchase invoices over a threshold."
              action={
                canManage
                  ? { label: "New rule", icon: Plus, onClick: openCreate }
                  : undefined
              }
            />
          ) : (
            !formOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Name
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Entity
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Condition
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Approver
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Status
                        </th>
                        {canManage && (
                          <th
                            scope="col"
                            className="px-3 py-2 text-right font-medium"
                          >
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {rules.map((rule) => (
                        <tr key={rule.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                            {rule.name}
                            {rule.description && (
                              <p className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                {rule.description}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {rule.entityType}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                            {describeCondition(rule.condition)}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {rule.approverRoleId
                              ? (roleNameById.get(rule.approverRoleId) ??
                                "Unknown role")
                              : "Any approver"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              dot
                              variant={rule.isActive ? "success" : "muted"}
                            >
                              {rule.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          {canManage && (
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Edit ${rule.name}`}
                                  onClick={() => openEdit(rule)}
                                >
                                  <Pencil
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Delete ${rule.name}`}
                                  loading={isPending && busyId === rule.id}
                                  onClick={() => handleDelete(rule)}
                                >
                                  <Trash2
                                    className="h-4 w-4 text-error"
                                    aria-hidden="true"
                                  />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )
          )}
        </div>
      )}

      {/* Pending approvals tab */}
      {tab === "pending" && (
        <div className="mt-4">
          {pendingRequests.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No pending approvals"
              description="When a transaction triggers an approval rule, it will appear here for review."
            />
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {request.entityType}
                      </p>
                      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {request.entityId}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Raised {request.createdAt.toLocaleString()}
                      </p>
                    </div>
                    <Badge dot variant="warning">Pending</Badge>
                  </div>

                  {canDecide ? (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <label
                        htmlFor={`reason-${request.id}`}
                        className="sr-only"
                      >
                        Decision reason
                      </label>
                      <input
                        id={`reason-${request.id}`}
                        type="text"
                        placeholder="Optional reason"
                        value={reasons[request.id] ?? ""}
                        onChange={(event) =>
                          setReason(request.id, event.target.value)
                        }
                        className={INPUT_CLASS}
                      />
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          variant="success"
                          size="sm"
                          loading={isPending && busyId === request.id}
                          onClick={() => decide(request, true)}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          loading={isPending && busyId === request.id}
                          onClick={() => decide(request, false)}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      You do not have permission to decide this request.
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function tabClass(active: boolean): string {
  return [
    "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
    active
      ? "border-primary-600 text-primary-700 dark:text-primary-300"
      : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
  ].join(" ");
}
