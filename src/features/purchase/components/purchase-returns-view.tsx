"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Undo2,
  Wallet,
  FileEdit,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import { EmptyState } from "@/components/shared/empty-state";
import { StatTile } from "@/components/shared/stat-tile";
import { StatusBadge } from "@/components/shared/status-badge";
import { PRET_STATUS } from "@/features/purchase/utils/purchase-return-display";
import { formatCurrency, formatDate } from "@/utils/format";
import type {
  PurchaseReturnListItem,
  PurchaseReturnListResult,
  PurchaseReturnStats,
  PurchaseReturnStatus,
} from "@/features/purchase/types/purchase-return.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

const STATUS_FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface PurchaseReturnsViewProps {
  readonly organizationId: string;
  readonly result: PurchaseReturnListResult;
  readonly stats: PurchaseReturnStats;
  readonly filters: {
    readonly search?: string;
    readonly status?: PurchaseReturnStatus;
  };
  readonly canManage: boolean;
}

export function PurchaseReturnsView({
  result,
  stats,
  filters,
  canManage,
}: PurchaseReturnsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);
  const hasFilters = Boolean(filters.search || filters.status);
  const org = searchParams.get("org");

  const withOrg = (path: string): string =>
    org ? `${path}${path.includes("?") ? "&" : "?"}org=${org}` : path;

  const detailHref = (id: string): string =>
    withOrg(`/purchases/returns/${id}`);
  const newHref = (): string => withOrg("/purchases/returns/new");

  const subNavLinks: readonly { label: string; href: string }[] = [
    { label: "Purchase orders", href: withOrg("/purchases") },
    { label: "Goods receipts", href: withOrg("/purchases/goods-receipts") },
    { label: "Bills", href: withOrg("/bills") },
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
    router.push(query ? `/purchases/returns?${query}` : "/purchases/returns");
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
            <Undo2 className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Purchase returns
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {total}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Return goods to suppliers and reconcile stock
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="gradient">
              <Link href={newHref()}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                New purchase return
              </Link>
            </Button>
          </div>
        )}
      </motion.div>

      {/* Sub-navigation */}
      <nav
        aria-label="Purchases sections"
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        {subNavLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-primary-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-primary-400"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="Total value"
          value={stats.totalValue}
          tint="bg-gradient-brand"
          index={0}
          currency
        />
        <StatTile
          icon={FileEdit}
          label="Draft"
          value={stats.draft}
          tint="bg-gradient-violet"
          index={1}
        />
        <StatTile
          icon={CheckCircle2}
          label="Completed"
          value={stats.completed}
          tint="bg-gradient-success"
          index={2}
        />
        <StatTile
          icon={XCircle}
          label="Cancelled"
          value={stats.cancelled}
          tint="bg-gradient-info"
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
            aria-label="Search purchase returns"
            placeholder="Search by return number…"
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
            icon={Undo2}
            title={hasFilters ? "No matching purchase returns" : "No purchase returns yet"}
            description={
              hasFilters
                ? "No purchase returns match your current filters. Try adjusting your search or clearing the filters."
                : "Create your first purchase return to send goods back to a supplier."
            }
            action={
              hasFilters
                ? {
                    label: "Clear filters",
                    onClick: () => router.push(withOrg("/purchases/returns")),
                  }
                : canManage
                  ? {
                      label: "New purchase return",
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
                  <TableHead>Return #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Return date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((entry: PurchaseReturnListItem) => (
                  <TableRow
                    key={entry.id}
                    onClick={() => router.push(detailHref(entry.id))}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <Link
                        href={detailHref(entry.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-xs font-medium text-slate-700 hover:text-primary-600 hover:underline dark:text-slate-300 dark:hover:text-primary-400"
                      >
                        {entry.returnNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-300">
                      {entry.supplierName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge {...PRET_STATUS[entry.status]} />
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {formatDate(entry.returnDate)}
                    </TableCell>
                    <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(entry.totalAmount, true)}
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
