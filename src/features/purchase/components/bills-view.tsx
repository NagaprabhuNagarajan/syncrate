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
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import type {
  PurchaseInvoiceListItem,
  PurchaseInvoiceListResult,
  PurchaseInvoiceStatus,
} from "@/features/purchase/types/purchase-invoice.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
// ─────────────────────────────────────────────────────────────

export const PINV_STATUS_VARIANT: Record<
  PurchaseInvoiceStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  posted: "success",
  cancelled: "destructive",
};

export const PINV_STATUS_LABEL: Record<PurchaseInvoiceStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  cancelled: "Cancelled",
};

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
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

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface PurchaseInvoicesViewProps {
  readonly organizationId: string;
  readonly result: PurchaseInvoiceListResult;
  readonly filters: {
    readonly search?: string;
    readonly status?: PurchaseInvoiceStatus;
  };
  readonly canManage: boolean;
}

export function PurchaseInvoicesView({
  result,
  filters,
  canManage,
}: PurchaseInvoicesViewProps) {
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
    withOrg(`/purchases/invoices/${id}`);
  const newHref = (): string => withOrg("/purchases/invoices/new");

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
    router.push(query ? `/purchases/invoices?${query}` : "/purchases/invoices");
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
        title="Purchase invoices"
        description="Record and post supplier bills against your business"
        icon={FileText}
      >
        {canManage && (
          <Button asChild variant="gradient">
            <Link href={newHref()}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              New purchase invoice
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
            aria-label="Search purchase invoices"
            placeholder="Search by invoice number"
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
            icon={FileText}
            title="No purchase invoices found"
            description={
              filters.search || filters.status
                ? "No purchase invoices match your current filters. Try adjusting your search."
                : "Record your first purchase invoice to track what you owe your suppliers."
            }
            action={
              canManage
                ? {
                    label: "New purchase invoice",
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
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Invoice number
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Supplier
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Invoice date
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((invoice: PurchaseInvoiceListItem) => (
                    <tr
                      key={invoice.id}
                      onClick={() => router.push(detailHref(invoice.id))}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-2 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                        <Link
                          href={detailHref(invoice.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-primary-600 hover:underline dark:hover:text-primary-400"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        {invoice.supplierName ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge dot variant={PINV_STATUS_VARIANT[invoice.status]}>
                          {PINV_STATUS_LABEL[invoice.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {formatDate(invoice.invoiceDate)}
                      </td>
                      <td className="nums px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(invoice.totalAmount)}
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
            {total} {total === 1 ? "purchase invoice" : "purchase invoices"} ·
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
