"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Pencil,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  Hash,
  Download,
  Share2,
  FileText,
  ChevronLeft,
  Receipt,
  Wallet,
  CreditCard,
  Clock,
  Banknote,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/shared/error-banner";
import { StatusBadge } from "@/components/shared/status-badge";
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
  INV_STATUS,
  PAYMENT_STATUS,
} from "@/features/sales/components/invoices-view";
import {
  postInvoiceAction,
  cancelInvoiceAction,
} from "@/features/sales/actions/invoice.actions";
import { RecordCustomerPaymentDialog } from "@/features/payment/components/record-customer-payment-dialog";
import { applyCustomerCreditAction } from "@/features/payment/actions/customer-payment.actions";
import { formatCurrency, formatDate } from "@/utils/format";
import { ApprovalPanel } from "@/features/approvals/components/approval-panel";
import type { EntityApproval } from "@/features/approvals/types/approval.types";
import type { InvoiceWithItems } from "@/features/sales/types/invoice.types";
import type {
  InvoicePaymentSummary,
  PaymentMethod,
} from "@/features/payment/types/payment.types";

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  wallet: "Wallet",
  other: "Other",
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatDateOrDash(value: Date | null): string {
  return value ? formatDate(value) : "—";
}

// ─────────────────────────────────────────────────────────────
// Cancel confirmation dialog
// ─────────────────────────────────────────────────────────────

