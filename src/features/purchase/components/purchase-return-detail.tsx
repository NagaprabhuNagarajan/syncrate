"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Undo2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Truck,
  Warehouse,
  Calendar,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  PRET_STATUS_LABEL,
  PRET_STATUS_VARIANT,
} from "@/features/purchase/components/purchase-returns-view";
import { PURCHASE_RETURN_REASON_LABELS } from "@/features/purchase/schemas/purchase-return.schemas";
import {
  completePurchaseReturnAction,
  cancelPurchaseReturnAction,
} from "@/features/purchase/actions/purchase-return.actions";
import type { PurchaseReturnWithItems } from "@/features/purchase/types/purchase-return.types";

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
  readonly returnNumber: string;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function CancelDialog({
  returnNumber,
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
        aria-labelledby="cancel-pret-title"
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
              id="cancel-pret-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Cancel purchase return
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to cancel{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{returnNumber}</span>?
              This cannot be undone.
            </p>
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
            Keep return
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Cancel return
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
        <dd className="text-slate-700 dark:text-slate-300">{value}</dd>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────

interface PurchaseReturnDetailProps {
  readonly purchaseReturn: PurchaseReturnWithItems;
  readonly supplierName: string | null;
  readonly warehouseName: string | null;
  readonly productNames: Readonly<Record<string, string>>;
  readonly organizationId: string;
  readonly canComplete: boolean;
  readonly canCancel: boolean;
  readonly canManage: boolean;
}

export function PurchaseReturnDetail({
  purchaseReturn,
  supplierName,
  warehouseName,
  productNames,
  organizationId,
  canComplete,
  canCancel,
}: PurchaseReturnDetailProps) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { status } = purchaseReturn;
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

  const handleComplete = (): void =>
    run(() =>
      completePurchaseReturnAction(organizationId, purchaseReturn.id)
    );
  const handleCancel = (): void =>
    run(() => cancelPurchaseReturnAction(organizationId, purchaseReturn.id));

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title={purchaseReturn.returnNumber}
        description={supplierName ?? undefined}
        icon={Undo2}
      >
        {isDraft && canComplete && (
          <Button type="button" onClick={handleComplete} loading={isPending}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Complete
          </Button>
        )}
        {isDraft && canCancel && (
          <Button
            type="button"
            variant="ghost"
            className="text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10 hover:text-error-700 dark:hover:text-error-300"
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
        <Badge variant={PRET_STATUS_VARIANT[status]}>
          {PRET_STATUS_LABEL[status]}
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Details */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Return details
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow icon={Truck} label="Supplier" value={supplierName} />
            <InfoRow icon={Warehouse} label="Warehouse" value={warehouseName} />
            <InfoRow
              icon={Calendar}
              label="Return date"
              value={formatDate(purchaseReturn.returnDate)}
            />
            <InfoRow
              icon={Tag}
              label="Reason"
              value={PURCHASE_RETURN_REASON_LABELS[purchaseReturn.reason]}
            />
          </dl>
          {purchaseReturn.notes && (
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {purchaseReturn.notes}
              </dd>
            </div>
          )}
        </Card>

        {/* Totals */}
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Summary</h2>
          <dl className="space-y-4">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                {formatCurrency(purchaseReturn.subtotal)}
              </dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                {formatCurrency(purchaseReturn.taxAmount)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
              <dt className="text-sm font-medium text-slate-900 dark:text-slate-100">Total</dt>
              <dd className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(purchaseReturn.totalAmount)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Items */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Line items</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {purchaseReturn.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {productNames[item.productId] ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {item.taxRate}%
                    </td>
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
        {showCancel && (
          <CancelDialog
            returnNumber={purchaseReturn.returnNumber}
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
