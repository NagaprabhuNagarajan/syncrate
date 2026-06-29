"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileText,
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
  QuotationListItem,
  QuotationListResult,
  QuotationStatus,
} from "@/features/sales/types/quotation.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
// ─────────────────────────────────────────────────────────────

export const QUOTATION_STATUS_VARIANT: Record<
  QuotationStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  sent: "info",
  viewed: "info",
  accepted: "success",
  rejected: "destructive",
  expired: "warning",
  converted: "success",
};

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  converted: "Converted",
};

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "converted", label: "Converted" },
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

interface QuotationsViewProps {
  readonly organizationId: string;
  readonly result: QuotationListResult;
  readonly filters: {
    readonly search?: string;
    readonly status?: QuotationStatus;
  };
  readonly canManage: boolean;
}

export function QuotationsView({
  result,
  filters,
  canManage,
}: QuotationsViewProps) {
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
    withOrg(`/sales/quotations/${id}`);
  const newHref = (): string => withOrg("/sales/quotations/new");

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
    router.push(query ? `/sales/quotations?${query}` : "/sales/quotations");
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
        title="Quotations"
        description="Create and manage customer quotations"
        icon={FileText}
      >
        {canManage && (
          <Button asChild>
            <Link href={newHref()}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New quotation
            </Link>
          </Button>
        )}
      </PageHeader>

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
            aria-label="Search quotations"
            placeholder="Search by quotation number or customer"
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
            icon={FileText}
            title="No quotations found"
            description={
              filters.search || filters.status
                ? "No quotations match your current filters. Try adjusting your search."
                : "Create your first quotation to start sending proposals to customers."
            }
            action={
              canManage
                ? {
                    label: "New quotation",
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
            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Quotation no.
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Date
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Expiry
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((quotation: QuotationListItem) => (
                    <tr
                      key={quotation.id}
                      onClick={() => router.push(detailHref(quotation.id))}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                        <Link
                          href={detailHref(quotation.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                        >
                          {quotation.quotationNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {quotation.customerName ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            QUOTATION_STATUS_VARIANT[quotation.status]
                          }
                        >
                          {QUOTATION_STATUS_LABEL[quotation.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(quotation.quotationDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(quotation.expiryDate)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(quotation.totalAmount)}
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
            {total} {total === 1 ? "quotation" : "quotations"} · Page {page}{" "}
            of {totalPages}
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
