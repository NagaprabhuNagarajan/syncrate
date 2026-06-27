"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  SalesOrderListItem,
  SalesOrderListResult,
  SalesOrderStatus,
} from "@/features/sales/types/sales-order.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
// ─────────────────────────────────────────────────────────────

export const SO_STATUS_VARIANT: Record<
  SalesOrderStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  submitted: "info",
  approved: "success",
  processing: "info",
  partially_delivered: "warning",
  completed: "success",
  cancelled: "destructive",
};

export const SO_STATUS_LABEL: Record<SalesOrderStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  processing: "Processing",
  partially_delivered: "Partially delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "processing", label: "Processing" },
  { value: "partially_delivered", label: "Partially delivered" },
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

function formatDate(value: Date | null): string {
  if (!value) {return "—";}
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface SalesOrdersViewProps {
  readonly organizationId: string;
  readonly result: SalesOrderListResult;
  readonly filters: {
    readonly search?: string;
    readonly status?: SalesOrderStatus;
  };
  readonly canManage: boolean;
}

export function SalesOrdersView({
  result,
  filters,
  canManage,
}: SalesOrdersViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const withOrg = (path: string): string => {
    const org = searchParams.get("org");
    return org ? `${path}?org=${org}` : path;
  };

  const detailHref = (id: string): string => withOrg(`/sales/orders/${id}`);
  const newHref = (): string => withOrg("/sales/orders/new");

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
    router.push(query ? `/sales/orders?${query}` : "/sales/orders");
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
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Sales orders"
        description="Manage confirmed customer orders"
        icon={TrendingUp}
      >
        {canManage && (
          <Button asChild>
            <Link href={newHref()}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New sales order
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Sub-navigation */}
      <nav
        aria-label="Sales sections"
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        <Link
          href={withOrg("/sales/quotations")}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-primary-600"
        >
          Quotations
        </Link>
        <Link
          href={withOrg("/sales/invoices")}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-primary-600"
        >
          Invoices
        </Link>
      </nav>

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
            aria-label="Search sales orders"
            placeholder="Search by SO number or customer"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </form>
        <select
          aria-label="Filter by status"
          value={filters.status ?? ""}
          onChange={handleStatusChange}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            icon={TrendingUp}
            title="No sales orders found"
            description={
              filters.search || filters.status
                ? "No sales orders match your current filters. Try adjusting your search."
                : "Create your first sales order to confirm customer purchases."
            }
            action={
              canManage
                ? {
                    label: "New sales order",
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
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      SO number
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Order date
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Delivery date
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((so: SalesOrderListItem) => (
                    <tr
                      key={so.id}
                      onClick={() => router.push(detailHref(so.id))}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">
                        <Link
                          href={detailHref(so.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-primary-600 hover:underline"
                        >
                          {so.soNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {so.customerName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={SO_STATUS_VARIANT[so.status]}>
                          {SO_STATUS_LABEL[so.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(so.orderDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(so.deliveryDate)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                        {formatCurrency(so.totalAmount)}
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
            {total} {total === 1 ? "sales order" : "sales orders"} · Page{" "}
            {page} of {totalPages}
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
    </div>
  );
}
