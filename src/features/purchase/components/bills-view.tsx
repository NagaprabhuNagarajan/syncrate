"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileText,
  Wallet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ArrowUpRight,
  Pencil,
  Banknote,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { StatTile } from "@/components/shared/stat-tile";
import { RecordSupplierPaymentDialog } from "@/features/payment/components/record-supplier-payment-dialog";
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
  readonly canMakePayment: boolean;
}

export function BillsView({
  organizationId,
  result,
  stats,
  filters,
  canManage,
  canMakePayment,
}: BillsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [showPayment, setShowPayment] = useState(false);

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

  const detailHref = (id: string): string => withOrg(`/bills/${id}`);
  const newHref = (): string => withOrg("/bills/new");

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
    router.push(query ? `/bills?${query}` : "/bills");
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

  const editHref = (id: string): string => withOrg(`/bills/${id}/edit`);

  // ── Bulk selection ─────────────────────────────────────────
  // A bill is payable only once posted and while it still carries a balance.
  const isSelectable = (bill: BillListItem): boolean =>
    bill.status === "posted" &&
    deriveBillPaymentStatus(bill) !== "paid" &&
    bill.totalAmount - bill.amountPaid > 0;

  const selectableItems = items.filter(isSelectable);
  const selectedBills = items.filter((bill) => selectedIds.has(bill.id));
  const selectedCount = selectedBills.length;

  const allSelectableSelected =
    selectableItems.length > 0 &&
    selectableItems.every((bill) => selectedIds.has(bill.id));

  const headerChecked: boolean | "indeterminate" = allSelectableSelected
    ? true
    : selectedCount > 0
      ? "indeterminate"
      : false;

  const toggleRow = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = (): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (
        selectableItems.length > 0 &&
        selectableItems.every((bill) => prev.has(bill.id))
      ) {
        selectableItems.forEach((bill) => next.delete(bill.id));
      } else {
        selectableItems.forEach((bill) => next.add(bill.id));
      }
      return next;
    });
  };

  const clearSelection = (): void => setSelectedIds(new Set());

  // A payment settles bills for a single supplier, so the selection must not span more.
  const selectedSupplierIds = new Set(
    selectedBills.map((bill) => bill.supplierId)
  );
  const isSingleSupplier = selectedSupplierIds.size === 1;
  const bulkOutstanding = selectedBills.reduce(
    (sum, bill) => sum + (bill.totalAmount - bill.amountPaid),
    0
  );
  const paymentSupplier = selectedBills[0];

  const openPayment = (): void => {
    if (isSingleSupplier && selectedCount > 0) {
      setShowPayment(true);
    }
  };

  const closePayment = (): void => setShowPayment(false);

  const handlePaymentDone = (): void => {
    setShowPayment(false);
    clearSelection();
    router.refresh();
  };

  const showSelection = canMakePayment;

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

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="Total billed"
          value={stats.totalBilled}
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

      {/* Bulk action bar */}
      {showSelection && selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="sticky top-2 z-30 mt-4 flex flex-col gap-3 rounded-xl border border-primary-200 bg-primary-50/80 px-4 py-3 shadow-card backdrop-blur sm:flex-row sm:items-center sm:justify-between dark:border-primary-500/30 dark:bg-primary-500/10"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {selectedCount} selected ·{" "}
              <span className="nums">
                {formatCurrency(bulkOutstanding, true)}
              </span>{" "}
              outstanding
            </span>
            {!isSingleSupplier && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Select bills from a single supplier to record one payment
                together.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSelection}
            >
              <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Clear
            </Button>
            <Button
              type="button"
              variant="gradient"
              size="sm"
              onClick={openPayment}
              disabled={!isSingleSupplier}
            >
              <Banknote className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Record payment
            </Button>
          </div>
        </motion.div>
      )}

      {/* Table / empty state */}
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={hasFilters ? "No matching bills" : "No bills yet"}
            description={
              hasFilters
                ? "No bills match your current filters. Try adjusting your search or clearing the filters."
                : "Record your first bill to track what you owe your suppliers."
            }
            action={
              hasFilters
                ? {
                    label: "Clear filters",
                    onClick: () => router.push(withOrg("/bills")),
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
                  {showSelection && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={headerChecked}
                        onCheckedChange={toggleAll}
                        disabled={selectableItems.length === 0}
                        aria-label="Select all payable bills"
                      />
                    </TableHead>
                  )}
                  <TableHead>Bill #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total / Due</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((invoice: BillListItem) => {
                  const selectable = isSelectable(invoice);
                  return (
                  <TableRow
                    key={invoice.id}
                    onClick={() => router.push(detailHref(invoice.id))}
                    className="group cursor-pointer"
                    data-state={
                      selectedIds.has(invoice.id) ? "selected" : undefined
                    }
                  >
                    {showSelection && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {selectable ? (
                          <Checkbox
                            checked={selectedIds.has(invoice.id)}
                            onCheckedChange={() => toggleRow(invoice.id)}
                            aria-label={`Select ${invoice.invoiceNumber}`}
                          />
                        ) : (
                          <span className="sr-only">Not payable</span>
                        )}
                      </TableCell>
                    )}
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
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {formatDate(invoice.invoiceDate)}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
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
                    <TableCell className="text-right">
                      <div className="nums font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(invoice.totalAmount, true)}
                      </div>
                      {invoice.totalAmount - invoice.amountPaid > 0 && (
                        <div className="nums text-[11px] text-amber-600 dark:text-amber-400">
                          Due{" "}
                          {formatCurrency(
                            invoice.totalAmount - invoice.amountPaid,
                            true
                          )}
                        </div>
                      )}
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

      {showPayment && paymentSupplier && (
        <RecordSupplierPaymentDialog
          organizationId={organizationId}
          supplierId={paymentSupplier.supplierId}
          supplierName={paymentSupplier.supplierName ?? "Supplier"}
          outstandingInvoices={selectedBills.map((bill) => ({
            id: bill.id,
            invoiceNumber: bill.invoiceNumber,
            invoiceDate: bill.invoiceDate.toISOString(),
            totalAmount: bill.totalAmount,
            amountPaid: bill.amountPaid,
            outstandingAmount: bill.totalAmount - bill.amountPaid,
          }))}
          preselectedInvoiceIds={selectedBills.map((bill) => bill.id)}
          onClose={closePayment}
          onDone={handlePaymentDone}
        />
      )}
    </div>
  );
}
