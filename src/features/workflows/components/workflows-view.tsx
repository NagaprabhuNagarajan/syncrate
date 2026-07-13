"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  History,
  Pencil,
  Play,
  Plus,
  Trash2,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBanner } from "@/components/shared/error-banner";
import { WorkflowForm } from "@/features/workflows/components/workflow-form";
import {
  deleteWorkflowAction,
  runWorkflowAction,
} from "@/features/workflows/actions/workflow.actions";
import type {
  Workflow,
  WorkflowInstanceStatus,
  WorkflowRun,
  WorkflowStepExecutionStatus,
} from "@/features/workflows/types/workflow.types";

// ─────────────────────────────────────────────────────────────
// Presentation helpers
// ─────────────────────────────────────────────────────────────

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const INSTANCE_STATUS_VARIANT: Record<WorkflowInstanceStatus, BadgeVariant> = {
  pending: "muted",
  running: "info",
  awaiting: "warning",
  completed: "success",
  failed: "destructive",
  cancelled: "muted",
};

const STEP_STATUS_VARIANT: Record<WorkflowStepExecutionStatus, BadgeVariant> = {
  pending: "muted",
  running: "info",
  completed: "success",
  failed: "destructive",
  skipped: "muted",
};

type TabKey = "workflows" | "history";

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface WorkflowsViewProps {
  readonly organizationId: string;
  readonly workflows: readonly Workflow[];
  readonly runs: readonly WorkflowRun[];
  readonly canManage: boolean;
}

export function WorkflowsView({
  organizationId,
  workflows,
  runs,
  canManage,
}: WorkflowsViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("workflows");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const workflowNameById = useMemo(() => {
    const map = new Map<string, string>();
    workflows.forEach((workflow) => map.set(workflow.id, workflow.name));
    return map;
  }, [workflows]);

  const openCreate = (): void => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (workflow: Workflow): void => {
    setEditing(workflow);
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

  const handleDelete = (workflow: Workflow): void => {
    setActionError(null);
    setBusyId(workflow.id);
    startTransition(async () => {
      const response = await deleteWorkflowAction(organizationId, workflow.id);
      setBusyId(null);
      if (!response.success) {
        setActionError(response.error.message);
        return;
      }
      router.refresh();
    });
  };

  const handleRun = (workflow: Workflow): void => {
    setActionError(null);
    setBusyId(workflow.id);
    startTransition(async () => {
      const response = await runWorkflowAction(organizationId, workflow.id);
      setBusyId(null);
      if (!response.success) {
        setActionError(response.error.message);
        return;
      }
      setTab("history");
      router.refresh();
    });
  };

  const toggleExpanded = (instanceId: string): void => {
    setExpanded((prev) => ({ ...prev, [instanceId]: !prev[instanceId] }));
  };

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Workflows"
        description="Automate multi-step actions triggered by business events"
        icon={WorkflowIcon}
      >
        {canManage && tab === "workflows" && !formOpen && (
          <Button type="button" variant="gradient" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New workflow
          </Button>
        )}
      </PageHeader>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Workflow sections"
        className="mt-4 flex gap-1 border-b border-slate-200 dark:border-slate-800"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "workflows"}
          onClick={() => setTab("workflows")}
          className={tabClass(tab === "workflows")}
        >
          <WorkflowIcon className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          Workflows
          <span className="ml-1.5 text-xs text-slate-400">
            ({workflows.length})
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          onClick={() => setTab("history")}
          className={tabClass(tab === "history")}
        >
          <History className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
          Run history
          <span className="ml-1.5 text-xs text-slate-400">({runs.length})</span>
        </button>
      </div>

      {actionError && <ErrorBanner message={actionError} className="mt-4" />}

      {/* Workflows tab */}
      {tab === "workflows" && (
        <div className="mt-4">
          {formOpen && (
            <WorkflowForm
              organizationId={organizationId}
              workflow={editing ?? undefined}
              onClose={closeForm}
              onSaved={handleSaved}
            />
          )}

          {workflows.length === 0 && !formOpen ? (
            <EmptyState
              icon={WorkflowIcon}
              title="No workflows yet"
              description="Create a workflow to automate a sequence of actions — log entries, webhooks, and approvals — when a business event occurs."
              action={
                canManage
                  ? { label: "New workflow", icon: Plus, onClick: openCreate }
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
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Name
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Trigger
                        </th>
                        <th scope="col" className="px-3 py-2 font-medium">
                          Steps
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
                      {workflows.map((workflow) => (
                        <tr
                          key={workflow.id}
                          className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                            {workflow.name}
                            {workflow.description && (
                              <p className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                {workflow.description}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                            {workflow.triggerEvent}
                          </td>
                          <td className="nums px-3 py-2 text-slate-600 dark:text-slate-400">
                            {workflow.steps.length}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              dot
                              variant={workflow.isActive ? "success" : "muted"}
                            >
                              {workflow.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          {canManage && (
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Run ${workflow.name}`}
                                  loading={isPending && busyId === workflow.id}
                                  onClick={() => handleRun(workflow)}
                                >
                                  <Play className="h-4 w-4" aria-hidden="true" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Edit ${workflow.name}`}
                                  onClick={() => openEdit(workflow)}
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
                                  aria-label={`Delete ${workflow.name}`}
                                  loading={isPending && busyId === workflow.id}
                                  onClick={() => handleDelete(workflow)}
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

      {/* Run history tab */}
      {tab === "history" && (
        <div className="mt-4">
          {runs.length === 0 ? (
            <EmptyState
              icon={History}
              title="No runs yet"
              description="When a workflow is triggered, each run appears here with its per-step execution status."
            />
          ) : (
            <div className="space-y-3">
              {runs.map((run) => {
                const isOpen = expanded[run.instance.id] ?? false;
                const Chevron = isOpen ? ChevronDown : ChevronRight;
                return (
                  <motion.div
                    key={run.instance.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleExpanded(run.instance.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <div className="flex items-center gap-2">
                        <Chevron
                          className="h-4 w-4 text-slate-400"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {workflowNameById.get(run.instance.workflowId) ??
                              "Workflow"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Started{" "}
                            {(
                              run.instance.startedAt ?? run.instance.createdAt
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge
                        dot
                        variant={
                          INSTANCE_STATUS_VARIANT[run.instance.status]
                        }
                      >
                        {run.instance.status}
                      </Badge>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                        {run.instance.error && (
                          <p className="text-error-700 dark:text-error-300 mb-3 text-sm">
                            {run.instance.error}
                          </p>
                        )}
                        {run.steps.length === 0 ? (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            No step executions recorded.
                          </p>
                        ) : (
                          <ol className="space-y-2">
                            {run.steps.map((step) => (
                              <li
                                key={step.id}
                                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/50"
                              >
                                <div>
                                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                    {step.stepIndex + 1}. {step.stepType}
                                    <span className="ml-2 font-mono text-xs text-slate-400 dark:text-slate-500">
                                      {step.stepId}
                                    </span>
                                  </p>
                                  {step.error && (
                                    <p className="text-error-700 dark:text-error-300 text-xs">
                                      {step.error}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  dot
                                  variant={STEP_STATUS_VARIANT[step.status]}
                                >
                                  {step.status}
                                </Badge>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
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
      ? "border-primary-600 text-primary-700"
      : "border-transparent text-slate-500 hover:text-slate-700",
  ].join(" ");
}
