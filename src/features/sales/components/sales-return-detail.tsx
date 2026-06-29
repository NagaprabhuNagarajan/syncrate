"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  Hash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  SRETURN_STATUS_LABEL,
  SRETURN_STATUS_VARIANT,
} from "@/features/sales/components/sales-returns-view";
import {
  completeSalesReturnAction,
  cancelSalesReturnAction,
} from "@/features/sales/actions/sales-return.actions";
import type { SalesReturnWithItems } from "@/features/sales/types/sales-return.types";

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────

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

const REASON_LABEL: Record<string, string> = {
  damaged: "Damaged",
  wrong_product: "Wrong product",
  expired: "Expired",
  customer_rejection: "Customer rejection",
  warranty: "Warranty",
  other: "Other",
};

// ─────────────────────────────────────────────────────────────
// Cancel dialog
// ─────────────────────────────────────────────────────────────

interface ActionDialogProps {
  readonly title: string;
  readonly description: React.ReactNode;
  readonly confirmLabel: string;
  readonly confirmVariant?: "destructive" | "default";
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

function ActionDialog({
  title,
  description,
  confirmLabel,
  confirmVariant = "destructive",
  isPending,
  error,
  onConfirm,
  onClose,
}: ActionDialogProps) {
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
        aria-labelledby="action-dialog-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl"
      >
        <div className="flex items-start gap-4">
          <div className="bg-error-50 dark:bg-error-500/10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle className="text-error-600 dark:text-error-400 h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="action-dialog-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>

        {error && (
          <div className="border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-800 dark:text-error-300 mt-4 rounded-lg border px-4 py-3 text-sm" role="alert">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Keep return
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
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
  readonly icon: typeof User;
  readonly label: string;
  readonly value: string | null;
}) {
  if (!value) {return null;}
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-slate-700 dark:text-slate-300">{value}</dd>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface SalesReturnDetailProps {
  readonly salesReturn: SalesReturnWithItems;
  readonly customerName: string | null;
  readonly productNames: Readonly<Record<string, string>>;
  readonly organizationId: string;
  readonly canManage: boolean;
}

type DialogMode = "complete" | "cancel" | null;

export function SalesReturnDetail({
  salesReturn,
  customerName,
  productNames,
  organizationId,
  canManage,
}: SalesReturnDetailProps) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [isPending, startTransition] = useTransition();

  const { status } = salesReturn;
  const isDraft = status === "draft";

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
      setDialog(null);
      router.refresh();
    });
  };

  const handleComplete = (): void =>
    run(() => completeSalesReturnAction(organizationId, salesReturn.id));

  const handleCancel = (): void =>
    run(() => cancelSalesReturnAction(organizationId, salesReturn.id));

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title={salesReturn.returnNumber}
        description={customerName ?? undefined}
        icon={RotateCcw}
      >
        {isDraft && canManage && (
          <Button
            type="button"
            onClick={() => { setActionError(null); setDialog("complete"); }}
            loading={isPending}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Complete return
          </Button>
        )}
        {isDraft && canManage && (
          <Button
            type="button"
            variant="ghost"
            className="text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10 hover:text-error-700 dark:hover:text-error-300"
            onClick={() => { setActionError(null); setDialog("cancel"); }}
          >
            <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
        )}
      </PageHeader>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant={SRETURN_STATUS_VARIANT[status]}>
          {SRETURN_STATUS_LABEL[status]}
        </Badge>
      </div>

      {actionError && (
        <p role="alert" className="text-error-700 dark:text-error-300 bg-error-50 dark:bg-error-500/10 border-error-200 dark:border-error-500/30 mt-4 rounded-lg border px-3 py-2.5 text-sm">
          {actionError}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Details */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Return details</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow icon={User} label="Customer" value={customerName} />
            <InfoRow
              icon={Hash}
              label="Return reason"
              value={REASON_LABEL[salesReturn.reason] ?? salesReturn.reason}
            />
            <InfoRow
              icon={Calendar}
              label="Return date"
              value={formatDate(salesReturn.returnDate)}
            />
            {salesReturn.invoiceId && (
              <InfoRow icon={Hash} label="Invoice ref." value={salesReturn.invoiceId} />
            )}
          </dl>
          {salesReturn.notes && (
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">{salesReturn.notes}</dd>
            </div>
          )}
        </Card>

        {/* Totals */}
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Credit summary</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums text-slate-700 dark:text-slate-300">{formatCurrency(salesReturn.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="tabular-nums text-slate-700 dark:text-slate-300">{formatCurrency(salesReturn.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
              <dt className="text-base font-bold text-slate-900 dark:text-slate-100">Total credit</dt>
              <dd className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(salesReturn.totalAmount)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Line items */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Line items</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Product</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Qty</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Unit price</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Tax %</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {salesReturn.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {productNames[item.productId] ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{item.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">{item.taxRate}%</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
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
        {dialog === "complete" && (
          <ActionDialog
            title="Complete return"
            description={
              <>
                Are you sure you want to complete{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">{salesReturn.returnNumber}</span>?
                This will restore inventory and credit the customer ledger.
              </>
            }
            confirmLabel="Complete return"
            confirmVariant="default"
            isPending={isPending}
            error={actionError}
            onConfirm={handleComplete}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog === "cancel" && (
          <ActionDialog
            title="Cancel return"
            description={
              <>
                Are you sure you want to cancel{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">{salesReturn.returnNumber}</span>?
                This cannot be undone.
              </>
            }
            confirmLabel="Cancel return"
            confirmVariant="destructive"
            isPending={isPending}
            error={actionError}
            onConfirm={handleCancel}
            onClose={() => setDialog(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
