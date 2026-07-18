"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  PauseCircle,
  Pencil,
  Phone,
  Plus,
  Trash2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared/stat-tile";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBanner } from "@/components/shared/error-banner";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/utils/cn";
import { deleteBranchAction } from "@/features/organization/actions/organization.actions";
import type {
  Branch,
  BranchStatus,
} from "@/features/organization/types/organization.types";
import { BranchForm } from "./branch-form";

// ─────────────────────────────────────────────────────────────
// Status badge mapping
// ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<
  BranchStatus,
  "success" | "muted" | "destructive"
> = {
  active: "success",
  inactive: "muted",
  closed: "destructive",
};

const STATUS_LABEL: Record<BranchStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  closed: "Closed",
};

// Left-edge accent bar color, keyed by status.
const STATUS_ACCENT: Record<BranchStatus, string> = {
  active: "bg-success",
  inactive: "bg-slate-300 dark:bg-slate-600",
  closed: "bg-error",
};

// ─────────────────────────────────────────────────────────────
// Branch card
// ─────────────────────────────────────────────────────────────

interface BranchCardProps {
  readonly branch: Branch;
  readonly index: number;
  readonly onEdit: (branch: Branch) => void;
  readonly onDelete: (branch: Branch) => void;
}

function BranchCard({ branch, index, onEdit, onDelete }: BranchCardProps) {
  const location = [branch.city, branch.state].filter(Boolean).join(", ");
  const contactRows = [
    { icon: MapPin, value: location !== "" ? location : "-" },
    { icon: Phone, value: branch.phone ?? "-" },
    { icon: Mail, value: branch.email ?? "-" },
  ].filter(
    (row): row is { icon: typeof MapPin; value: string } => row !== null
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      {/* Status accent bar */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          STATUS_ACCENT[branch.status]
        )}
        aria-hidden="true"
      />

      <div className="flex flex-1 flex-col p-4 pl-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              branch.isHeadquarters
                ? "bg-gradient-brand text-white shadow-glow-primary"
                : "bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400"
            )}
          >
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {branch.name}
              </h3>
              {branch.isHeadquarters && <Badge variant="info">HQ</Badge>}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {branch.code}
              </span>
              <span
                className="text-slate-300 dark:text-slate-600"
                aria-hidden="true"
              >
                &middot;
              </span>
              <StatusBadge
                variant={STATUS_VARIANT[branch.status]}
                label={STATUS_LABEL[branch.status]}
              />
            </div>
          </div>
        </div>

        {/* Contact details */}
        <dl className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          {contactRows.map((row) => (
            <div key={row.value} className="flex items-center gap-2">
              <row.icon
                className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <dd className="truncate">{row.value}</dd>
            </div>
          ))}
        </dl>

        {/* Footer: GST + actions */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {branch.gstNumber ? (
            <span
              className="min-w-0 truncate font-mono text-[11px] text-slate-400 dark:text-slate-500"
              title={branch.gstNumber}
            >
              GST {branch.gstNumber}
            </span>
          ) : (
            <span className="text-[11px] text-slate-300 dark:text-slate-600">
              No GST
            </span>
          )}
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onEdit(branch)}
              aria-label={`Edit ${branch.name}`}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            {!branch.isHeadquarters && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-error hover:bg-error/10 hover:text-error dark:text-error dark:hover:bg-error/10"
                onClick={() => onDelete(branch)}
                aria-label={`Delete ${branch.name}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Delete confirmation dialog
// ─────────────────────────────────────────────────────────────

interface DeleteDialogProps {
  readonly branch: Branch;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function DeleteDialog({
  branch,
  isPending,
  error,
  onConfirm,
  onCancel,
}: DeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-branch-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className="bg-error-50 dark:bg-error-500/10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle
              className="text-error-600 dark:text-error-400 h-5 w-5"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2
              id="delete-branch-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Delete branch
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to delete{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {branch.name}
              </span>
              ? This action cannot be undone.
            </p>
          </div>
        </div>

        {error && <ErrorBanner message={error} className="mt-4" />}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Delete branch
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Branches view
// ─────────────────────────────────────────────────────────────

type FormState = { mode: "create" } | { mode: "edit"; branch: Branch } | null;

interface BranchesViewProps {
  readonly organizationId: string;
  readonly branches: Branch[];
}

export function BranchesView({ organizationId, branches }: BranchesViewProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const closeForm = () => setFormState(null);

  const handleFormSuccess = () => {
    setFormState(null);
    router.refresh();
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) {
      return;
    }
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteBranchAction(organizationId, deleteTarget.id);
      if (!result.success) {
        setDeleteError(result.error.message);
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    });
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const activeCount = branches.filter((b) => b.status === "active").length;
  const inactiveCount = branches.filter((b) => b.status === "inactive").length;
  const closedCount = branches.filter((b) => b.status === "closed").length;

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
            <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Branches
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {branches.length}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage the branches and locations of your organization
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="gradient"
          onClick={() => setFormState({ mode: "create" })}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add branch
        </Button>
      </motion.div>

      {/* Stat tiles */}
      {branches.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={Building2}
            label="Total Branches"
            value={branches.length}
            tint="bg-gradient-brand"
            index={0}
          />
          <StatTile
            icon={CheckCircle2}
            label="Active"
            value={activeCount}
            tint="bg-gradient-success"
            index={1}
          />
          <StatTile
            icon={PauseCircle}
            label="Inactive"
            value={inactiveCount}
            tint="bg-gradient-warning"
            index={2}
          />
          <StatTile
            icon={XCircle}
            label="Closed"
            value={closedCount}
            tint="bg-gradient-error"
            index={3}
          />
        </div>
      )}

      <div className="mt-6">
        {branches.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No branches yet"
            description="Create your first branch to start organizing your locations and teams."
            action={{
              label: "Add branch",
              icon: Plus,
              onClick: () => setFormState({ mode: "create" }),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {branches.map((branch, i) => (
              <BranchCard
                key={branch.id}
                branch={branch}
                index={i}
                onEdit={(b) => setFormState({ mode: "edit", branch: b })}
                onDelete={(b) => {
                  setDeleteError(null);
                  setDeleteTarget(b);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit form overlay */}
      <AnimatePresence>
        {formState && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
            <button
              type="button"
              aria-label="Close form"
              className="fixed inset-0 bg-slate-900/40"
              onClick={closeForm}
            />
            <div className="relative z-10 my-auto w-full max-w-2xl">
              <BranchForm
                organizationId={organizationId}
                branch={
                  formState.mode === "edit" ? formState.branch : undefined
                }
                onSuccess={handleFormSuccess}
                onCancel={closeForm}
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteDialog
            branch={deleteTarget}
            isPending={isDeleting}
            error={deleteError}
            onConfirm={handleDeleteConfirm}
            onCancel={closeDeleteDialog}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
