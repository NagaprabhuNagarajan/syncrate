"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShoppingCart,
  Pencil,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Truck,
  Warehouse,
  Calendar,
  PackageCheck,
  FileText,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  PO_STATUS_LABEL,
  PO_STATUS_VARIANT,
} from "@/features/purchase/components/purchase-orders-view";
import {
  submitPurchaseOrderAction,
  approvePurchaseOrderAction,
  cancelPurchaseOrderAction,
} from "@/features/purchase/actions/purchase-order.actions";
import type { PurchaseOrderWithItems } from "@/features/purchase/types/purchase-order.types";

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
  readonly poNumber: string;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function CancelDialog({
  poNumber,
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
        aria-labelledby="cancel-po-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className="bg-error-50 dark:bg-error-500/10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle className="text-error-600 dark:text-error-400 h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="cancel-po-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Cancel purchase order
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to cancel{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{poNumber}</span>?
              This cannot be undone.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="border-error-200 bg-error-50 text-error-800 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300 mt-4 rounded-lg border px-4 py-3 text-sm"
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
            Keep order
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Cancel order
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

interface PurchaseOrderDetailProps {
  readonly purchaseOrder: PurchaseOrderWithItems;
  readonly supplierName: string | null;
  readonly warehouseName: string | null;
  readonly productNames: Readonly<Record<string, string>>;
  readonly organizationId: string;
  readonly canManage: boolean;
  readonly canApprove: boolean;
  readonly canCancel: boolean;
  readonly canReceive: boolean;
}

export function PurchaseOrderDetail({
  purchaseOrder,
  supplierName,
  warehouseName,
  productNames,
  organizationId,
  canManage,
  canApprove,
  canCancel,
  canReceive,
}: PurchaseOrderDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [isPending, startTransition] = useTransition();

  const org = searchParams.get("org");
  const withOrg = (path: string): string => (org ? `${path}?org=${org}` : path);
  const editHref = withOrg(`/purchases/${purchaseOrder.id}/edit`);
  const receiveHref = withOrg(`/purchases/${purchaseOrder.id}/receive`);
  const newInvoiceHref = withOrg("/purchases/invoices/new");
  const newReturnHref = withOrg("/purchases/returns/new");

  const { status } = purchaseOrder;
  const isDraft = status === "draft";
  const isSubmitted = status === "submitted";
  const isTerminal = status === "completed" || status === "cancelled";
  const canReceiveNow =
    canReceive &&
    (status === "approved" ||
      status === "ordered" ||
      status === "partially_received");
  const canCreateDocuments =
    canManage && status !== "draft" && status !== "cancelled";

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

  const handleSubmit = (): void =>
    run(() => submitPurchaseOrderAction(organizationId, purchaseOrder.id));
  const handleApprove = (): void =>
    run(() => approvePurchaseOrderAction(organizationId, purchaseOrder.id));
  const handleCancel = (): void =>
    run(() => cancelPurchaseOrderAction(organizationId, purchaseOrder.id));

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title={purchaseOrder.poNumber}
        description={supplierName ?? undefined}
        icon={ShoppingCart}
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
          <Button type="button" onClick={handleSubmit} loading={isPending}>
            <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Submit
          </Button>
        )}
        {isSubmitted && canApprove && (
          <Button type="button" onClick={handleApprove} loading={isPending}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Approve
          </Button>
        )}
        {canReceiveNow && (
          <Button asChild>
            <Link href={receiveHref}>
              <PackageCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Receive goods
            </Link>
          </Button>
        )}
        {canCreateDocuments && (
          <Button asChild variant="outline">
            <Link href={newInvoiceHref}>
              <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Create invoice
            </Link>
          </Button>
        )}
        {canCreateDocuments && (
          <Button asChild variant="outline">
            <Link href={newReturnHref}>
              <Undo2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Create return
            </Link>
          </Button>
        )}
        {!isTerminal && canCancel && (
          <Button
            type="button"
            variant="ghost"
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
      </PageHeader>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge variant={PO_STATUS_VARIANT[status]}>
          {PO_STATUS_LABEL[status]}
        </Badge>
      </div>

      {actionError && (
        <p
          role="alert"
          className="text-error-700 bg-error-50 border-error-200 dark:text-error-300 dark:bg-error-500/10 dark:border-error-500/30 mt-4 rounded-lg border px-3 py-2.5 text-sm"
        >
          {actionError}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Details */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Order details
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow icon={Truck} label="Supplier" value={supplierName} />
            <InfoRow icon={Warehouse} label="Warehouse" value={warehouseName} />
            <InfoRow
              icon={Calendar}
              label="Order date"
              value={formatDate(purchaseOrder.orderDate)}
            />
            <InfoRow
              icon={Calendar}
              label="Expected delivery"
              value={formatDate(purchaseOrder.expectedDeliveryDate)}
            />
          </dl>
          {purchaseOrder.terms && (
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <dt className="text-xs text-muted-foreground">Terms</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {purchaseOrder.terms}
              </dd>
            </div>
          )}
          {purchaseOrder.notes && (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {purchaseOrder.notes}
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
                {formatCurrency(purchaseOrder.subtotal)}
              </dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                −{formatCurrency(purchaseOrder.discountAmount)}
              </dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                {formatCurrency(purchaseOrder.taxAmount)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <dt className="text-sm font-medium text-slate-900 dark:text-slate-100">Total</dt>
              <dd className="text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(purchaseOrder.totalAmount)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Items */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Line items</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
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
                    Disc %
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
                {purchaseOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {productNames[item.productId] ?? item.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {item.discountPercent}%
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
            poNumber={purchaseOrder.poNumber}
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
