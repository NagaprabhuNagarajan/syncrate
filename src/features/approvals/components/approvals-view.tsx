"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Inbox,
  ListChecks,
  ChevronLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBanner } from "@/components/shared/error-banner";
import {
  RuleForm,
  type RoleOption,
} from "@/features/approvals/components/rule-form";
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

// Friendly labels for the raw entity_type stored on a rule.
const ENTITY_TYPE_LABEL: Record<string, string> = {
  purchase_invoice: "Bill",
  sales_invoice: "Invoice",
};

function entityLabel(entityType: string): string {
  return ENTITY_TYPE_LABEL[entityType] ?? entityType;
}

// Friendly labels for the raw condition field key stored on a rule.
const FIELD_LABEL: Record<string, string> = {
  total_amount: "Total amount",
};

function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

const OPERATOR_SYMBOL: Record<ApprovalCondition["operator"], string> = {
  gte: "≥",
  gt: ">",
  lte: "≤",
  lt: "<",
  eq: "=",
};

function describeCondition(condition: ApprovalCondition): string {
  return `${fieldLabel(condition.field)} ${
    OPERATOR_SYMBOL[condition.operator]
  } ${String(condition.value)}`;
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
  const searchParams = useSearchParams();
  const org = searchParams.get("org");
  const settingsHref = org ? `/settings?org=${org}` : "/settings";

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
      {/* Back to settings */}
      <Link
        href={settingsHref}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Settings
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
            <ShieldCheck className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Approvals
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {rules.length}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configure rules that require sign-off, and decide pending requests
            </p>
          </div>
        </div>

        {canManage && tab === "rules" && !formOpen && (
          <Button type="button" variant="gradient" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New rule
          </Button>
        )}
      </motion.div>

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
          <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
            ({rules.length})
          </span>
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
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
              >
                <Table
                  className="[&_td]:px-5 [&_th]:px-5"
                  wrapperClassName="rounded-none border-0 bg-transparent"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Approver</TableHead>
                      <TableHead>Status</TableHead>
                      {canManage && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                              <ShieldCheck
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {rule.name}
                              </p>
                              {rule.description && (
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                  {rule.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          <Badge variant="info">
                            {entityLabel(rule.entityType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                          {describeCondition(rule.condition)}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          {rule.approverRoleId
                            ? (roleNameById.get(rule.approverRoleId) ??
                              "Unknown role")
                            : "Any approver"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            dot
                            variant={rule.isActive ? "success" : "muted"}
                          >
                            {rule.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
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
                                className="text-error hover:bg-error/10 hover:text-error dark:text-error dark:hover:bg-error/10"
                                aria-label={`Delete ${rule.name}`}
                                loading={isPending && busyId === rule.id}
                                onClick={() => handleDelete(rule)}
                              >
                                <Trash2
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900"
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
                    <Badge dot variant="warning">
                      Pending
                    </Badge>
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
