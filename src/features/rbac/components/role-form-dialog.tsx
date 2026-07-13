"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner } from "@/components/shared/error-banner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  assignPermissionsAction,
  createRoleAction,
  updateRoleAction,
} from "@/features/rbac/actions/role.actions";
import type {
  Permission,
  PermissionGroup,
  RoleWithPermissions,
} from "@/features/rbac/types/rbac.types";

// ─────────────────────────────────────────────────────────────
// Grouping helper
// ─────────────────────────────────────────────────────────────

function groupPermissions(
  permissions: readonly Permission[]
): PermissionGroup[] {
  const byModule = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const bucket = byModule.get(permission.module);
    if (bucket) {
      bucket.push(permission);
    } else {
      byModule.set(permission.module, [permission]);
    }
  }
  return [...byModule.entries()]
    .map(([module, perms]) => ({ module, permissions: perms }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ─────────────────────────────────────────────────────────────
// Permission row
// ─────────────────────────────────────────────────────────────

interface PermissionRowProps {
  readonly permission: Permission;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onToggle: (permissionId: string) => void;
}

function PermissionRow({
  permission,
  checked,
  disabled,
  onToggle,
}: PermissionRowProps) {
  const handleChange = useCallback(() => {
    onToggle(permission.id);
  }, [onToggle, permission.id]);

  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
        checked={checked}
        disabled={disabled}
        onChange={handleChange}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
          {permission.action}
        </span>
        {permission.description && (
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {permission.description}
          </span>
        )}
      </span>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// Module group
// ─────────────────────────────────────────────────────────────

interface PermissionGroupSectionProps {
  readonly group: PermissionGroup;
  readonly selectedIds: ReadonlySet<string>;
  readonly disabled: boolean;
  readonly onToggle: (permissionId: string) => void;
  readonly onToggleModule: (
    permissionIds: readonly string[],
    selectAll: boolean
  ) => void;
}

function PermissionGroupSection({
  group,
  selectedIds,
  disabled,
  onToggle,
  onToggleModule,
}: PermissionGroupSectionProps) {
  const ids = useMemo(
    () => group.permissions.map((p) => p.id),
    [group.permissions]
  );
  const allSelected = ids.every((id) => selectedIds.has(id));
  const selectedCount = ids.filter((id) => selectedIds.has(id)).length;

  const handleModuleToggle = useCallback(() => {
    onToggleModule(ids, !allSelected);
  }, [onToggleModule, ids, allSelected]);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {titleCase(group.module)}
        </span>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
            checked={allSelected}
            disabled={disabled}
            onChange={handleModuleToggle}
            aria-label={`Select all ${group.module} permissions`}
          />
          <span>
            {selectedCount}/{ids.length}
          </span>
        </label>
      </div>
      <div className="grid grid-cols-1 gap-0.5 p-1.5 sm:grid-cols-2">
        {group.permissions.map((permission) => (
          <PermissionRow
            key={permission.id}
            permission={permission}
            checked={selectedIds.has(permission.id)}
            disabled={disabled}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Dialog
// ─────────────────────────────────────────────────────────────

interface RoleFormDialogProps {
  readonly organizationId: string;
  /** The role being edited, or null when creating a new one. */
  readonly role: RoleWithPermissions | null;
  readonly permissions: readonly Permission[];
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

export function RoleFormDialog({
  organizationId,
  role,
  permissions,
  onClose,
  onSaved,
}: RoleFormDialogProps) {
  const isEdit = role !== null;
  const groups = useMemo(() => groupPermissions(permissions), [permissions]);

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(role?.permissionIds ?? [])
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setName(event.target.value);
    },
    []
  );

  const handleDescriptionChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDescription(event.target.value);
    },
    []
  );

  const handleToggle = useCallback((permissionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  }, []);

  const handleToggleModule = useCallback(
    (permissionIds: readonly string[], selectAll: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of permissionIds) {
          if (selectAll) {
            next.add(id);
          } else {
            next.delete(id);
          }
        }
        return next;
      });
    },
    []
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      const permissionIds = [...selectedIds];

      startTransition(async () => {
        if (isEdit && role) {
          const updated = await updateRoleAction(organizationId, role.id, {
            name,
            description,
            version: role.version,
          });
          if (!updated.success) {
            setError(updated.error.message);
            return;
          }
          const assigned = await assignPermissionsAction(
            organizationId,
            role.id,
            permissionIds
          );
          if (!assigned.success) {
            setError(assigned.error.message);
            return;
          }
        } else {
          const created = await createRoleAction(organizationId, {
            name,
            description,
            permissionIds,
          });
          if (!created.success) {
            setError(created.error.message);
            return;
          }
        }
        onSaved();
        onClose();
      });
    },
    [
      isEdit,
      role,
      organizationId,
      name,
      description,
      selectedIds,
      onSaved,
      onClose,
    ]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit role" : "Create role"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle>{isEdit ? "Edit role" : "Create role"}</CardTitle>
              <CardDescription>
                {isEdit
                  ? "Update this custom role and the permissions it grants."
                  : "Define a custom role and choose the permissions it grants."}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div>
              <label
                htmlFor="role-name"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Role name
              </label>
              <Input
                id="role-name"
                type="text"
                required
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. Sales Manager"
              />
            </div>

            <div>
              <label
                htmlFor="role-description"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Description
              </label>
              <Textarea
                id="role-description"
                rows={2}
                value={description}
                onChange={handleDescriptionChange}
                placeholder="What this role is for"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck
                  className="h-4 w-4 text-primary-600"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Permissions ({selectedIds.size} selected)
                </span>
              </div>
              <div className="space-y-3">
                {groups.map((group) => (
                  <PermissionGroupSection
                    key={group.module}
                    group={group}
                    selectedIds={selectedIds}
                    disabled={isPending}
                    onToggle={handleToggle}
                    onToggleModule={handleToggleModule}
                  />
                ))}
              </div>
            </div>

            {error && <ErrorBanner message={error} />}
          </CardContent>

          <CardFooter className="justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={isPending}>
              {isEdit ? "Save changes" : "Create role"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
