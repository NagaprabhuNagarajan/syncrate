"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Barcode,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
} from "lucide-react";
import { type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorBanner } from "@/components/shared/error-banner";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  updateSerialAction,
  archiveSerialAction,
} from "@/features/serial/actions/serial.actions";
import {
  SerialForm,
  SERIAL_STATUS_LABELS,
  type ProductOption,
  type BranchOption,
} from "@/features/serial/components/serial-form";
import type {
  SerialNumber,
  SerialListResult,
  SerialStatus,
} from "@/features/serial/types/serial.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
// ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<SerialStatus, BadgeProps["variant"]> = {
  in_stock: "success",
  reserved: "warning",
  sold: "secondary",
  returned: "muted",
  damaged: "destructive",
};

const STATUS_OPTIONS: readonly SerialStatus[] = [
  "in_stock",
  "reserved",
  "sold",
  "returned",
  "damaged",
];

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface SerialsViewProps {
  readonly organizationId: string;
  readonly result: SerialListResult;
  readonly products: readonly ProductOption[];
  readonly branches: readonly BranchOption[];
  readonly filters: {
    readonly search?: string;
    readonly status?: SerialStatus;
    readonly productId?: string;
  };
  readonly canManage: boolean;
}

export function SerialsView({
  organizationId,
  result,
  products,
  branches,
  filters,
  canManage,
}: SerialsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editing, setEditing] = useState<SerialNumber | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const branchNames = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach((w) => map.set(w.id, w.name));
    return map;
  }, [branches]);

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
    router.push(query ? `/inventory/serials?${query}` : "/inventory/serials");
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushWith({ search: searchInput.trim() || undefined, page: undefined });
  };

  const handleStatusFilter = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    pushWith({ status: event.target.value || undefined, page: undefined });
  };

  const handleProductFilter = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    pushWith({ productId: event.target.value || undefined, page: undefined });
  };

  const goToPage = (next: number): void => {
    pushWith({ page: next <= 1 ? undefined : String(next) });
  };

  const handleStatusChange = (
    serial: SerialNumber,
    nextStatus: string
  ): void => {
    if (nextStatus === serial.status) {
      return;
    }
    setRowError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("status", nextStatus);
      const response = await updateSerialAction(
        organizationId,
        serial.id,
        fd
      );
      if (!response.success) {
        setRowError(response.error.message);
        return;
      }
      router.refresh();
    });
  };

  const handleArchive = (serial: SerialNumber): void => {
    setRowError(null);
    startTransition(async () => {
      const response = await archiveSerialAction(organizationId, serial.id);
      if (!response.success) {
        setRowError(response.error.message);
        return;
      }
      router.refresh();
    });
  };

  const closeDialogs = (): void => {
    setRegisterOpen(false);
    setEditing(null);
  };

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Serial Numbers"
        description="Track unique, serialized inventory items"
        icon={Barcode}
      >
        {canManage && (
          <Button
            type="button"
            variant="gradient"
            onClick={() => setRegisterOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Register serials
          </Button>
        )}
      </PageHeader>

      {rowError && <ErrorBanner message={rowError} className="mt-4" />}

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="relative flex-1"
        >
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search serial numbers"
            placeholder="Search by serial number or notes"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </form>
        <select
          aria-label="Filter by product"
          value={filters.productId ?? ""}
          onChange={handleProductFilter}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by status"
          value={filters.status ?? ""}
          onChange={handleStatusFilter}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {SERIAL_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {/* Table / empty state */}
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={Barcode}
            title="No serial numbers found"
            description={
              filters.search || filters.status || filters.productId
                ? "No serials match your current filters. Try adjusting your search."
                : "Register your first serial numbers to start tracking unique items."
            }
            action={
              canManage
                ? {
                    label: "Register serials",
                    icon: Plus,
                    onClick: () => setRegisterOpen(true),
                  }
                : undefined
            }
          />
        ) : (
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
                      Serial
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Product
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Branch
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Notes
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
                  {items.map((serial: SerialNumber) => (
                    <tr
                      key={serial.id}
                      className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => setEditing(serial)}
                            className="hover:text-primary-600 hover:underline dark:hover:text-primary-400"
                          >
                            {serial.serialNumber}
                          </button>
                        ) : (
                          serial.serialNumber
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {serial.productName ?? "—"}
                        {serial.productCode && (
                          <span className="ml-1 text-xs text-slate-400">
                            ({serial.productCode})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          variant={STATUS_VARIANT[serial.status]}
                          label={SERIAL_STATUS_LABELS[serial.status]}
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {serial.branchId
                          ? branchNames.get(serial.branchId) ?? "—"
                          : "—"}
                      </td>
                      <td className="max-w-[16rem] truncate px-3 py-2 text-slate-600 dark:text-slate-400">
                        {serial.notes ?? "—"}
                      </td>
                      {canManage && (
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <label className="sr-only" htmlFor={`status-${serial.id}`}>
                              Update status for {serial.serialNumber}
                            </label>
                            <select
                              id={`status-${serial.id}`}
                              value={serial.status}
                              onChange={(e) =>
                                handleStatusChange(serial, e.target.value)
                              }
                              className="rounded-md border border-input bg-background px-2 py-1 text-xs text-slate-700 shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:text-slate-300"
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {SERIAL_STATUS_LABELS[status]}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Archive ${serial.serialNumber}`}
                              onClick={() => handleArchive(serial)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
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
        )}
      </div>

      {/* Pagination */}
      {items.length > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-muted-foreground text-sm">
            {total} {total === 1 ? "serial" : "serials"} · Page {page} of{" "}
            {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}

      {/* Register / edit dialog */}
      {(registerOpen || editing) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editing ? "Edit serial number" : "Register serial numbers"}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
        >
          <div className="relative w-full max-w-2xl">
            <button
              type="button"
              aria-label="Close"
              onClick={closeDialogs}
              className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <SerialForm
              organizationId={organizationId}
              products={products}
              branches={branches}
              serial={editing ?? undefined}
              onCancel={closeDialogs}
              onSuccess={() => {
                closeDialogs();
                router.refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
