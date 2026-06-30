"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  Pencil,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Users,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  QUOTATION_STATUS_LABEL,
  QUOTATION_STATUS_VARIANT,
} from "@/features/sales/components/quotations-view";
import {
  submitQuotationAction,
  acceptQuotationAction,
  rejectQuotationAction,
  cancelQuotationAction,
} from "@/features/sales/actions/quotation.actions";
import type { QuotationWithItems } from "@/features/sales/types/quotation.types";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: Date | null): string {
  if (!value) {return "—";}
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────
// Cancel confirmation dialog
// ─────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly variant: "destructive" | "default";
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  variant,
  isPending,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
        aria-labelledby="confirm-dialog-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl"
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
              id="confirm-dialog-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
          </div>
        </div>
        {error && (
          <div
            className="border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-800 dark:text-error-300 mt-4 rounded-lg border px-4 py-3 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Keep it
          </Button>
          <Button
            type="button"
            variant={variant}
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            {confirmLabel}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Info row
// ─────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: typeof Calendar;
  readonly label: string;
  readonly value: string | null;
}) {
  if (!value) {return null;}
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-slate-700 dark:text-slate-300">{value}</dd>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────

interface QuotationDetailProps {
  readonly quotation: QuotationWithItems;
  readonly customerName: string | null;
  readonly productNames: Readonly<Record<string, string>>;
  readonly organizationId: string;
  readonly canManage: boolean;
  readonly canApprove: boolean;
  readonly canCancel: boolean;
}

export function QuotationDetail({
  quotation,
  customerName,
  productNames,
  organizationId,
  canManage,
  canApprove,
  canCancel,
}: QuotationDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "reject" | "cancel" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const org = searchParams.get("org");
  const withOrg = (path: string): string => (org ? `${path}?org=${org}` : path);
  const editHref = withOrg(`/sales/quotations/${quotation.id}/edit`);
  const convertHref = withOrg(`/sales-orders/new?from=quotation&quotationId=${quotation.id}`);

  const { status } = quotation;
  const isDraft = status === "draft";
  const isSentOrViewed = status === "sent" || status === "viewed";
  const isTerminal =
    status === "rejected" ||
    status === "expired" ||
    status === "converted";

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
      setConfirmAction(null);
      router.refresh();
    });
  };

  const handleSubmit = (): void =>
    run(() => submitQuotationAction(organizationId, quotation.id));
  const handleAccept = (): void =>
    run(() => acceptQuotationAction(organizationId, quotation.id));
  const handleReject = (): void =>
    run(() => rejectQuotationAction(organizationId, quotation.id));
  const handleCancel = (): void =>
    run(() => cancelQuotationAction(organizationId, quotation.id));

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title={quotation.quotationNumber}
        description={customerName ?? undefined}
        icon={FileText}
      >
        {isDraft && canManage && (
          <Button asChild variant="outline">
            <Link href={editHref}>
              <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Edit
            </Link>
          </Button>
        )}
        {isDraft && canManage && (
          <Button type="button" variant="gradient" onClick={handleSubmit} loading={isPending}>
            <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Send to customer
          </Button>
        )}
        {isSentOrViewed && canApprove && (
          <Button type="button" variant="gradient" onClick={handleAccept} loading={isPending}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Accept
          </Button>
        )}
        {isSentOrViewed && canApprove && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmAction("reject")}
          >
            <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Reject
          </Button>
        )}
        {status === "accepted" && canManage && (
          <Button asChild variant="gradient">
            <Link href={convertHref}>
              <TrendingUp className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Convert to sales order
            </Link>
          </Button>
        )}
        {!isTerminal && canCancel && (
          <Button
            type="button"
            variant="ghost"
            className="text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10 hover:text-error-700 dark:hover:text-error-300"
            onClick={() => {
              setActionError(null);
              setConfirmAction("cancel");
            }}
          >
            <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
        )}
      </PageHeader>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge dot variant={QUOTATION_STATUS_VARIANT[status]}>
          {QUOTATION_STATUS_LABEL[status]}
        </Badge>
      </div>

      {actionError && (
        <p
          role="alert"
          className="text-error-700 dark:text-error-300 bg-error-50 dark:bg-error-500/10 border-error-200 dark:border-error-500/30 mt-4 rounded-lg border px-3 py-2.5 text-sm"
        >
          {actionError}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Details card */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Quotation details
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow icon={Users} label="Customer" value={customerName} />
            <InfoRow
              icon={Calendar}
              label="Quotation date"
              value={formatDate(quotation.quotationDate)}
            />
            <InfoRow
              icon={Calendar}
              label="Expiry date"
              value={formatDate(quotation.expiryDate)}
            />
            {quotation.supplyState && (
              <InfoRow
                icon={FileText}
                label="Supply state"
                value={quotation.supplyState}
              />
            )}
          </dl>
          {quotation.terms && (
            <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4">
              <dt className="text-xs text-muted-foreground">Terms</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {quotation.terms}
              </dd>
            </div>
          )}
          {quotation.notes && (
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {quotation.notes}
              </dd>
            </div>
          )}
        </Card>

        {/* Totals card */}
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Summary</h2>
          <dl className="space-y-4">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="nums text-slate-700 dark:text-slate-300">
                {formatCurrency(quotation.subtotal)}
              </dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="nums text-slate-700 dark:text-slate-300">
                −{formatCurrency(quotation.discountAmount)}
              </dd>
            </div>
            {quotation.isInterstate ? (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">IGST</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(quotation.igstAmount)}
                </dd>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">CGST</dt>
                  <dd className="nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(quotation.cgstAmount)}
                  </dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">SGST</dt>
                  <dd className="nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(quotation.sgstAmount)}
                  </dd>
                </div>
              </>
            )}
            <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
              <dt className="text-sm font-medium text-slate-900 dark:text-slate-100">Total</dt>
              <dd className="text-xl font-semibold nums text-slate-900 dark:text-slate-100">
                {formatCurrency(quotation.totalAmount)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Line items */}
      <div className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Line items
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Qty
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Unit price
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Disc %
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    GST
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {quotation.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {productNames[item.productId] ??
                        item.description ??
                        "—"}
                    </td>
                    <td className="px-3 py-2 text-right nums text-slate-700 dark:text-slate-300">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-right nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right nums text-slate-700 dark:text-slate-300">
                      {item.discountPercent}%
                    </td>
                    <td className="px-3 py-2 text-right nums text-slate-700 dark:text-slate-300">
                      {item.gstRate}%
                    </td>
                    <td className="px-3 py-2 text-right nums font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {confirmAction === "reject" && (
          <ConfirmDialog
            title="Reject quotation"
            message={`Are you sure you want to reject ${quotation.quotationNumber}? This cannot be undone.`}
            confirmLabel="Reject quotation"
            variant="destructive"
            isPending={isPending}
            error={actionError}
            onConfirm={handleReject}
            onCancel={() => setConfirmAction(null)}
          />
        )}
        {confirmAction === "cancel" && (
          <ConfirmDialog
            title="Cancel quotation"
            message={`Are you sure you want to cancel ${quotation.quotationNumber}? This cannot be undone.`}
            confirmLabel="Cancel quotation"
            variant="destructive"
            isPending={isPending}
            error={actionError}
            onConfirm={handleCancel}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
