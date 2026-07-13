"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileText,
  Wallet,
  FileEdit,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
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
import { EmptyState } from "@/components/shared/empty-state";
import { StatTile } from "@/components/shared/stat-tile";
import {
  BILL_STATUS_LABEL,
  BILL_STATUS_VARIANT,
  BILL_PAYMENT_STATUS_LABEL,
  BILL_PAYMENT_STATUS_VARIANT,
  deriveBillPaymentStatus,
} from "@/features/purchase/utils/bill-display";
import { formatCurrency, formatDate } from "@/utils/format";
import type {
  BillListItem,
  BillListResult,
  BillPaymentStatusFilter,
  BillStats,
  BillStatus,
} from "@/features/purchase/types/bill.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

const STATUS_FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "draft", label: BILL_STATUS_LABEL.draft },
  { value: "posted", label: BILL_STATUS_LABEL.posted },
  { value: "cancelled", label: BILL_STATUS_LABEL.cancelled },
];

const PAYMENT_FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "unpaid", label: BILL_PAYMENT_STATUS_LABEL.unpaid },
  { value: "partial", label: BILL_PAYMENT_STATUS_LABEL.partial },
  { value: "paid", label: BILL_PAYMENT_STATUS_LABEL.paid },
  { value: "overdue", label: BILL_PAYMENT_STATUS_LABEL.overdue },
];

// ─────────────────────────────────────────────────────────────
// Filter pill row
// ─────────────────────────────────────────────────────────────

function FilterPills({
  label,
  options,
  active,
  onSelect,
}: {
  readonly label: string;
  readonly options: readonly { value: string; label: string }[];
  readonly active: string;
  readonly onSelect: (value: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="tablist"
      aria-label={`Filter by ${label.toLowerCase()}`}
    >
      {options.map((option) => {
        const isActive = active === option.value;
        return (
          <button
            key={option.value || "all"}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(option.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "border-transparent bg-gradient-brand text-white shadow-glow-primary"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface BillsViewProps {
  readonly organizationId: string;
  readonly result: BillListResult;
  readonly stats: BillStats;
  readonly filters: {
    readonly search?: string;
    readonly status?: BillStatus;
    readonly paymentStatus?: BillPaymentStatusFilter;
  };
  readonly canManage: boolean;
}

export function BillsView({
  result,
  stats,
  filters,
  canManage,
}: BillsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);
  const hasFilters = Boolean(
    filters.search || filters.status || filters.paymentStatus
  );
  const org = searchParams.get("org");

  const withOrg = (path: string): string =>
    org ? `${path}${path.includes("?") ? "&" : "?"}org=${org}` : path;

  const detailHref = (id: string): string =>
    withOrg(`/purchases/bills/${id}`);
  const newHref = (): string => withOrg("/purchases/bills/new");

  const subNavLinks: readonly { label: string; href: string }[] = [
    { label: "Purchase orders", href: withOrg("/purchases") },
    { label: "Goods receipts", href: withOrg("/purchases/goods-receipts") },
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
    router.push(
      query ? `/purchases/bills?${query}` : "/purchases/bills"
    );
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

  const handleStatusSelect = (value: string): void => {
    pushWith({ status: value || undefined, page: undefined });
  };

  const handlePaymentSelect = (value: string): void => {
    pushWith({ paymentStatus: value || undefined, page: undefined });
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
            <FileText className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Bills
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {total}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Record and post supplier bills against your business
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="gradient">
              <Link href={newHref()}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                New bill
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
          label="Posted"
          value={stats.posted}
          tint="bg-gradient-success"
          index={2}
        />
        <StatTile
          icon={AlertTriangle}
          label="Overdue"
          value={stats.overdue}
          tint="bg-gradient-info"
          index={3}
        />
      </div>

      {/* Search + filter pills */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="relative w-full lg:max-w-sm lg:shrink-0"
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search bills"
            placeholder="Search by bill number…"
            value={searchInput}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </form>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
          <FilterPills
            label="Status"
            options={STATUS_FILTERS}
            active={filters.status ?? ""}
            onSelect={handleStatusSelect}
          />
          <div
            className="h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700"
            aria-hidden="true"
          />
          <FilterPills
            label="Payment"
            options={PAYMENT_FILTERS}
            active={filters.paymentStatus ?? ""}
            onSelect={handlePaymentSelect}
          />
        </div>
      </div>

      {/* Table / empty state */}
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={
              hasFilters ? "No matching bills" : "No bills yet"
            }
            description={
              hasFilters
                ? "No bills match your current filters. Try adjusting your search or clearing the filters."
                : "Record your first bill to track what you owe your suppliers."
            }
            action={
              hasFilters
                ? {
                    label: "Clear filters",
                    onClick: () => router.push(withOrg("/purchases/bills")),
                  }
                : canManage
                  ? {
                      label: "New bill",
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
                  <TableHead>Bill number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Bill date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((invoice: BillListItem) => (
                  <TableRow
                    key={invoice.id}
                    onClick={() => router.push(detailHref(invoice.id))}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <Link
                        href={detailHref(invoice.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-xs font-medium text-slate-700 hover:text-primary-600 hover:underline dark:text-slate-300 dark:hover:text-primary-400"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-300">
                      {invoice.supplierName ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge dot variant={BILL_STATUS_VARIANT[invoice.status]}>
                        {BILL_STATUS_LABEL[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        dot
                        variant={
                          BILL_PAYMENT_STATUS_VARIANT[
                            deriveBillPaymentStatus(invoice)
                          ]
                        }
                      >
                        {
                          BILL_PAYMENT_STATUS_LABEL[
                            deriveBillPaymentStatus(invoice)
                          ]
                        }
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {formatDate(invoice.invoiceDate)}
                    </TableCell>
                    <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(invoice.totalAmount, true)}
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
