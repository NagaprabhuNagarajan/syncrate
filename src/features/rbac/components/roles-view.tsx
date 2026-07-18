"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Copy,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/utils/cn";
import { deleteRoleAction } from "@/features/rbac/actions/role.actions";
import { RoleFormDialog } from "@/features/rbac/components/role-form-dialog";
import type {
  Permission,
  RoleWithPermissions,
} from "@/features/rbac/types/rbac.types";

// ─────────────────────────────────────────────────────────────
// Role row
// ─────────────────────────────────────────────────────────────

interface RoleRowProps {
  readonly role: RoleWithPermissions;
  readonly canManage: boolean;
  readonly isApprover: boolean;
  readonly onEdit: (role: RoleWithPermissions) => void;
  readonly onDelete: (role: RoleWithPermissions) => void;
  readonly onDuplicate: (role: RoleWithPermissions) => void;
}

function RoleRow({
  role,
  canManage,
  isApprover,
  onEdit,
  onDelete,
  onDuplicate,
}: RoleRowProps) {
  const handleEdit = useCallback(() => {
    onEdit(role);
  }, [onEdit, role]);

  const handleDelete = useCallback(() => {
    onDelete(role);
  }, [onDelete, role]);

  const handleDuplicate = useCallback(() => {
    onDuplicate(role);
  }, [onDuplicate, role]);

  // The org owns its copy of each system role. Permissions on any role are
  // editable — except the Owner role, which must keep full access. Only custom
  // roles can be renamed or deleted; system roles can additionally be duplicated.
  const isOwner = role.isSystem && role.name === "Owner";
  const canEditPermissions = canManage && !isOwner;
  const canDelete = canManage && !role.isSystem;
  const canDuplicate = canManage && role.isSystem;
  const hasActions = canEditPermissions || canDelete || canDuplicate;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              role.isSystem
                ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                : "bg-gradient-brand text-white shadow-glow-primary"
            )}
          >
            {role.isSystem ? (
              <Lock className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {role.name}
              </p>
              {isApprover && (
                <Badge variant="success">
                  <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                  Approver
                </Badge>
              )}
            </div>
            {role.description && (
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {role.description}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        {role.isSystem ? (
          <Badge variant="muted">
            <Lock className="mr-1 h-3 w-3" aria-hidden="true" />
            System
          </Badge>
        ) : (
          <Badge dot variant="info">
            Custom
          </Badge>
        )}
      </TableCell>
      <TableCell className="nums text-slate-600 dark:text-slate-400">
        {role.permissionIds.length}
      </TableCell>
      <TableCell className="text-right">
        {hasActions ? (
          <div className="flex items-center justify-end gap-1">
            {canEditPermissions && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleEdit}
                aria-label={`Edit ${role.name}`}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            {canDuplicate && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleDuplicate}
                aria-label={`Duplicate ${role.name}`}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleDelete}
                aria-label={`Delete ${role.name}`}
              >
                <Trash2 className="text-error h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Read-only
          </span>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────
// Delete confirmation
// ─────────────────────────────────────────────────────────────

interface DeleteRoleDialogProps {
  readonly role: RoleWithPermissions;
  readonly onCancel: () => void;
  readonly onConfirm: (role: RoleWithPermissions) => void;
  readonly pending: boolean;
  readonly error: string | null;
}

function DeleteRoleDialog({
  role,
  onCancel,
  onConfirm,
  pending,
  error,
}: DeleteRoleDialogProps) {
  const handleConfirm = useCallback(() => {
    onConfirm(role);
  }, [onConfirm, role]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delete role"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Delete role</CardTitle>
          <CardDescription>
            Delete the custom role &ldquo;{role.name}&rdquo;? This cannot be
            undone. Members assigned to this role keep their account but lose
            this role&rsquo;s permissions.
          </CardDescription>
        </CardHeader>
        {error && (
          <CardContent>
            <ErrorBanner message={error} />
          </CardContent>
        )}
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            loading={pending}
          >
            Delete role
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────

interface RolesViewProps {
  readonly organizationId: string;
  readonly roles: readonly RoleWithPermissions[];
  readonly permissions: readonly Permission[];
  readonly canManage: boolean;
}

type DialogState =
  | { readonly mode: "closed" }
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly role: RoleWithPermissions }
  | { readonly mode: "duplicate"; readonly role: RoleWithPermissions };

export function RolesView({
  organizationId,
  roles,
  permissions,
  canManage,
}: RolesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const org = searchParams.get("org");
  const settingsHref = org ? `/settings?org=${org}` : "/settings";

  // A role is an "approver" when it holds the approval.decide permission.
  const approverPermissionId = permissions.find(
    (permission) => permission.name === "approval.decide"
  )?.id;

  const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] =
    useState<RoleWithPermissions | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const handleOpenCreate = useCallback(() => {
    setDialog({ mode: "create" });
  }, []);

  const handleOpenEdit = useCallback((role: RoleWithPermissions) => {
    setDialog({ mode: "edit", role });
  }, []);

  const handleOpenDuplicate = useCallback((role: RoleWithPermissions) => {
    setDialog({ mode: "duplicate", role });
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialog({ mode: "closed" });
  }, []);

  const handleSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleRequestDelete = useCallback((role: RoleWithPermissions) => {
    setDeleteError(null);
    setDeleteTarget(role);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setDeleteTarget(null);
    setDeleteError(null);
  }, []);

  const handleConfirmDelete = useCallback(
    (role: RoleWithPermissions) => {
      setDeleteError(null);
      startDelete(async () => {
        const result = await deleteRoleAction(organizationId, role.id);
        if (!result.success) {
          setDeleteError(result.error.message);
          return;
        }
        setDeleteTarget(null);
        router.refresh();
      });
    },
    [organizationId, router]
  );

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
              Roles &amp; Permissions
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {roles.length}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage custom roles and the permissions they grant
            </p>
          </div>
        </div>

        {canManage && (
          <Button type="button" variant="gradient" onClick={handleOpenCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Create role
          </Button>
        )}
      </motion.div>

      <div className="mt-5">
        {roles.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No roles found"
            description="Create your first custom role to tailor permissions for your team."
            action={
              canManage
                ? { label: "Create role", icon: Plus, onClick: handleOpenCreate }
                : undefined
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
          >
            <Table
              className="[&_td]:px-5 [&_th]:px-5"
              wrapperClassName="rounded-none border-0 bg-transparent"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <RoleRow
                    key={role.id}
                    role={role}
                    canManage={canManage}
                    isApprover={
                      approverPermissionId !== undefined &&
                      role.permissionIds.includes(approverPermissionId)
                    }
                    onEdit={handleOpenEdit}
                    onDelete={handleRequestDelete}
                    onDuplicate={handleOpenDuplicate}
                  />
                ))}
              </TableBody>
            </Table>
          </motion.div>
        )}
      </div>

      {dialog.mode !== "closed" && (
        <RoleFormDialog
          organizationId={organizationId}
          role={dialog.mode === "edit" ? dialog.role : null}
          initial={
            dialog.mode === "duplicate"
              ? {
                  name: `${dialog.role.name} (copy)`,
                  description: dialog.role.description,
                  permissionIds: dialog.role.permissionIds,
                }
              : undefined
          }
          permissions={permissions}
          onClose={handleCloseDialog}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <DeleteRoleDialog
          role={deleteTarget}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
          pending={isDeleting}
          error={deleteError}
        />
      )}
    </div>
  );
}
