"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Truck,
  Calendar,
  Hash,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  PINV_STATUS_LABEL,
  PINV_STATUS_VARIANT,
} from "@/features/purchase/components/purchase-invoices-view";
import {
  postPurchaseInvoiceAction,
  cancelPurchaseInvoiceAction,
} from "@/features/purchase/actions/purchase-invoice.actions";
import type { PurchaseInvoiceWithItems } from "@/features/purchase/types/purchase-invoice.types";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: Date | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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
        aria-labelledby="cancel-pinv-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-4">
          <div className="bg-error-50 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle
              className="text-error-600 h-5 w-5"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2
              id="cancel-pinv-title"
              className="text-base font-semibold text-slate-900"
            >
              Cancel purchase invoice
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Are you sure you want to cancel{" "}
              <span className="font-medium text-slate-700">
                {invoiceNumber}
              </span>
              ? This cannot be undone.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="border-error-200 bg-error-50 text-error-800 mt-4 rounded-lg border px-4 py-3 text-sm"
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
// Info row
// ─────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: typeof Truck;
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
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-slate-700">{value}</dd>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────

interface PurchaseInvoiceDetailProps {
  readonly purchaseInvoice: PurchaseInvoiceWithItems;
  readonly supplierName: string | null;
  readonly productNames: Readonly<Record<string, string>>;
  readonly organizationId: string;
  readonly canManage: boolean;
  readonly canCancel: boolean;
}

export function PurchaseInvoiceDetail({
  purchaseInvoice,
  supplierName,
  productNames,
  organizationId,
  canManage,
  canCancel,
}: PurchaseInvoiceDetailProps) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { status } = purchaseInvoice;
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
      setShowCancel(false);
      router.refresh();
    });
  };

  const handlePost = (): void =>
    run(() => postPurchaseInvoiceAction(organizationId, purchaseInvoice.id));
  const handleCancel = (): void =>
    run(() => cancelPurchaseInvoiceAction(organizationId, purchaseInvoice.id));

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title={purchaseInvoice.invoiceNumber}
        description={supplierName ?? undefined}
        icon={FileText}
      >
        {isDraft && canManage && (
          <Button type="button" onClick={handlePost} loading={isPending}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Post
          </Button>
        )}
        {isDraft && canCancel && (
          <Button
            type="button"
            variant="ghost"
            className="text-error-600 hover:bg-error-50 hover:text-error-700"
            onClick={() => {
              setActionError(null);
              setShowCancel(true);
            }}
          >
            <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
        )}
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge variant={PINV_STATUS_VARIANT[status]}>
          {PINV_STATUS_LABEL[status]}
        </Badge>
      </div>

      {actionError && (
        <p
          role="alert"
          className="text-error-700 bg-error-50 border-error-200 mt-4 rounded-lg border px-3 py-2.5 text-sm"
        >
          {actionError}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Details */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Invoice details
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow icon={Truck} label="Supplier" value={supplierName} />
            <InfoRow
              icon={Hash}
              label="Supplier invoice no."
              value={purchaseInvoice.supplierInvoiceNumber}
            />
            <InfoRow
              icon={Calendar}
              label="Invoice date"
              value={formatDate(purchaseInvoice.invoiceDate)}
            />
            <InfoRow
              icon={Calendar}
              label="Due date"
              value={formatDate(purchaseInvoice.dueDate)}
            />
          </dl>
          {purchaseInvoice.notes && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {purchaseInvoice.notes}
              </dd>
            </div>
          )}
        </Card>

        {/* Totals */}
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Summary</h2>
          <dl className="space-y-4">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums text-slate-700">
                {formatCurrency(purchaseInvoice.subtotal)}
              </dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="tabular-nums text-slate-700">
                {formatCurrency(purchaseInvoice.taxAmount)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3">
              <dt className="text-sm font-medium text-slate-900">Total</dt>
              <dd className="text-xl font-semibold tabular-nums text-slate-900">
                {formatCurrency(purchaseInvoice.totalAmount)}
              </dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Amount paid</dt>
              <dd className="tabular-nums text-slate-700">
                {formatCurrency(purchaseInvoice.amountPaid)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Items */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Line items</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Qty
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Unit price
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Tax
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseInvoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-700">
                      {productNames[item.productId] ?? item.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {item.taxRate}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
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
        {showCancel && (
          <CancelDialog
            invoiceNumber={purchaseInvoice.invoiceNumber}
            isPending={isPending}
            error={actionError}
            onConfirm={handleCancel}
            onCancel={() => setShowCancel(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