interface CancelDialogProps {
  readonly invoiceNumber: string;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

function CancelDialog({
  invoiceNumber,
  isPending,
  error,
  onConfirm,
  onClose,
}: CancelDialogProps) {
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
        aria-labelledby="cancel-inv-title"
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
              id="cancel-inv-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Cancel invoice
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
            onClick={onClose}
            disabled={isPending}
          >
            Keep invoice
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Cancel invoice
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
              Settle this invoice using the customer&apos;s available advance
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
            <dt className="text-muted-foreground">Invoice balance due</dt>
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
// Props
// ─────────────────────────────────────────────────────────────

interface InvoiceDetailProps {
  readonly invoice: InvoiceWithItems;
  readonly customerName: string | null;
  readonly productNames: Readonly<Record<string, string>>;
  readonly salesOrderNumber?: string | null;
  readonly payments?: readonly InvoicePaymentSummary[];
  readonly availableCredit?: number;
  /** Approval requests raised against this invoice. */
  readonly approvals?: readonly EntityApproval[];
  readonly organizationId: string;
  readonly canManage: boolean;
  readonly canCancel: boolean;
  readonly canReceivePayment: boolean;
}

export function InvoiceDetail({
  invoice,
  customerName,
  productNames,
  salesOrderNumber,
  payments = [],
  availableCredit = 0,
  approvals = [],
  organizationId,
  canManage,
  canCancel,
  canReceivePayment,
}: InvoiceDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const org = searchParams.get("org");
  const withOrg = (path: string): string => (org ? `${path}?org=${org}` : path);

  const { status } = invoice;
  const isDraft = status === "draft";
  const balanceDue = invoice.totalAmount - invoice.amountPaid;
  const canPay = status === "posted" && balanceDue > 0 && canReceivePayment;
  const applicableCredit = Math.min(availableCredit, balanceDue);
  const canApplyCredit = canPay && applicableCredit > 0;

  // Preserve existing action hrefs byte-for-byte.
  const editHref = `/invoices/${invoice.id}/edit`;
  const shareUrl = `/invoices/${invoice.id}/share`;
  const pdfUrl = `/api/invoices/${invoice.id}/pdf`;

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
    run(() => postInvoiceAction(organizationId, invoice.id));

  const handleCancel = (): void =>
    run(() => cancelInvoiceAction(organizationId, invoice.id));

  const openCancel = (): void => {
    setActionError(null);
    setShowCancel(true);
  };

  const closeCancel = (): void => setShowCancel(false);

  const openPayment = (): void => setShowPayment(true);

  const closePayment = (): void => setShowPayment(false);

  const handlePaymentDone = (): void => {
    setShowPayment(false);
    router.refresh();
  };

  const openCredit = (): void => {
    setCreditError(null);
    setShowCredit(true);
  };

  const closeCredit = (): void => setShowCredit(false);

  const handleApplyCredit = (amount: number): void => {
    setCreditError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("customerId", invoice.customerId);
      formData.set("invoiceId", invoice.id);
      formData.set("amount", String(amount));
      const result = await applyCustomerCreditAction(organizationId, formData);
      if (!result.success) {
        setCreditError(result.error.message);
        return;
      }
      setShowCredit(false);
      router.refresh();
    });
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Back link */}
      <Link
        href={withOrg("/invoices")}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Invoices
      </Link>

      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {invoice.invoiceNumber}
              </h1>
              <StatusBadge {...INV_STATUS[status]} />
              <StatusBadge
                {...PAYMENT_STATUS[invoice.paymentStatus]}
                dot={false}
              />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {customerName ?? "No customer"}
              {invoice.postedAt
                ? ` · Posted on ${formatDate(invoice.postedAt)}`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDraft && canManage && (
              <Button asChild variant="outline" size="sm">
                <Link href={editHref}>
                  <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Edit
                </Link>
              </Button>
            )}
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
            <Button asChild variant="outline" size="sm">
              <a href={pdfUrl} aria-label="Download PDF">
                <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Download PDF
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={shareUrl} aria-label="Share invoice">
                <Share2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Share
              </Link>
            </Button>
            {isDraft && canCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-error-600 hover:bg-error-50 hover:text-error-700 dark:text-error-400 dark:hover:bg-error-500/10 dark:hover:text-error-300"
                onClick={openCancel}
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
          value={invoice.totalAmount}
          tint="bg-gradient-brand"
          emphasis
          index={0}
        />
        <KpiTile
          icon={Wallet}
          label="Amount paid"
          value={invoice.amountPaid}
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
          displayValue={formatDateOrDash(invoice.dueDate)}
          tint="bg-gradient-info"
          index={3}
        />
      </div>

      {/* Approvals */}
      <ApprovalPanel organizationId={organizationId} approvals={approvals} />

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
                    <TableHead>HSN</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Disc %</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-slate-700 dark:text-slate-300">
                        {productNames[item.productId] ??
                          item.description ??
                          "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {item.hsnCode ?? "—"}
                      </TableCell>
                      <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(item.unitPrice, true)}
                      </TableCell>
                      <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                        {item.discountPercent > 0
                          ? `${item.discountPercent}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                        {item.gstRate}%
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

          <SectionCard
            title={`Payments received (${payments.length})`}
            delay={0.25}
          >
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payments have been recorded against this invoice yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <Link
                          href={withOrg(`/payments/${payment.id}`)}
                          className="text-primary-600 hover:underline dark:text-primary-400"
                        >
                          {payment.paymentNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-300">
                        {formatDate(new Date(payment.paymentDate))}
                      </TableCell>
                      <TableCell className="text-slate-700 dark:text-slate-300">
                        {PAYMENT_METHOD_LABEL[payment.paymentMethod]}
                      </TableCell>
                      <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(payment.allocatedAmount, true)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          {(invoice.notes || invoice.terms) && (
            <SectionCard title="Notes & terms" delay={0.2}>
              <div className="space-y-4">
                {invoice.notes && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Notes</dt>
                    <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                      {invoice.notes}
                    </dd>
                  </div>
                )}
                {invoice.terms && (
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Terms &amp; conditions
                    </dt>
                    <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                      {invoice.terms}
                    </dd>
                  </div>
                )}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SectionCard title="Details" delay={0.1}>
            <dl className="space-y-4">
              <InfoRow icon={User} label="Customer" value={customerName} />
              <InfoRow
                icon={Hash}
                label="Invoice type"
                value={invoice.invoiceType.replace(/_/g, " ")}
              />
              <InfoRow
                icon={Calendar}
                label="Invoice date"
                value={formatDate(invoice.invoiceDate)}
              />
              <InfoRow
                icon={Calendar}
                label="Due date"
                value={formatDateOrDash(invoice.dueDate)}
              />
              <InfoRow
                icon={Calendar}
                label="Posted date"
                value={invoice.postedAt ? formatDate(invoice.postedAt) : null}
              />
              <InfoRow
                icon={Hash}
                label={
                  invoice.isInterstate
                    ? "Supply state (inter-state)"
                    : "Supply state (intra-state)"
                }
                value={invoice.supplyState}
              />
              <InfoRow
                icon={Hash}
                label="Reference"
                value={invoice.referenceNumber}
              />
              {availableCredit > 0 && (
                <InfoRow
                  icon={Wallet}
                  label="Available credit"
                  value={formatCurrency(availableCredit, true)}
                />
              )}
              {invoice.salesOrderId && (
                <div className="flex items-start gap-2.5 text-sm">
                  <FileText
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      Linked sales order
                    </dt>
                    <dd>
                      <Link
                        href={withOrg(`/sales-orders/${invoice.salesOrderId}`)}
                        className="text-primary-600 hover:underline dark:text-primary-400"
                      >
                        {salesOrderNumber ?? "View sales order"}
                      </Link>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </SectionCard>

          <SectionCard title="Summary" delay={0.15}>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(invoice.subtotal, true)}
                </dd>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="nums text-slate-700 dark:text-slate-300">
                    −{formatCurrency(invoice.discountAmount, true)}
                  </dd>
                </div>
              )}
              {invoice.isInterstate ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">IGST</dt>
                  <dd className="nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(invoice.igstAmount, true)}
                  </dd>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">CGST</dt>
                    <dd className="nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(invoice.cgstAmount, true)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">SGST</dt>
                    <dd className="nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(invoice.sgstAmount, true)}
                    </dd>
                  </div>
                </>
              )}
              {invoice.roundOff !== 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Round off</dt>
                  <dd className="nums text-slate-700 dark:text-slate-300">
                    {invoice.roundOff > 0 ? "+" : ""}
                    {formatCurrency(invoice.roundOff, true)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <dt className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Total
                </dt>
                <dd className="nums text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(invoice.totalAmount, true)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Amount paid</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(invoice.amountPaid, true)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Balance due</dt>
                <dd className="nums font-medium text-slate-900 dark:text-slate-100">
                  {formatCurrency(balanceDue, true)}
                </dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>

      <AnimatePresence>
        {showCancel && (
          <CancelDialog
            invoiceNumber={invoice.invoiceNumber}
            isPending={isPending}
            error={actionError}
            onConfirm={handleCancel}
            onClose={closeCancel}
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
        <RecordCustomerPaymentDialog
          organizationId={organizationId}
          customerId={invoice.customerId}
          customerName={customerName ?? "Customer"}
          outstandingInvoices={[
            {
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
              totalAmount: invoice.totalAmount,
              amountPaid: invoice.amountPaid,
              outstandingAmount: balanceDue,
            },
          ]}
          preselectedInvoiceIds={[invoice.id]}
          onClose={closePayment}
          onDone={handlePaymentDone}
        />
      )}
    </div>
  );
}
