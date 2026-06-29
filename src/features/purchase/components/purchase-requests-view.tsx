"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ClipboardList,
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
  PurchaseRequestListItem,
  PurchaseRequestListResult,
  PurchaseRequestStatus,
} from "@/features/purchase/types/purchase-request.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
// ─────────────────────────────────────────────────────────────

export const PR_STATUS_VARIANT: Record<
  PurchaseRequestStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  submitted: "info",
  approved: "success",
  rejected: "destructive",
  converted: "success",
  cancelled: "destructive",
};

export const PR_STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
  cancelled: "Cancelled",
};

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "converted", label: "Converted" },
  { value: "cancelled", label: "Cancelled" },
];

function formatDate(value: Date | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface PurchaseRequestsViewProps {
  readonly organizationId: string;
  readonly result: PurchaseRequestListResult;
  readonly filters: {
    readonly search?: string;
    readonly status?: PurchaseRequestStatus;
  };
  readonly canManage: boolean;
}

export function PurchaseRequestsView({
  result,
  filters,
  canManage,
}: PurchaseRequestsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const withOrg = (path: string): string => {
    const org = searchParams.get("org");
    return org ? `${path}?org=${org}` : path;
  };

  const detailHref = (id: string): string =>
    withOrg(`/purchases/requests/${id}`);
  const newHref = (): string => withOrg("/purchases/requests/new");

  const subNavLinks: readonly { label: string; href: string }[] = [
    { label: "Purchase orders", href: withOrg("/purchases") },
    { label: "Goods receipts", href: withOrg("/purchases/goods-receipts") },
    { label: "Invoices", href: withOrg("/purchases/invoices") },
    { label: "Returns", href: withOrg("/purchases/returns") },
  ];

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
    router.push(query ? `/purchases/requests?${query}` : "/purchases/requests");
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
        title="Purchase requests"
        description="Raise and track internal requisitions before ordering"
        icon={ClipboardList}
      >
        {canManage && (
          <Button asChild>
            <Link href={newHref()}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New request
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Sub-navigation */}
      <nav
        aria-label="Purchases sections"
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        {subNavLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-primary-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700"
          >
            {link.label}
          </Link>
        ))}
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
            aria-label="Search purchase requests"
            placeholder="Search by request number"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:hover:border-slate-600"
          />
        </form>
        <select
          aria-label="Filter by status"
          value={filters.status ?? ""}
          onChange={handleStatusChange}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"
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
            icon={ClipboardList}
            title="No purchase requests found"
            description={
              filters.search || filters.status
                ? "No purchase requests match your current filters. Try adjusting your search."
                : "Raise your first purchase request to start the procurement workflow."
            }
            action={
              canManage
                ? {
                    label: "New request",
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
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Request number
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Warehouse
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Required by
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((request: PurchaseRequestListItem) => (
                    <tr
                      key={request.id}
                      onClick={() => router.push(detailHref(request.id))}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                        <Link
                          href={detailHref(request.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-primary-600 hover:underline"
                        >
                          {request.requestNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {request.warehouseName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={PR_STATUS_VARIANT[request.status]}>
                          {PR_STATUS_LABEL[request.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(request.requiredDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(request.createdAt)}
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
            {total} {total === 1 ? "purchase request" : "purchase requests"} ·
            Page {page} of {totalPages}
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
