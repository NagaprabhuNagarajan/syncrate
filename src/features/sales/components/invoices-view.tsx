"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileText,
  Wallet,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ArrowUpRight,
  Pencil,
  Share2,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
import { AnimatedNumber } from "@/components/shared/animated-number";
import { formatCurrency, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";
import type {
  InvoiceListItem,
  InvoiceListResult,
  InvoiceStats,
  InvoiceStatus,
  PaymentStatus,
} from "@/features/sales/types/invoice.types";

// ─────────────────────────────────────────────────────────────
// Status presentation
//
// These maps are imported by 5 other files (marketplace-orders,
// invoice-detail, sales-order-detail, dashboard-analytics). Keep them
// exported from this module — do not move them.
// ─────────────────────────────────────────────────────────────

export const INV_STATUS_VARIANT: Record<InvoiceStatus, BadgeProps["variant"]> =
  {
    draft: "muted",
    posted: "success",
    cancelled: "destructive",
  };

export const INV_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_VARIANT: Record<
  PaymentStatus,
  BadgeProps["variant"]
> = {
  unpaid: "warning",
  partial: "info",
  paid: "success",
  overdue: "destructive",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
};

// ─────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────

const STATUS_FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "draft", label: INV_STATUS_LABEL.draft },
  { value: "posted", label: INV_STATUS_LABEL.posted },
  { value: "cancelled", label: INV_STATUS_LABEL.cancelled },
];

const PAYMENT_FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "unpaid", label: PAYMENT_STATUS_LABEL.unpaid },
  { value: "partial", label: PAYMENT_STATUS_LABEL.partial },
  { value: "paid", label: PAYMENT_STATUS_LABEL.paid },
  { value: "overdue", label: PAYMENT_STATUS_LABEL.overdue },
];

// ─────────────────────────────────────────────────────────────
// Stat tile
// ─────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  tint,
  index,
  currency,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: number;
  readonly tint: string;
  readonly index: number;
  readonly currency?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Card className="relative overflow-hidden p-4">
        <div
          className={cn(
            "absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl",
            tint
          )}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm",
              tint
            )}
          >
            <Icon className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {currency ? (
                formatCurrency(value)
              ) : (
                <AnimatedNumber value={value} />
              )}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

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
    <div className="flex flex-wrap items-center gap-1.5">
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface InvoicesViewProps {
  readonly organizationId: string;
  readonly result: InvoiceListResult;
  readonly stats: InvoiceStats;
  readonly filters: {
    readonly search?: string;
    readonly status?: InvoiceStatus;
    readonly paymentStatus?: PaymentStatus;
  };
  readonly canManage: boolean;
}

export function InvoicesView({
  result,
  stats,
  filters,
  canManage,
}: InvoicesViewProps) {
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

  const detailHref = (id: string): string => withOrg(`/invoices/${id}`);
  const editHref = (id: string): string => withOrg(`/invoices/${id}/edit`);
  const shareHref = (id: string): string => withOrg(`/invoices/${id}/share`);
  const newHref = (): string => withOrg("/invoices/new");

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
    router.push(query ? `/invoices?${query}` : "/invoices");
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

  const handleClearFilters = (): void => {
    router.push(withOrg("/invoices"));
  };

  const handleNew = (): void => {
    router.push(newHref());
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
              Invoices
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {total}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Create, send and track your customer invoices
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="gradient">
              <Link href={newHref()}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                New invoice
              </Link>
            </Button>
          </div>
        )}
      </motion.div>

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="Total invoiced"
          value={stats.totalInvoiced}
          tint="bg-gradient-brand"
          index={0}
          currency
        />
        <StatTile
          icon={Clock}
          label="Outstanding"
          value={stats.outstanding}
          tint="bg-gradient-info"
          index={1}
          currency
        />
        <StatTile
          icon={AlertTriangle}
          label="Overdue"
          value={stats.overdue}
          tint="bg-gradient-warning"
          index={2}
          currency
        />
        <StatTile
          icon={CheckCircle2}
          label="Paid"
          value={stats.paid}
          tint="bg-gradient-success"
          index={3}
          currency
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
            aria-label="Search invoices"
            placeholder="Search by invoice number…"
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
            title={hasFilters ? "No matching invoices" : "No invoices yet"}
            description={
              hasFilters
                ? "No invoices match your current filters. Try adjusting your search or clearing the filters."
                : "Create your first invoice to start billing your customers."
            }
            action={
              hasFilters
                ? { label: "Clear filters", onClick: handleClearFilters }
                : canManage
                  ? { label: "New invoice", icon: Plus, onClick: handleNew }
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
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((invoice: InvoiceListItem) => {
                  const isOverdue = invoice.paymentStatus === "overdue";
                  return (
                    <TableRow
                      key={invoice.id}
                      onClick={() => router.push(detailHref(invoice.id))}
                      className="group cursor-pointer"
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
                        {invoice.customerName ?? "—"}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {formatDate(invoice.invoiceDate)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          isOverdue
                            ? "font-medium text-error-600 dark:text-error-400"
                            : "text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge dot variant={INV_STATUS_VARIANT[invoice.status]}>
                          {INV_STATUS_LABEL[invoice.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          dot
                          variant={PAYMENT_STATUS_VARIANT[invoice.paymentStatus]}
                        >
                          {PAYMENT_STATUS_LABEL[invoice.paymentStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(invoice.totalAmount, true)}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${invoice.invoiceNumber}`}
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
                              <Link href={detailHref(invoice.id)}>
                                <ArrowUpRight
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                View
                              </Link>
                            </DropdownMenuItem>
                            {canManage && invoice.status === "draft" && (
                              <DropdownMenuItem asChild>
                                <Link href={editHref(invoice.id)}>
                                  <Pencil
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={shareHref(invoice.id)}>
                                <Share2
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                Share
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
              aria-label="Previous page"
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
