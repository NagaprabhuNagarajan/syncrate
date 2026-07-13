"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  IndianRupee,
  CreditCard,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Wallet,
  CalendarClock,
  CheckCircle2,
  Ban,
  MoreHorizontal,
  ArrowUpRight,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
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
import { RecordCustomerPaymentDialog } from "@/features/payment/components/record-customer-payment-dialog";
import { RecordSupplierPaymentDialog } from "@/features/payment/components/record-supplier-payment-dialog";
import { formatCurrency, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";
import type {
  CustomerPayment,
  CustomerPaymentListResult,
  PaymentMethod,
  PaymentStats,
  PaymentStatus,
  SupplierPayment,
  SupplierPaymentListResult,
} from "@/features/payment/types/payment.types";

// ─────────────────────────────────────────────────────────────
// Status / method presentation
// ─────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  wallet: "Wallet",
  other: "Other",
};

export const STATUS_VARIANT: Record<PaymentStatus, BadgeProps["variant"]> = {
  completed: "success",
  voided: "destructive",
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  completed: "Completed",
  voided: "Voided",
};

const STATUS_FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "completed", label: STATUS_LABEL.completed },
  { value: "voided", label: STATUS_LABEL.voided },
];

// ─────────────────────────────────────────────────────────────
// URL helpers
// ─────────────────────────────────────────────────────────────

/**
 * Patches the current query string, preserving every other param (including
 * `?org=` and the sibling tab's params), and returns the resulting URL.
 */
