"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Warehouse as WarehouseIcon,
  Plus,
  Search,
  Pencil,
  Archive,
  Star,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { WarehouseFormDialog } from "@/features/warehouse/components/warehouse-form";
import { archiveWarehouseAction } from "@/features/warehouse/actions/warehouse.actions";
import type {
  Warehouse,
  WarehouseListResult,
  WarehouseStatus,
} from "@/features/warehouse/types/warehouse.types";

const STATUS_VARIANT: Record<WarehouseStatus, BadgeProps["variant"]> = {
  active: "success",
  inactive: "muted",
  archived: "secondary",
};

const STATUS_LABEL: Record<WarehouseStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

interface WarehousesViewProps {
  readonly organizationId: string;
  readonly result: WarehouseListResult;
  readonly filters: {
    readonly search?: string;
    readonly status?: WarehouseStatus;
  };
  readonly canManage: boolean;
}

export function WarehousesView({
  organizationId,
  result,
  filters,
  canManage,
}: WarehousesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isArchiving, startArchive] = useTransition();

  const { items } = result;

  const pushWith = (patch: Record<string, string | undefined>): void => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const query = params.toString();
    router.push(
      query ? `/inventory/warehouses?${query}` : "/inventory/warehouses"
    );
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushWith({ search: searchInput.trim() || undefined });
  };

  const handleStatusChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    pushWith({ status: event.target.value || undefined });
  };

  const openCreate = (): void => {
    setEditing(null);
    setActionError(null);
    setFormOpen(true);
  };

  const openEdit = (warehouse: Warehouse): void => {
    setEditing(warehouse);
    setActionError(null);
    setFormOpen(true);
  };

  const handleArchive = (warehouse: Warehouse): void => {
    setActionError(null);
    startArchive(async () => {
      const response = await archiveWarehouseAction(
        organizationId,
        warehouse.id
      );
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
        title="Warehouses"
        description="Manage the stock locations for your organization"
        icon={WarehouseIcon}
      >
        {canManage && (
          <Button type="button" variant="gradient" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add warehouse
          </Button>
        )}
      </PageHeader>

      {actionError && (
        <p
          role="alert"
          className="text-error-700 dark:text-error-300 bg-error-50 dark:bg-error-500/10 border-error-200 dark:border-error-500/30 mt-4 rounded-lg border px-3 py-2.5 text-sm"
        >
          {actionError}
        </p>
      )}

      {formOpen && (
        <WarehouseFormDialog
          organizationId={organizationId}
          warehouse={editing ?? undefined}
          onClose={() => setFormOpen(false)}
          onSuccess={() => {
            setFormOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="relative flex-1"
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search warehouses"
            placeholder="Search by name, code or city"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="pl-9"
          />
        </form>
        <select
          aria-label="Filter by status"
          value={filters.status ?? ""}
          onChange={handleStatusChange}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table / empty state */}
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={WarehouseIcon}
            title="No warehouses found"
            description={
              filters.search || filters.status
                ? "No warehouses match your current filters. Try adjusting your search."
                : "Add your first warehouse to start tracking stock across locations."
            }
            action={
              canManage
                ? { label: "Add warehouse", icon: Plus, onClick: openCreate }
                : undefined
            }
          />
        ) : (
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
                      Code
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Location
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Capacity
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
                  {items.map((warehouse: Warehouse) => (
                    <tr key={warehouse.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {warehouse.code}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                        <span className="inline-flex items-center gap-1.5">
                          {warehouse.name}
                          {warehouse.isDefault && (
                            <Star
                              className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                              aria-label="Default warehouse"
                            />
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {warehouse.city ?? "—"}
                        {warehouse.state ? `, ${warehouse.state}` : ""}
                      </td>
                      <td className="nums px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                        {warehouse.capacity !== null
                          ? warehouse.capacity.toLocaleString("en-IN")
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge dot variant={STATUS_VARIANT[warehouse.status]}>
                          {STATUS_LABEL[warehouse.status]}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Edit ${warehouse.name}`}
                              onClick={() => openEdit(warehouse)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            {warehouse.status !== "archived" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                aria-label={`Archive ${warehouse.name}`}
                                disabled={isArchiving}
                                onClick={() => handleArchive(warehouse)}
                              >
                                <Archive
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

WarehousesView.displayName = "WarehousesView";
