"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Lock, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
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
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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
  readonly onEdit: (role: RoleWithPermissions) => void;
  readonly onDelete: (role: RoleWithPermissions) => void;
}

function RoleRow({ role, canManage, onEdit, onDelete }: RoleRowProps) {
  const handleEdit = useCallback(() => {
    onEdit(role);
  }, [onEdit, role]);

  const handleDelete = useCallback(() => {
    onDelete(role);
  }, [onDelete, role]);

  const editable = canManage && !role.isSystem;

  return (
    <tr className="transition-colors hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{role.name}</div>
        {role.description && (
          <div className="text-xs text-slate-500">{role.description}</div>
        )}
      </td>
      <td className="px-4 py-3">
        {role.isSystem ? (
          <Badge variant="muted">
            <Lock className="mr-1 h-3 w-3" aria-hidden="true" />
            System
          </Badge>
        ) : (
          <Badge variant="info">Custom</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-slate-600 tabular-nums">
        {role.permissionIds.length}
      </td>
      <td className="px-4 py-3 text-right">
        {editable ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleEdit}
              aria-label={`Edit ${role.name}`}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleDelete}
              aria-label={`Delete ${role.name}`}
            >
              <Trash2 className="text-error h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Read-only</span>
        )}
      </td>
    </tr>
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
            <p
              role="alert"
              className="text-error-700 bg-error-50 border-error-200 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </p>
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
  | { readonly mode: "edit"; readonly role: RoleWithPermissions };

export function RolesView({
  organizationId,
  roles,
  permissions,
  canManage,
}: RolesViewProps) {
  const router = useRouter();
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
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Roles & Permissions"
        description="Manage custom roles and the permissions they grant"
        icon={ShieldCheck}
      >
        {canManage && (
          <Button type="button" onClick={handleOpenCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Create role
          </Button>
        )}
      </PageHeader>

      <div className="mt-6">
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Permissions
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roles.map((role) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      canManage={canManage}
                      onEdit={handleOpenEdit}
                      onDelete={handleRequestDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {dialog.mode !== "closed" && (
        <RoleFormDialog
          organizationId={organizationId}
          role={dialog.mode === "edit" ? dialog.role : null}
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
