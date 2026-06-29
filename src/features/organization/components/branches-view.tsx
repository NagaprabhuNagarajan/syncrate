"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-500/10">
          <Building2 className="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {branch.name}
            </h3>
            {branch.isHeadquarters && <Badge variant="info">HQ</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{branch.code}</Badge>
            <Badge dot variant={STATUS_VARIANT[branch.status]}>
              {STATUS_LABEL[branch.status]}
            </Badge>
          </div>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        {location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <dd>{location}</dd>
          </div>
        )}
        {branch.gstNumber && (
          <div>
            <dt className="inline font-medium text-slate-400 dark:text-slate-500">GST: </dt>
            <dd className="inline">{branch.gstNumber}</dd>
          </div>
        )}
      </dl>

      <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEdit(branch)}
          aria-label={`Edit ${branch.name}`}
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </Button>
        {!branch.isHeadquarters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-error-600 hover:bg-error-50 hover:text-error-700 dark:text-error-400 dark:hover:bg-error-500/10 dark:hover:text-error-300"
            onClick={() => onDelete(branch)}
            aria-label={`Delete ${branch.name}`}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </Button>
        )}
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
          <div className="bg-error-50 flex h-11 w-11 shrink-0 items-center justify-center rounded-full dark:bg-error-500/10">
            <AlertTriangle
              className="text-error-600 h-5 w-5 dark:text-error-400"
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
              <span className="font-medium text-slate-700 dark:text-slate-300">{branch.name}</span>?
              This action cannot be undone.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="border-error-200 bg-error-50 text-error-800 mt-4 rounded-lg border px-4 py-3 text-sm dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
            role="alert"
          >
            {error}
          </div>
        )}

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

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Branches"
        description="Manage the branches and locations of your organization"
        icon={Building2}
      >
        <Button
          type="button"
          variant="gradient"
          onClick={() => setFormState({ mode: "create" })}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add branch
        </Button>
      </PageHeader>

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
