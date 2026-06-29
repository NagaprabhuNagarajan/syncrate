"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { exportCustomersAction } from "@/features/customer/actions/customer.actions";
import { CustomerImportDialog } from "@/features/customer/components/customer-import-dialog";
import type {
  Customer,
  CustomerListResult,
  CustomerStatus,
} from "@/features/customer/types/customer.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
// ─────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<CustomerStatus, BadgeProps["variant"]> = {
  active: "success",
  inactive: "muted",
  blacklisted: "destructive",
  archived: "secondary",
};

const STATUS_LABEL: Record<CustomerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
  archived: "Archived",
};

const STATUS_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" },
  { value: "archived", label: "Archived" },
];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface CustomersViewProps {
  readonly organizationId: string;
  readonly result: CustomerListResult;
  readonly filters: {
    readonly search?: string;
    readonly status?: CustomerStatus;
  };
  readonly canManage: boolean;
}

export function CustomersView({
  organizationId,
  result,
  filters,
  canManage,
}: CustomersViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [importOpen, setImportOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, startExport] = useTransition();

  const handleExport = (): void => {
    setExportError(null);
    startExport(async () => {
      const response = await exportCustomersAction(organizationId);
      if (!response.success) {
        setExportError(response.error.message);
        return;
      }
      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "customers.csv";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    });
  };

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Builds the customer detail href while preserving the active org param.
  const detailHref = (customerId: string): string => {
    const org = searchParams.get("org");
    return org
      ? `/customers/${customerId}?org=${org}`
      : `/customers/${customerId}`;
  };

  const newHref = (): string => {
    const org = searchParams.get("org");
    return org ? `/customers/new?org=${org}` : "/customers/new";
  };

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
    router.push(query ? `/customers?${query}` : "/customers");
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
        title="Customers"
        description="Manage your customers and their commercial details"
        icon={Users}
      >
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              loading={isExporting}
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Export
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Import
            </Button>
            <Button asChild>
              <Link href={newHref()}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Add customer
              </Link>
            </Button>
          </div>
        )}
      </PageHeader>

      {exportError && (
        <p
          role="alert"
          className="text-error-700 bg-error-50 border-error-200 dark:text-error-300 dark:bg-error-500/10 dark:border-error-500/30 mt-4 rounded-lg border px-3 py-2.5 text-sm"
        >
          {exportError}
        </p>
      )}

      {importOpen && (
        <CustomerImportDialog
          organizationId={organizationId}
          onClose={() => setImportOpen(false)}
          onImported={() => router.refresh()}
        />
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
            aria-label="Search customers"
            placeholder="Search by name, code, company, mobile or GST"
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
            icon={Users}
            title="No customers found"
            description={
              filters.search || filters.status
                ? "No customers match your current filters. Try adjusting your search."
                : "Add your first customer to start managing relationships and outstanding balances."
            }
            action={
              canManage
                ? {
                    label: "Add customer",
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
                      Code
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Company
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Mobile
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      GST
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Credit limit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((customer: Customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => router.push(detailHref(customer.id))}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {customer.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <Link
                          href={detailHref(customer.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:text-primary-600 hover:underline dark:hover:text-primary-400"
                        >
                          {customer.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {customer.company ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {customer.mobile ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {customer.gstNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[customer.status]}>
                          {STATUS_LABEL[customer.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {formatCurrency(customer.creditLimit)}
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
            {total} {total === 1 ? "customer" : "customers"} · Page {page} of{" "}
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
    </div>
  );
}
