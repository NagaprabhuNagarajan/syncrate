"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Truck,
  Calendar,
  Hash,
  ChevronLeft,
  Receipt,
  Wallet,
  Clock,
  ShoppingCart,
  CreditCard,
  Banknote,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/shared/error-banner";
import { KpiTile } from "@/components/shared/kpi-tile";
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
  postBillAction,
  cancelBillAction,
} from "@/features/purchase/actions/bill.actions";
import { applySupplierCreditAction } from "@/features/payment/actions/supplier-payment.actions";
import { RecordSupplierPaymentDialog } from "@/features/payment/components/record-supplier-payment-dialog";
import {
  BILL_STATUS_LABEL,
  BILL_STATUS_VARIANT,
  BILL_PAYMENT_STATUS_LABEL,
  BILL_PAYMENT_STATUS_VARIANT,
  deriveBillPaymentStatus,
} from "@/features/purchase/utils/bill-display";
import { formatCurrency, formatDate } from "@/utils/format";
import type { BillWithItems } from "@/features/purchase/types/bill.types";

// ─────────────────────────────────────────────────────────────
// Cancel confirmation dialog
// ─────────────────────────────────────────────────────────────

interface CancelDialogProps {
  readonly invoiceNumber: string;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function CancelDialog({
  invoiceNumber,
  isPending,
  error,
  onConfirm,
  onCancel,
}: CancelDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-bill-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className="bg-error-50 dark:bg-error-500/10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle
              className="text-error-600 dark:text-error-400 h-5 w-5"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2
              id="cancel-bill-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Cancel bill
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to cancel{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {invoiceNumber}
              </span>
              ? This cannot be undone.
            </p>
          </div>
        </div>

        {error && <ErrorBanner message={error} className="mt-4" />}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Keep bill
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Cancel bill
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Apply-credit confirmation dialog
// ─────────────────────────────────────────────────────────────

interface ApplyCreditDialogProps {
  readonly availableCredit: number;
  readonly balanceDue: number;
  readonly applicableCredit: number;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: (amount: number) => void;
  readonly onClose: () => void;
}

function ApplyCreditDialog({
  availableCredit,
  balanceDue,
  applicableCredit,
  isPending,
  error,
  onConfirm,
  onClose,
}: ApplyCreditDialogProps) {
  const [amount, setAmount] = useState<number>(applicableCredit);

  const handleAmountChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    setAmount(Number(event.target.value));
  };

  const isValid = amount > 0 && amount <= applicableCredit;

  const handleConfirm = (): void => {
    if (isValid) {
      onConfirm(amount);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-credit-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className="bg-success-50 dark:bg-success-500/10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <CreditCard
              className="text-success-600 dark:text-success-400 h-5 w-5"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2
              id="apply-credit-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Apply credit
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Settle this bill using the supplier&apos;s available advance
              credit.
            </p>
          </div>
        </div>

        <dl className="mt-5 space-y-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Available credit</dt>
            <dd className="nums font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(availableCredit, true)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Bill balance due</dt>
            <dd className="nums font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(balanceDue, true)}
            </dd>
          </div>
        </dl>

        <div className="mt-4">
          <label
            htmlFor="apply-credit-amount"
            className="text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Amount to apply
          </label>
          <input
            id="apply-credit-amount"
            type="number"
            inputMode="decimal"
            min={0}
            max={applicableCredit}
            step="0.01"
            value={amount}
            onChange={handleAmountChange}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Up to {formatCurrency(applicableCredit, true)} can be applied.
          </p>
        </div>

        {error && <ErrorBanner message={error} className="mt-4" />}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="gradient"
            onClick={handleConfirm}
            loading={isPending}
            disabled={isPending || !isValid}
          >
            Apply credit
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Info row + section card
// ─────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string | null;
}) {
  if (!value) {
    return null;
  }
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words text-slate-700 dark:text-slate-300">
          {value}
        </dd>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children,
  delay,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
    >
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {children}
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────

interface BillDetailProps {
  readonly bill: BillWithItems;
  readonly supplierName: string | null;
  readonly productNames: Readonly<Record<string, string>>;
  /** PO number of the linked purchase order, if this bill was raised from one. */
  readonly purchaseOrderNumber?: string | null;
  /** The supplier's unallocated advance credit — enables "Apply credit" when > 0. */
  readonly availableCredit?: number;
  readonly organizationId: string;
  readonly canManage: boolean;
  readonly canCancel: boolean;
  readonly canMakePayment?: boolean;
}

export function BillDetail({
  bill,
  supplierName,
  productNames,
  purchaseOrderNumber,
  availableCredit = 0,
  organizationId,
  canManage,
  canCancel,
  canMakePayment = false,
}: BillDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const org = searchParams.get("org");
  const withOrg = (path: string): string =>
    org ? `${path}?org=${org}` : path;

  const { status } = bill;
  const isDraft = status === "draft";
  const balanceDue = bill.totalAmount - bill.amountPaid;
  const applicableCredit = Math.min(availableCredit, balanceDue);
  const canPay = status === "posted" && balanceDue > 0 && canMakePayment;
  const canApplyCredit = canPay && applicableCredit > 0;
  const paymentStatus = deriveBillPaymentStatus(bill);

  const openCredit = (): void => {
    setCreditError(null);
    setShowCredit(true);
  };

  const closeCredit = (): void => setShowCredit(false);

  const openPayment = (): void => setShowPayment(true);
  const closePayment = (): void => setShowPayment(false);
  const handlePaymentDone = (): void => {
    setShowPayment(false);
    router.refresh();
  };

  const handleApplyCredit = (amount: number): void => {
    setCreditError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("supplierId", bill.supplierId);
      formData.set("billId", bill.id);
      formData.set("amount", String(amount));
      const result = await applySupplierCreditAction(organizationId, formData);
      if (!result.success) {
        setCreditError(result.error.message);
        return;
      }
      setShowCredit(false);
      router.refresh();
    });
  };

  const run = (
    action: () => Promise<{ success: boolean; error?: { message: string } }>
  ): void => {
    setActionError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setActionError(result.error?.message ?? "Action failed");
        return;
      }
      setShowCancel(false);
      router.refresh();
    });
  };

  const handlePost = (): void =>
    run(() => postBillAction(organizationId, bill.id));
  const handleCancel = (): void =>
    run(() => cancelBillAction(organizationId, bill.id));

  return (
    <div className="p-4 lg:p-6">
      {/* Back link */}
      <Link
        href={withOrg("/bills")}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Bills
      </Link>

      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {bill.invoiceNumber}
              </h1>
              <Badge dot variant={BILL_STATUS_VARIANT[status]}>
                {BILL_STATUS_LABEL[status]}
              </Badge>
              <Badge dot variant={BILL_PAYMENT_STATUS_VARIANT[paymentStatus]}>
                {BILL_PAYMENT_STATUS_LABEL[paymentStatus]}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {supplierName ?? "No supplier"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDraft && canManage && (
              <Button
                type="button"
                variant="gradient"
                size="sm"
                onClick={handlePost}
                loading={isPending}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Post
              </Button>
            )}
            {canPay && (
              <Button
                type="button"
                variant="gradient"
                size="sm"
                onClick={openPayment}
              >
                <Banknote className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Record payment
              </Button>
            )}
            {canApplyCredit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openCredit}
              >
                <CreditCard className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Apply credit
              </Button>
            )}
            {isDraft && canCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-error-600 hover:bg-error-50 hover:text-error-700 dark:text-error-400 dark:hover:bg-error-500/10 dark:hover:text-error-300"
                onClick={() => {
                  setActionError(null);
                  setShowCancel(true);
                }}
              >
                <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {actionError && <ErrorBanner message={actionError} className="mb-4" />}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          icon={Receipt}
          label="Total"
          value={bill.totalAmount}
          tint="bg-gradient-brand"
          emphasis
          index={0}
        />
        <KpiTile
          icon={Wallet}
          label="Amount paid"
          value={bill.amountPaid}
          tint="bg-gradient-success"
          index={1}
        />
        <KpiTile
          icon={Clock}
          label="Balance due"
          value={balanceDue}
          tint="bg-gradient-violet"
          index={2}
        />
        <KpiTile
          icon={Calendar}
          label="Due date"
          value={0}
          displayValue={bill.dueDate ? formatDate(bill.dueDate) : "—"}
          tint="bg-gradient-info"
          index={3}
        />
      </div>

      {/* Two-column body */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            <Card className="overflow-hidden">
              <div className="px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Line items
                </h2>
              </div>
              <Table
                className="[&_td]:px-5 [&_th]:px-5"
                wrapperClassName="rounded-none border-0 border-t border-slate-100 bg-transparent dark:border-slate-800"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bill.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-slate-700 dark:text-slate-300">
                        {productNames[item.productId] ??
                          item.description ??
                          "—"}
                      </TableCell>
                      <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(item.unitPrice, true)}
                      </TableCell>
                      <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                        {item.taxRate}%
                      </TableCell>
                      <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.lineTotal, true)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </motion.div>

          {bill.notes && (
            <SectionCard title="Notes" delay={0.15}>
              <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {bill.notes}
              </p>
            </SectionCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SectionCard title="Details" delay={0.1}>
            <dl className="space-y-4">
              <InfoRow icon={Truck} label="Supplier" value={supplierName} />
              {bill.purchaseOrderId && (
                <div className="flex items-start gap-2.5 text-sm">
                  <ShoppingCart
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      Purchase order
                    </dt>
                    <dd>
                      <Link
                        href={withOrg(`/purchases/${bill.purchaseOrderId}`)}
                        className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                      >
                        {purchaseOrderNumber ?? "View purchase order"}
                      </Link>
                    </dd>
                  </div>
                </div>
              )}
              <InfoRow
                icon={Hash}
                label="Supplier invoice no."
                value={bill.supplierInvoiceNumber}
              />
              <InfoRow
                icon={Calendar}
                label="Bill date"
                value={formatDate(bill.invoiceDate)}
              />
              <InfoRow
                icon={Calendar}
                label="Due date"
                value={
                  bill.dueDate
                    ? formatDate(bill.dueDate)
                    : null
                }
              />
              <InfoRow
                icon={Calendar}
                label="Posted at"
                value={
                  bill.postedAt
                    ? formatDate(bill.postedAt)
                    : null
                }
              />
              {availableCredit > 0 && (
                <InfoRow
                  icon={Wallet}
                  label="Available credit"
                  value={formatCurrency(availableCredit, true)}
                />
              )}
            </dl>
          </SectionCard>

          <SectionCard title="Summary" delay={0.15}>
            <dl className="space-y-4">
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(bill.subtotal, true)}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(bill.taxAmount, true)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <dt className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Total
                </dt>
                <dd className="nums text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(bill.totalAmount, true)}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Amount paid</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(bill.amountPaid, true)}
                </dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>

      <AnimatePresence>
        {showCancel && (
          <CancelDialog
            invoiceNumber={bill.invoiceNumber}
            isPending={isPending}
            error={actionError}
            onConfirm={handleCancel}
            onCancel={() => setShowCancel(false)}
          />
        )}
        {showCredit && (
          <ApplyCreditDialog
            availableCredit={availableCredit}
            balanceDue={balanceDue}
            applicableCredit={applicableCredit}
            isPending={isPending}
            error={creditError}
            onConfirm={handleApplyCredit}
            onClose={closeCredit}
          />
        )}
      </AnimatePresence>

      {showPayment && (
        <RecordSupplierPaymentDialog
          organizationId={organizationId}
          supplierId={bill.supplierId}
          supplierName={supplierName ?? "Supplier"}
          outstandingInvoices={[
            {
              id: bill.id,
              invoiceNumber: bill.invoiceNumber,
              invoiceDate: bill.invoiceDate.toISOString(),
              totalAmount: bill.totalAmount,
              amountPaid: bill.amountPaid,
              outstandingAmount: balanceDue,
            },
          ]}
          preselectedInvoiceIds={[bill.id]}
          onClose={closePayment}
          onDone={handlePaymentDone}
        />
      )}
    </div>
  );
}
