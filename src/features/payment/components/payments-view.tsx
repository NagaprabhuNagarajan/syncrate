"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  DollarSign,
  CreditCard,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordCustomerPaymentDialog } from "@/features/payment/components/record-customer-payment-dialog";
import { RecordSupplierPaymentDialog } from "@/features/payment/components/record-supplier-payment-dialog";
import type {
  CustomerPayment,
  CustomerPaymentListResult,
  PaymentMethod,
  PaymentStatus,
  SupplierPayment,
  SupplierPaymentListResult,
} from "@/features/payment/types/payment.types";

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFmt.format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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

const STATUS_VARIANT: Record<PaymentStatus, BadgeProps["variant"]> = {
  completed: "success",
  voided: "destructive",
};

// ─────────────────────────────────────────────────────────────
// Row animations
// ─────────────────────────────────────────────────────────────

const rowVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.2, ease: "easeOut" },
  }),
};

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface PaymentsViewProps {
  readonly organizationId: string;
  readonly customerPayments: CustomerPaymentListResult;
  readonly supplierPayments: SupplierPaymentListResult;
}

// ─────────────────────────────────────────────────────────────
// Customer Payments Tab
// ─────────────────────────────────────────────────────────────

interface CustomerPaymentsTabProps {
  readonly organizationId: string;
  readonly result: CustomerPaymentListResult;
}

