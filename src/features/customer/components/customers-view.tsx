"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  UserCheck,
  UserPlus,
  Ban,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  MoreHorizontal,
  Pencil,
  Copy,
  ArrowUpRight,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { StatTile } from "@/components/shared/stat-tile";
import {
  exportCustomersAction,
  archiveCustomerAction,
  restoreCustomerAction,
} from "@/features/customer/actions/customer.actions";
import { CustomerImportDialog } from "@/features/customer/components/customer-import-dialog";
import {
  STATUS_LABEL,
  STATUS_VARIANT,
} from "@/features/customer/utils/customer-display";
import { formatCurrency } from "@/utils/format";
import type {
  Customer,
  CustomerListResult,
  CustomerStats,
  CustomerStatus,
} from "@/features/customer/types/customer.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

const STATUS_FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" },
  { value: "archived", label: "Archived" },
];

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface CustomersViewProps {
  readonly organizationId: string;
  readonly result: CustomerListResult;
  readonly stats: CustomerStats;
  readonly filters: {
    readonly search?: string;
    readonly status?: CustomerStatus;
  };
  readonly canManage: boolean;
}

export function CustomersView({
  organizationId,
  result,
  stats,
  filters,
  canManage,
}: CustomersViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [importOpen, setImportOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, startExport] = useTransition();

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);
  const hasFilters = Boolean(filters.search || filters.status);
  const org = searchParams.get("org");

  const withOrg = (path: string): string =>
    org ? `${path}${path.includes("?") ? "&" : "?"}org=${org}` : path;

  const detailHref = (id: string): string => withOrg(`/customers/${id}`);
  const editHref = (id: string): string => withOrg(`/customers/${id}/edit`);
  const newHref = (): string => withOrg("/customers/new");

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

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushWith({ search: searchInput.trim() || undefined, page: undefined });
  };

  const handleSearchChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const value = event.target.value;
    setSearchInput(value);
    // Clearing the field (native ✕ or deleting the text) resets the list
    // immediately, without waiting for a submit.
    if (value === "" && filters.search) {
      pushWith({ search: undefined, page: undefined });
    }
  };

  const copyToClipboard = (text: string): void => {
    void navigator.clipboard?.writeText(text);
  };

  const [actionError, setActionError] = useState<string | null>(null);
  const [, startAction] = useTransition();

  const handleArchive = (customerId: string): void => {
    setActionError(null);
    startAction(async () => {
      const res = await archiveCustomerAction(organizationId, customerId);
      if (!res.success) {
        setActionError(res.error.message);
        return;
      }
      router.refresh();
    });
  };

  const handleRestore = (customerId: string): void => {
    setActionError(null);
    startAction(async () => {
      const res = await restoreCustomerAction(organizationId, customerId);
      if (!res.success) {
        setActionError(res.error.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
            <Users className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Customers
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {stats.total}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage your customers and their commercial details
            </p>
          </div>
        </div>

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
            <Button asChild variant="gradient">
              <Link href={newHref()}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Add customer
              </Link>
            </Button>
          </div>
        )}
      </motion.div>

      {(exportError || actionError) && (
        <p
          role="alert"
          className="text-error-700 bg-error-50 border-error-200 dark:text-error-300 dark:bg-error-500/10 dark:border-error-500/30 mt-4 rounded-lg border px-3 py-2.5 text-sm"
        >
          {exportError ?? actionError}
        </p>
      )}

      {importOpen && (
        <CustomerImportDialog
          organizationId={organizationId}
          onClose={() => setImportOpen(false)}
          onImported={() => router.refresh()}
        />
      )}

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Total"
          value={stats.total}
          tint="bg-gradient-brand"
          index={0}
        />
        <StatTile
          icon={UserCheck}
          label="Active"
          value={stats.active}
          tint="bg-gradient-success"
          index={1}
        />
        <StatTile
          icon={UserPlus}
          label="New this month"
          value={stats.newThisMonth}
          tint="bg-gradient-info"
          index={2}
        />
        <StatTile
          icon={Ban}
          label="Blacklisted"
          value={stats.blacklisted}
          tint="bg-gradient-error"
          index={3}
        />
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="relative w-full lg:max-w-sm"
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search customers"
            placeholder="Search name, code, company, mobile…"
            value={searchInput}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </form>

        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((option) => {
            const active = (filters.status ?? "") === option.value;
            return (
              <button
                key={option.value || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  pushWith({
                    status: option.value || undefined,
                    page: undefined,
                  })
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-transparent bg-gradient-brand text-white shadow-glow-primary"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table / empty state */}
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? "No matching customers" : "No customers yet"}
            description={
              hasFilters
                ? "No customers match your current filters. Try adjusting your search or clearing the filters."
                : "Add your first customer to start managing relationships and outstanding balances."
            }
            action={
              hasFilters
                ? {
                    label: "Clear filters",
                    onClick: () => router.push(withOrg("/customers")),
                  }
                : canManage
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
          >
            <Table wrapperClassName="shadow-card">
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Credit limit</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((customer: Customer) => (
                  <TableRow
                    key={customer.id}
                    onClick={() => router.push(detailHref(customer.id))}
                    className="group cursor-pointer"
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <Link
                          href={detailHref(customer.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate font-medium text-slate-900 hover:text-primary-600 hover:underline dark:text-slate-100 dark:hover:text-primary-400"
                        >
                          {customer.name}
                        </Link>
                        <span className="block truncate font-mono text-xs text-slate-400 dark:text-slate-500">
                          {customer.code}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {customer.company ?? "—"}
                    </TableCell>
                    <TableCell>
                      {customer.mobile || customer.email ? (
                        <div className="min-w-0">
                          {customer.mobile && (
                            <span className="block truncate text-slate-700 dark:text-slate-300">
                              {customer.mobile}
                            </span>
                          )}
                          {customer.email && (
                            <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                              {customer.email}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge dot variant={STATUS_VARIANT[customer.status]}>
                        {STATUS_LABEL[customer.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="nums text-right font-medium text-slate-700 dark:text-slate-300">
                      {formatCurrency(customer.creditLimit)}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${customer.name}`}
                            className="rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                          >
                            <MoreHorizontal
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={detailHref(customer.id)}>
                              <ArrowUpRight
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              Open
                            </Link>
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem asChild>
                              <Link href={editHref(customer.id)}>
                                <Pencil
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => copyToClipboard(customer.code)}
                          >
                            <Copy className="h-4 w-4" aria-hidden="true" />
                            Copy code
                          </DropdownMenuItem>
                          {customer.email && (
                            <DropdownMenuItem
                              onSelect={() =>
                                copyToClipboard(customer.email ?? "")
                              }
                            >
                              <Copy className="h-4 w-4" aria-hidden="true" />
                              Copy email
                            </DropdownMenuItem>
                          )}
                          {canManage && (
                            <>
                              <DropdownMenuSeparator />
                              {customer.status === "archived" ? (
                                <DropdownMenuItem
                                  onSelect={() => handleRestore(customer.id)}
                                >
                                  <ArchiveRestore
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Unarchive
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  destructive
                                  onSelect={() => handleArchive(customer.id)}
                                >
                                  <Archive
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Archive
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      {items.length > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">{rangeStart}</span>–
            <span className="font-medium text-foreground">{rangeEnd}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() =>
                pushWith({ page: page <= 2 ? undefined : String(page - 1) })
              }
            >
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => pushWith({ page: String(page + 1) })}
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
