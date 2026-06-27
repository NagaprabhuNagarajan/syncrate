"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  TrendingUp,
  Pencil,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Users,
  Warehouse,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  SO_STATUS_LABEL,
  SO_STATUS_VARIANT,
} from "@/features/sales/components/sales-orders-view";
import {
  submitSalesOrderAction,
  approveSalesOrderAction,
  cancelSalesOrderAction,
} from "@/features/sales/actions/sales-order.actions";
import type { SalesOrderWithItems } from "@/features/sales/types/sales-order.types";

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
// Confirm dialog
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
              id="confirm-dialog-title"
              className="text-base font-semibold text-slate-900"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{message}</p>
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
        <dd className="text-slate-700">{value}</dd>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────

interface SalesOrderDetailProps {
  readonly salesOrder: SalesOrderWithItems;
  readonly customerName: string | null;
  readonly warehouseName: string | null;
  readonly productNames: Readonly<Record<string, string>>;
  readonly organizationId: string;
  readonly canManage: boolean;
  readonly canApprove: boolean;
  readonly canCancel: boolean;
}

export function SalesOrderDetail({
  salesOrder,
  customerName,
  warehouseName,
  productNames,
  organizationId,
  canManage,
  canApprove,
  canCancel,
}: SalesOrderDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [isPending, startTransition] = useTransition();

  const org = searchParams.get("org");
  const withOrg = (path: string): string => (org ? `${path}?org=${org}` : path);
  const editHref = withOrg(`/sales/orders/${salesOrder.id}/edit`);
  const newInvoiceHref = withOrg(
    `/sales/invoices/new?from=so&soId=${salesOrder.id}`
  );

  const { status } = salesOrder;
  const isDraft = status === "draft";
  const isSubmitted = status === "submitted";
  const isTerminal = status === "completed" || status === "cancelled";
  const canInvoice =
    canManage &&
    (status === "approved" ||
      status === "processing" ||
      status === "partially_delivered");

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
    run(() => submitSalesOrderAction(organizationId, salesOrder.id));
  const handleApprove = (): void =>
    run(() => approveSalesOrderAction(organizationId, salesOrder.id));
  const handleCancel = (): void =>
    run(() => cancelSalesOrderAction(organizationId, salesOrder.id));

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title={salesOrder.soNumber}
        description={customerName ?? undefined}
        icon={TrendingUp}
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
        {canInvoice && (
          <Button asChild>
            <Link href={newInvoiceHref}>
              <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Convert to invoice
            </Link>
          </Button>
        )}
        {!isTerminal && canCancel && (
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
        <Badge variant={SO_STATUS_VARIANT[status]}>
          {SO_STATUS_LABEL[status]}
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
        {/* Details card */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Order details
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow icon={Users} label="Customer" value={customerName} />
            <InfoRow
              icon={Warehouse}
              label="Warehouse"
              value={warehouseName}
            />
            <InfoRow
              icon={Calendar}
              label="Order date"
              value={formatDate(salesOrder.orderDate)}
            />
            <InfoRow
              icon={Calendar}
              label="Delivery date"
              value={formatDate(salesOrder.deliveryDate)}
            />
            <InfoRow
              icon={TrendingUp}
              label="Payment terms"
              value={
                salesOrder.paymentTermsDays
                  ? `${salesOrder.paymentTermsDays} days`
                  : null
              }
            />
            {salesOrder.supplyState && (
              <InfoRow
                icon={FileText}
                label="Supply state"
                value={salesOrder.supplyState}
              />
            )}
          </dl>
          {salesOrder.terms && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <dt className="text-xs text-muted-foreground">Terms</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {salesOrder.terms}
              </dd>
            </div>
          )}
          {salesOrder.notes && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {salesOrder.notes}
              </dd>
            </div>
          )}
        </Card>

        {/* Totals card */}
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Summary</h2>
          <dl className="space-y-4">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums text-slate-700">
                {formatCurrency(salesOrder.subtotal)}
              </dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular-nums text-slate-700">
                −{formatCurrency(salesOrder.discountAmount)}
              </dd>
            </div>
            {salesOrder.isInterstate ? (
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">IGST</dt>
                <dd className="tabular-nums text-slate-700">
                  {formatCurrency(salesOrder.igstAmount)}
                </dd>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">CGST</dt>
                  <dd className="tabular-nums text-slate-700">
                    {formatCurrency(salesOrder.cgstAmount)}
                  </dd>
                </div>
                <div className="flex justify-between text-sm">
                  <dt className="text-muted-foreground">SGST</dt>
                  <dd className="tabular-nums text-slate-700">
                    {formatCurrency(salesOrder.sgstAmount)}
                  </dd>
                </div>
              </>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-3">
              <dt className="text-sm font-medium text-slate-900">Total</dt>
              <dd className="text-xl font-semibold tabular-nums text-slate-900">
                {formatCurrency(salesOrder.totalAmount)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Line items */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Line items
        </h2>
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
                    Delivered
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Unit price
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Disc %
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    GST
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-700">
                      {productNames[item.productId] ??
                        item.description ??
                        "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                      {item.deliveredQty}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {item.discountPercent}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {item.gstRate}%
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
          <ConfirmDialog
            title="Cancel sales order"
            message={`Are you sure you want to cancel ${salesOrder.soNumber}? This cannot be undone.`}
            confirmLabel="Cancel order"
            variant="destructive"
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