function CustomerPaymentsTab({
  organizationId,
  result,
}: CustomerPaymentsTabProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [, startTransition] = useTransition();

  function handleSearch(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const params = new URLSearchParams(window.location.search);
    if (search.trim()) {
      params.set("cSearch", search.trim());
    } else {
      params.delete("cSearch");
    }
    params.delete("cPage");
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  function handlePageChange(newPage: number): void {
    const params = new URLSearchParams(window.location.search);
    params.set("cPage", String(newPage));
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  const totalPages = Math.ceil(result.total / result.pageSize);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by payment no., reference…"
              className="w-72 pl-9"
              aria-label="Search customer payments"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>

        <Button
          onClick={() => setShowDialog(true)}
          variant="gradient"
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Record Payment
        </Button>
      </div>

      {/* Table */}
      {result.payments.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No customer payments yet"
          description="Record your first customer payment to get started."
          action={{
            label: "Record Payment",
            onClick: () => setShowDialog(true),
            icon: Plus,
          }}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-card dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/70 dark:bg-slate-800/40">
                <tr>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Payment #
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Customer
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Method
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {result.payments.map((payment: CustomerPayment, index: number) => (
                    <motion.tr
                      key={payment.id}
                      custom={index}
                      initial="hidden"
                      animate="visible"
                      variants={rowVariants}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-2">
                        <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                          {payment.paymentNumber}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {payment.customerName ?? payment.customerId}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {formatDate(payment.paymentDate)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {METHOD_LABELS[payment.paymentMethod]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="nums text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(payment.amount)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge dot variant={STATUS_VARIANT[payment.status]}>
                          {payment.status === "completed"
                            ? "Completed"
                            : "Voided"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/payments/${payment.id}`}
                          className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          View
                        </Link>
                      </td>
                    </motion.tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {(result.page - 1) * result.pageSize + 1}–
                {Math.min(result.page * result.pageSize, result.total)} of{" "}
                {result.total} payments
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(result.page - 1)}
                  disabled={result.page <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {result.page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(result.page + 1)}
                  disabled={result.page >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Record Payment Dialog */}
      {showDialog && (
        <RecordCustomerPaymentDialog
          organizationId={organizationId}
          customerId=""
          customerName="Select Customer"
          onClose={() => setShowDialog(false)}
          onDone={() => {
            setShowDialog(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Supplier Payments Tab
// ─────────────────────────────────────────────────────────────

interface SupplierPaymentsTabProps {
  readonly organizationId: string;
  readonly result: SupplierPaymentListResult;
}

function SupplierPaymentsTab({
  organizationId,
  result,
}: SupplierPaymentsTabProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [, startTransition] = useTransition();

  function handleSearch(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const params = new URLSearchParams(window.location.search);
    if (search.trim()) {
      params.set("sSearch", search.trim());
    } else {
      params.delete("sSearch");
    }
    params.delete("sPage");
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  function handlePageChange(newPage: number): void {
    const params = new URLSearchParams(window.location.search);
    params.set("sPage", String(newPage));
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  const totalPages = Math.ceil(result.total / result.pageSize);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by payment no., reference…"
              className="w-72 pl-9"
              aria-label="Search supplier payments"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>

        <Button
          onClick={() => setShowDialog(true)}
          variant="gradient"
          size="sm"
          className="gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Make Payment
        </Button>
      </div>

      {/* Table */}
      {result.payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No supplier payments yet"
          description="Record your first supplier payment to get started."
          action={{
            label: "Make Payment",
            onClick: () => setShowDialog(true),
            icon: Plus,
          }}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-card dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/70 dark:bg-slate-800/40">
                <tr>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Payment #
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Supplier
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Method
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Amount
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {result.payments.map(
                  (payment: SupplierPayment, index: number) => (
                    <motion.tr
                      key={payment.id}
                      custom={index}
                      initial="hidden"
                      animate="visible"
                      variants={rowVariants}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-3 py-2">
                        <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                          {payment.paymentNumber}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {payment.supplierName ?? payment.supplierId}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {formatDate(payment.paymentDate)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {METHOD_LABELS[payment.paymentMethod]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="nums text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(payment.amount)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge dot variant={STATUS_VARIANT[payment.status]}>
                          {payment.status === "completed"
                            ? "Completed"
                            : "Voided"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/payments/${payment.id}`}
                          className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          View
                        </Link>
                      </td>
                    </motion.tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {(result.page - 1) * result.pageSize + 1}–
                {Math.min(result.page * result.pageSize, result.total)} of{" "}
                {result.total} payments
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(result.page - 1)}
                  disabled={result.page <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {result.page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(result.page + 1)}
                  disabled={result.page >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Make Payment Dialog */}
      {showDialog && (
        <RecordSupplierPaymentDialog
          organizationId={organizationId}
          supplierId=""
          supplierName="Select Supplier"
          onClose={() => setShowDialog(false)}
          onDone={() => {
            setShowDialog(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────

const SKELETON_COLUMN_KEYS = [
  "col-1",
  "col-2",
  "col-3",
  "col-4",
  "col-5",
  "col-6",
  "col-7",
] as const;

const SKELETON_ROW_KEYS = [
  "row-1",
  "row-2",
  "row-3",
  "row-4",
  "row-5",
] as const;

function PaymentsTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-card dark:border-slate-800">
      <table className="min-w-full">
        <thead className="bg-slate-50/70 dark:bg-slate-800/40">
          <tr>
            {SKELETON_COLUMN_KEYS.map((columnKey) => (
              <th key={columnKey} className="px-3 py-2">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {SKELETON_ROW_KEYS.map((rowKey) => (
            <tr key={rowKey}>
              {SKELETON_COLUMN_KEYS.map((columnKey) => (
                <td key={`${rowKey}-${columnKey}`} className="px-3 py-2">
                  <Skeleton className="h-4 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab type
// ─────────────────────────────────────────────────────────────

type ActiveTab = "customer" | "supplier";

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function PaymentsView({
  organizationId,
  customerPayments,
  supplierPayments,
}: PaymentsViewProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("customer");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        description="Manage customer receipts and supplier disbursements"
        icon={Receipt}
      />

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex gap-6" aria-label="Payment tabs">
          <button
            type="button"
            onClick={() => setActiveTab("customer")}
            className={[
              "flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors",
              activeTab === "customer"
                ? "border-primary-600 text-primary-600 dark:text-primary-400"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-300",
            ].join(" ")}
            aria-selected={activeTab === "customer"}
            role="tab"
          >
            <DollarSign className="h-4 w-4" aria-hidden="true" />
            Customer Payments
            {customerPayments.total > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {customerPayments.total}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("supplier")}
            className={[
              "flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors",
              activeTab === "supplier"
                ? "border-primary-600 text-primary-600 dark:text-primary-400"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-300",
            ].join(" ")}
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
            organizationId={organizationId}
            result={customerPayments}
          />
        ) : (
          <SupplierPaymentsTab
            organizationId={organizationId}
            result={supplierPayments}
          />
        )}
      </motion.div>
    </div>
  );
}

export { PaymentsTableSkeleton };
