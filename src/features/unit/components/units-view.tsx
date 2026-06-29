"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Ruler, Plus, Search, Pencil, Archive } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { archiveUnitAction } from "@/features/unit/actions/unit.actions";
import { UnitForm } from "@/features/unit/components/unit-form";
import type {
  Unit,
  UnitListResult,
  UnitStatus,
} from "@/features/unit/types/unit.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
// ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<UnitStatus, BadgeProps["variant"]> = {
  active: "success",
  archived: "secondary",
};

const STATUS_LABEL: Record<UnitStatus, string> = {
  active: "Active",
  archived: "Archived",
};

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface UnitsViewProps {
  readonly organizationId: string;
  readonly result: UnitListResult;
  readonly filters: {
    readonly search?: string;
    readonly status?: UnitStatus;
  };
  readonly canManage: boolean;
}

export function UnitsView({
  organizationId,
  result,
  filters,
  canManage,
}: UnitsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
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
    router.push(query ? `/products/units?${query}` : "/products/units");
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

  const closeForm = (): void => {
    setCreating(false);
    setEditing(null);
  };

  const handleSuccess = (): void => {
    closeForm();
    router.refresh();
  };

  const handleArchive = (unit: Unit): void => {
    setActionError(null);
    startArchive(async () => {
      const response = await archiveUnitAction(organizationId, unit.id);
      if (!response.success) {
        setActionError(response.error.message);
        return;
      }
      router.refresh();
    });
  };

  const showForm = creating || editing !== null;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Units"
        description="Manage the units of measure for your product catalog"
        icon={Ruler}
      >
        {canManage && !showForm && (
          <Button
            type="button"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add unit
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

      {showForm && (
        <div className="mt-6">
          <UnitForm
            organizationId={organizationId}
            unit={editing ?? undefined}
            onSuccess={handleSuccess}
            onCancel={closeForm}
          />
        </div>
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="relative flex-1"
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search units"
            placeholder="Search by name or symbol"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </form>
        <select
          aria-label="Filter by status"
          value={filters.status ?? ""}
          onChange={handleStatusChange}
          className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table / empty state */}
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState
            icon={Ruler}
            title="No units found"
            description={
              filters.search || filters.status
                ? "No units match your current filters. Try adjusting your search."
                : "Add your first unit of measure to start building your product catalog."
            }
            action={
              canManage
                ? {
                    label: "Add unit",
                    icon: Plus,
                    onClick: () => {
                      setEditing(null);
                      setCreating(true);
                    },
                  }
                : undefined
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Symbol
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    {canManage && (
                      <th
                        scope="col"
                        className="px-4 py-3 text-right font-medium"
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((unit: Unit) => (
                    <tr key={unit.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {unit.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {unit.symbol}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[unit.status]}>
                          {STATUS_LABEL[unit.status]}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setCreating(false);
                                setEditing(unit);
                              }}
                            >
                              <Pencil
                                className="mr-1 h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              Edit
                            </Button>
                            {unit.status !== "archived" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isArchiving}
                                onClick={() => handleArchive(unit)}
                              >
                                <Archive
                                  className="mr-1 h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                Archive
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
