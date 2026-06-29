"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  RotateCcw,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  SalesReturnListItem,
  SalesReturnListResult,
  SalesReturnStatus,
} from "@/features/sales/types/sales-return.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
// ─────────────────────────────────────────────────────────────

export const SRETURN_STATUS_VARIANT: Record<
  SalesReturnStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  completed: "success",
  cancelled: "destructive",
};

export const SRETURN_STATUS_LABEL: Record<SalesReturnStatus, string> = {
  draft: "Draft",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: Date): string {
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const REASON_LABEL: Record<string, string> = {
  damaged: "Damaged",
  wrong_product: "Wrong product",
  expired: "Expired",
  customer_rejection: "Customer rejection",
  warranty: "Warranty",
  other: "Other",
};

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface SalesReturnsViewProps {
  readonly organizationId: string;
  readonly result: SalesReturnListResult;
  readonly filters: {
    readonly search?: string;
    readonly status?: SalesReturnStatus;
  };
  readonly canManage: boolean;
}

export function SalesReturnsView({
  result,
  filters,
  canManage,
}: SalesReturnsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const withOrg = (path: string): string => {
    const org = searchParams.get("org");
    return org ? `${path}?org=${org}` : path;
  };

  const detailHref = (id: string): string => withOrg(`/sales/returns/${id}`);
  const newHref = (): string => withOrg("/sales/returns/new");

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
    router.push(query ? `/sales/returns?${query}` : "/sales/returns");
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushWith({ search: searchInput.trim() || undefined, page: undefined });
  };

  const handleStatusChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    pushWith({ status: event.target.value || undefined, page: undefined });
  };

  const goToPage = (next: number): void => {
    pushWith({ page: next <= 1 ? undefined : String(next) });
  };

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Sales returns"
        description="Manage goods returned by your customers"
        icon={RotateCcw}
      >
        {canManage && (
          <Button asChild variant="gradient">
            <Link href={newHref()}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New return
            </Link>
          </Button>
        )}
      </PageHeader>

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
            aria-label="Search sales returns"
            placeholder="Search by return number"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
            icon={RotateCcw}
            title="No sales returns found"
            description={
              filters.search || filters.status
                ? "No returns match your current filters. Try adjusting your search."
                : "Record your first sales return when a customer returns goods."
            }
            action={
              canManage
                ? {
                    label: "New return",
                    icon: Plus,
                    onClick: () => router.push(newHref()),
                  }
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
                      Return no.
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Customer
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Date
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Reason
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Amount
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((ret: SalesReturnListItem) => (
                    <tr
                      key={ret.id}
                      onClick={() => router.push(detailHref(ret.id))}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                        <Link
                          href={detailHref(ret.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                        >
                          {ret.returnNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        {ret.customerName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {formatDate(ret.returnDate)}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {REASON_LABEL[ret.reason] ?? ret.reason}
                      </td>
                      <td className="nums px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(ret.totalAmount)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge dot variant={SRETURN_STATUS_VARIANT[ret.status]}>
                          {SRETURN_STATUS_LABEL[ret.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={detailHref(ret.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                          aria-label={`View return ${ret.returnNumber}`}
                        >
                          View
                        </Link>
                      </td>
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
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "return" : "returns"} · Page {page} of{" "}
            {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              aria-label="Previous page"
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
              aria-label="Next page"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