function patchQuery(patch: Record<string, string | undefined>): string {
  const params = new URLSearchParams(window.location.search);
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : window.location.pathname;
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
// Shared payment row view-model + table
// ─────────────────────────────────────────────────────────────

interface PaymentRow {
  readonly id: string;
  readonly paymentNumber: string;
  readonly partyName: string;
  readonly paymentDate: string;
  readonly paymentMethod: PaymentMethod;
  readonly amount: number;
  readonly status: PaymentStatus;
}

function detailHref(id: string, kind: "customer" | "supplier"): string {
  // Supplier payments live in a separate table, so the detail page needs the
  // kind to load the right record — without it, supplier ids 404.
  return kind === "supplier"
    ? `/payments/${id}?type=supplier`
    : `/payments/${id}`;
}

function PaymentsTable({
  rows,
  partyLabel,
  kind,
}: {
  readonly rows: readonly PaymentRow[];
  readonly partyLabel: string;
  readonly kind: "customer" | "supplier";
}) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Table wrapperClassName="shadow-card">
        <TableHeader>
          <TableRow>
            <TableHead>Payment #</TableHead>
            <TableHead>{partyLabel}</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => router.push(detailHref(row.id, kind))}
              className="group cursor-pointer"
            >
              <TableCell>
                <Link
                  href={detailHref(row.id, kind)}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-xs font-medium text-slate-700 hover:text-primary-600 hover:underline dark:text-slate-300 dark:hover:text-primary-400"
                >
                  {row.paymentNumber}
                </Link>
              </TableCell>
              <TableCell className="text-slate-700 dark:text-slate-300">
                {row.partyName}
              </TableCell>
              <TableCell className="text-slate-600 dark:text-slate-400">
                {formatDate(new Date(row.paymentDate))}
              </TableCell>
              <TableCell className="text-slate-600 dark:text-slate-400">
                {METHOD_LABELS[row.paymentMethod]}
              </TableCell>
              <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                {formatCurrency(row.amount, true)}
              </TableCell>
              <TableCell>
                <Badge dot variant={STATUS_VARIANT[row.status]}>
                  {STATUS_LABEL[row.status]}
                </Badge>
              </TableCell>
              <TableCell
                className="text-right"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Actions for ${row.paymentNumber}`}
                      className="rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={detailHref(row.id, kind)}>
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        View
                      </Link>
                    </DropdownMenuItem>
                    {row.status === "completed" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={detailHref(row.id, kind)}>
                            <Ban className="h-4 w-4" aria-hidden="true" />
                            Void
                          </Link>
                        </DropdownMenuItem>
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
  );
}

// ─────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  return (
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
          onClick={() => onPageChange(page - 1)}
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
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Customer Payments Tab
// ─────────────────────────────────────────────────────────────

interface CustomerPaymentsTabProps {
  readonly result: CustomerPaymentListResult;
  readonly stats: PaymentStats;
  readonly filters: {
    readonly search?: string;
    readonly status?: PaymentStatus;
  };
  readonly onRecordPayment: () => void;
}

function CustomerPaymentsTab({
  result,
  stats,
  filters,
  onRecordPayment,
}: CustomerPaymentsTabProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search ?? "");
  const [, startTransition] = useTransition();

  const hasFilters = Boolean(filters.search || filters.status);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    startTransition(() => {
      router.push(patchQuery({ cSearch: search.trim() || undefined, cPage: undefined }));
    });
  };

  const handleSearchChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const value = event.target.value;
    setSearch(value);
    if (value === "" && filters.search) {
      startTransition(() => {
        router.push(patchQuery({ cSearch: undefined, cPage: undefined }));
      });
    }
  };

  const handleStatusSelect = (value: string): void => {
    startTransition(() => {
      router.push(patchQuery({ cStatus: value || undefined, cPage: undefined }));
    });
  };

  const handlePageChange = (newPage: number): void => {
    startTransition(() => {
      router.push(patchQuery({ cPage: newPage <= 1 ? undefined : String(newPage) }));
    });
  };

  const handleClearFilters = (): void => {
    startTransition(() => {
      router.push(patchQuery({ cSearch: undefined, cStatus: undefined, cPage: undefined }));
    });
  };

  const rows: readonly PaymentRow[] = result.payments.map(
    (payment: CustomerPayment) => ({
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      partyName: payment.customerName ?? payment.customerId,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
      status: payment.status,
    })
  );

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="Total received"
          value={stats.totalAmount}
          tint="bg-gradient-brand"
          index={0}
          currency
        />
        <StatTile
          icon={CalendarClock}
          label="This month"
          value={stats.thisMonth}
          tint="bg-gradient-info"
          index={1}
          currency
        />
        <StatTile
          icon={CheckCircle2}
          label="Completed"
          value={stats.completed}
          tint="bg-gradient-success"
          index={2}
        />
        <StatTile
          icon={Ban}
          label="Voided"
          value={stats.voided}
          tint="bg-gradient-warning"
          index={3}
        />
      </div>

      {/* Search + filter pills */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={handleSearch} role="search" className="flex gap-2">
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by payment no., reference…"
              className="pl-9"
              aria-label="Search customer payments"
            />
          </div>
        </form>

        <FilterPills
          label="Status"
          options={STATUS_FILTERS}
          active={filters.status ?? ""}
          onSelect={handleStatusSelect}
        />
      </div>

      {/* Table / empty state */}
      {rows.length === 0 ? (
        <EmptyState
          icon={IndianRupee}
          title={hasFilters ? "No matching payments" : "No customer payments yet"}
          description={
            hasFilters
              ? "No customer payments match your current filters. Try adjusting your search or clearing the filters."
              : "Record your first customer payment to get started."
          }
          action={
            hasFilters
              ? { label: "Clear filters", onClick: handleClearFilters }
              : { label: "Record Payment", onClick: onRecordPayment, icon: Plus }
          }
        />
      ) : (
        <>
          <PaymentsTable rows={rows} partyLabel="Customer" kind="customer" />
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            onPageChange={handlePageChange}
          />
        </>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Supplier Payments Tab
// ─────────────────────────────────────────────────────────────

interface SupplierPaymentsTabProps {
  readonly result: SupplierPaymentListResult;
  readonly stats: PaymentStats;
  readonly filters: {
    readonly search?: string;
    readonly status?: PaymentStatus;
  };
  readonly onRecordPayment: () => void;
}

function SupplierPaymentsTab({
  result,
  stats,
  filters,
  onRecordPayment,
}: SupplierPaymentsTabProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search ?? "");
  const [, startTransition] = useTransition();

  const hasFilters = Boolean(filters.search || filters.status);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    startTransition(() => {
      router.push(patchQuery({ sSearch: search.trim() || undefined, sPage: undefined }));
    });
  };

  const handleSearchChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const value = event.target.value;
    setSearch(value);
    if (value === "" && filters.search) {
      startTransition(() => {
        router.push(patchQuery({ sSearch: undefined, sPage: undefined }));
      });
    }
  };

  const handleStatusSelect = (value: string): void => {
    startTransition(() => {
      router.push(patchQuery({ sStatus: value || undefined, sPage: undefined }));
    });
  };

  const handlePageChange = (newPage: number): void => {
    startTransition(() => {
      router.push(patchQuery({ sPage: newPage <= 1 ? undefined : String(newPage) }));
    });
  };

  const handleClearFilters = (): void => {
    startTransition(() => {
      router.push(patchQuery({ sSearch: undefined, sStatus: undefined, sPage: undefined }));
    });
  };

  const rows: readonly PaymentRow[] = result.payments.map(
    (payment: SupplierPayment) => ({
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      partyName: payment.supplierName ?? payment.supplierId,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      amount: payment.amount,
      status: payment.status,
    })
  );

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="Total paid"
          value={stats.totalAmount}
          tint="bg-gradient-brand"
          index={0}
          currency
        />
        <StatTile
          icon={CalendarClock}
          label="This month"
          value={stats.thisMonth}
          tint="bg-gradient-info"
          index={1}
          currency
        />
        <StatTile
          icon={CheckCircle2}
          label="Completed"
          value={stats.completed}
          tint="bg-gradient-success"
          index={2}
        />
        <StatTile
          icon={Ban}
          label="Voided"
          value={stats.voided}
          tint="bg-gradient-warning"
          index={3}
        />
      </div>

      {/* Search + filter pills */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={handleSearch} role="search" className="flex gap-2">
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search by payment no., reference…"
              className="pl-9"
              aria-label="Search supplier payments"
            />
          </div>
        </form>

        <FilterPills
          label="Status"
          options={STATUS_FILTERS}
          active={filters.status ?? ""}
          onSelect={handleStatusSelect}
        />
      </div>

      {/* Table / empty state */}
      {rows.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={hasFilters ? "No matching payments" : "No supplier payments yet"}
          description={
            hasFilters
              ? "No supplier payments match your current filters. Try adjusting your search or clearing the filters."
              : "Record your first supplier payment to get started."
          }
          action={
            hasFilters
              ? { label: "Clear filters", onClick: handleClearFilters }
              : { label: "Make Payment", onClick: onRecordPayment, icon: Plus }
          }
        />
      ) : (
        <>
          <PaymentsTable rows={rows} partyLabel="Supplier" kind="supplier" />
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab type + props
// ─────────────────────────────────────────────────────────────

type ActiveTab = "customer" | "supplier";

interface PartyOption {
  readonly id: string;
  readonly name: string;
}

interface PaymentsViewProps {
  readonly organizationId: string;
  readonly customerPayments: CustomerPaymentListResult;
  readonly supplierPayments: SupplierPaymentListResult;
  readonly customerStats: PaymentStats;
  readonly supplierStats: PaymentStats;
  readonly customers: readonly PartyOption[];
  readonly suppliers: readonly PartyOption[];
  readonly customerFilters: {
    readonly search?: string;
    readonly status?: PaymentStatus;
  };
  readonly supplierFilters: {
    readonly search?: string;
    readonly status?: PaymentStatus;
  };
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function PaymentsView({
  organizationId,
  customerPayments,
  supplierPayments,
  customerStats,
  supplierStats,
  customers,
  suppliers,
  customerFilters,
  supplierFilters,
}: PaymentsViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("customer");
  const [showDialog, setShowDialog] = useState(false);

  const totalCount = customerPayments.total + supplierPayments.total;

  const selectCustomer = (): void => setActiveTab("customer");
  const selectSupplier = (): void => setActiveTab("supplier");

  const openDialog = (): void => setShowDialog(true);
  const closeDialog = (): void => setShowDialog(false);
  const handleDone = (): void => {
    setShowDialog(false);
    router.refresh();
  };

  const actionLabel =
    activeTab === "customer" ? "Record payment" : "Make payment";

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <Receipt className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Payments
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {totalCount}
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage customer receipts and supplier disbursements
          </p>
        </div>
      </motion.div>

      {/* Tabs + action */}
      <div className="flex items-end justify-between gap-3 border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex gap-6" aria-label="Payment tabs">
          <button
            type="button"
            onClick={selectCustomer}
            className={cn(
              "flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors",
              activeTab === "customer"
                ? "border-primary-600 text-primary-600 dark:text-primary-400"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-300"
            )}
            aria-selected={activeTab === "customer"}
            role="tab"
          >
            <IndianRupee className="h-4 w-4" aria-hidden="true" />
            Customer Payments
            {customerPayments.total > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {customerPayments.total}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={selectSupplier}
            className={cn(
              "flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors",
              activeTab === "supplier"
                ? "border-primary-600 text-primary-600 dark:text-primary-400"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-300"
            )}
            aria-selected={activeTab === "supplier"}
            role="tab"
          >
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Supplier Payments
            {supplierPayments.total > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {supplierPayments.total}
              </span>
            )}
          </button>
        </nav>
        <Button
          onClick={openDialog}
          variant="gradient"
          size="sm"
          className="mb-2 gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {actionLabel}
        </Button>
      </div>

      {/* Tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        role="tabpanel"
      >
        {activeTab === "customer" ? (
          <CustomerPaymentsTab
            result={customerPayments}
            stats={customerStats}
            filters={customerFilters}
            onRecordPayment={openDialog}
          />
        ) : (
          <SupplierPaymentsTab
            result={supplierPayments}
            stats={supplierStats}
            filters={supplierFilters}
            onRecordPayment={openDialog}
          />
        )}
      </motion.div>

      {showDialog &&
        (activeTab === "customer" ? (
          <RecordCustomerPaymentDialog
            organizationId={organizationId}
            customerId=""
            customerName="Select Customer"
            customers={customers}
            onClose={closeDialog}
            onDone={handleDone}
          />
        ) : (
          <RecordSupplierPaymentDialog
            organizationId={organizationId}
            supplierId=""
            supplierName="Select Supplier"
            suppliers={suppliers}
            onClose={closeDialog}
            onDone={handleDone}
          />
        ))}
    </div>
  );
}
