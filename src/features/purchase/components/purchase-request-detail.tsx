"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardList,
  Pencil,
  Send,
  CheckCircle2,
  XCircle,
  Ban,
  AlertTriangle,
  Building2,
  Calendar,
  ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import {
  PR_STATUS_LABEL,
  PR_STATUS_VARIANT,
} from "@/features/purchase/components/purchase-requests-view";
import type { PrSupplierOption } from "@/features/purchase/components/purchase-request-form";
import {
  submitPurchaseRequestAction,
  approvePurchaseRequestAction,
  rejectPurchaseRequestAction,
  cancelPurchaseRequestAction,
  convertPurchaseRequestAction,
} from "@/features/purchase/actions/purchase-request.actions";
import type { PurchaseRequestWithItems } from "@/features/purchase/types/purchase-request.types";

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
// Info row
// ─────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: typeof Building2;
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
// Cancel confirmation dialog
// ─────────────────────────────────────────────────────────────

interface CancelDialogProps {
  readonly requestNumber: string;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function CancelDialog({
  requestNumber,
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
        aria-labelledby="cancel-pr-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-4">
          <div className="bg-error-50 dark:bg-error-500/10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle className="text-error-600 dark:text-error-400 h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="cancel-pr-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Cancel purchase request
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to cancel{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{requestNumber}</span>
              ? This cannot be undone.
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
            Keep request
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Cancel request
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Reject dialog (with reason)
// ─────────────────────────────────────────────────────────────

interface RejectDialogProps {
  readonly requestNumber: string;
  readonly reason: string;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onReasonChange: (value: string) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function RejectDialog({
  requestNumber,
  reason,
  isPending,
  error,
  onReasonChange,
  onConfirm,
  onCancel,
}: RejectDialogProps) {
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
        aria-labelledby="reject-pr-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <h2
          id="reject-pr-title"
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          Reject {requestNumber}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Provide a reason so the requester understands why this was rejected.
        </p>

        <div className="mt-4">
          <label
            htmlFor="reject-reason"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Reason
          </label>
          <Textarea
            id="reject-reason"
            rows={3}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="e.g. Budget not approved this quarter"
          />
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
            Keep request
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Reject request
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Convert dialog (supplier picker)
// ─────────────────────────────────────────────────────────────

interface ConvertDialogProps {
  readonly requestNumber: string;
  readonly suppliers: readonly PrSupplierOption[];
  readonly supplierId: string;
  readonly isPending: boolean;
  readonly error: string | null;
  readonly onSupplierChange: (value: string) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ConvertDialog({
  requestNumber,
  suppliers,
  supplierId,
  isPending,
  error,
  onSupplierChange,
  onConfirm,
  onCancel,
}: ConvertDialogProps) {
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
        aria-labelledby="convert-pr-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <h2
          id="convert-pr-title"
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          Convert {requestNumber} to a purchase order
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Choose the supplier to raise the purchase order against. The line
          items and estimated prices carry over.
        </p>

        <div className="mt-4">
          <label
            htmlFor="convert-supplier"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Supplier
          </label>
          <select
            id="convert-supplier"
            value={supplierId}
            onChange={(e) => onSupplierChange(e.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">— Select supplier —</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
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
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            loading={isPending}
            disabled={isPending}
          >
            Create purchase order
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────

interface PurchaseRequestDetailProps {
  readonly purchaseRequest: PurchaseRequestWithItems;
  readonly branchName: string | null;
  readonly productNames: Readonly<Record<string, string>>;
  readonly suppliers: readonly PrSupplierOption[];
  readonly organizationId: string;
  readonly canManage: boolean;
  readonly canApprove: boolean;
  readonly canCancel: boolean;
}

export function PurchaseRequestDetail({
  purchaseRequest,
  branchName,
  productNames,
  suppliers,
  organizationId,
  canManage,
  canApprove,
  canCancel,
}: PurchaseRequestDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [isPending, startTransition] = useTransition();

  const org = searchParams.get("org");
  const withOrg = (path: string): string => (org ? `${path}?org=${org}` : path);
  const editHref = withOrg(`/purchases/requests/${purchaseRequest.id}/edit`);
  const poHref = purchaseRequest.convertedPoId
    ? withOrg(`/purchases/${purchaseRequest.convertedPoId}`)
    : null;

  const { status } = purchaseRequest;
  const isDraft = status === "draft";
  const isSubmitted = status === "submitted";
  const isApproved = status === "approved";
  const canBeCancelled = status !== "converted" && status !== "cancelled";

  const estimatedTotal = purchaseRequest.items.reduce(
    (sum, item) => sum + item.quantity * item.estimatedPrice,
    0
  );

  const run = (
    action: () => Promise<{ success: boolean; error?: { message: string } }>,
    onSuccess?: () => void
  ): void => {
    setActionError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setActionError(result.error?.message ?? "Action failed");
        return;
      }
      setShowCancel(false);
      setShowReject(false);
      setShowConvert(false);
      onSuccess?.();
      router.refresh();
    });
  };

  const handleSubmit = (): void =>
    run(() => submitPurchaseRequestAction(organizationId, purchaseRequest.id));
  const handleApprove = (): void =>
    run(() => approvePurchaseRequestAction(organizationId, purchaseRequest.id));
  const handleCancel = (): void =>
    run(() => cancelPurchaseRequestAction(organizationId, purchaseRequest.id));
  const handleReject = (): void =>
    run(() =>
      rejectPurchaseRequestAction(
        organizationId,
        purchaseRequest.id,
        rejectReason
      )
    );
  const handleConvert = (): void =>
    run(
      () =>
        convertPurchaseRequestAction(
          organizationId,
          purchaseRequest.id,
          supplierId
        ),
      () => {
        if (poHref === null) {
          router.push(withOrg("/purchases"));
        }
      }
    );

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title={purchaseRequest.requestNumber}
        description={branchName ?? undefined}
        icon={ClipboardList}
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
            Submit
          </Button>
        )}
        {isSubmitted && canApprove && (
          <Button type="button" variant="gradient" onClick={handleApprove} loading={isPending}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Approve
          </Button>
        )}
        {isSubmitted && canApprove && (
          <Button
            type="button"
            variant="outline"
            className="text-error-600 hover:bg-error-50 hover:text-error-700 dark:text-error-400 dark:hover:bg-error-500/10 dark:hover:text-error-300"
            onClick={() => {
              setActionError(null);
              setShowReject(true);
            }}
          >
            <Ban className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Reject
          </Button>
        )}
        {isApproved && canManage && (
          <Button
            type="button"
            variant="gradient"
            onClick={() => {
              setActionError(null);
              setShowConvert(true);
            }}
          >
            <ShoppingCart className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Convert to PO
          </Button>
        )}
        {poHref && (
          <Button asChild variant="outline">
            <Link href={poHref}>
              <ShoppingCart className="mr-1.5 h-4 w-4" aria-hidden="true" />
              View purchase order
            </Link>
          </Button>
        )}
        {canBeCancelled && canCancel && (
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge dot variant={PR_STATUS_VARIANT[status]}>
          {PR_STATUS_LABEL[status]}
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

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Details */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Request details
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow icon={Building2} label="Building2" value={branchName} />
            <InfoRow
              icon={Calendar}
              label="Required by"
              value={formatDate(purchaseRequest.requiredDate)}
            />
            <InfoRow
              icon={Calendar}
              label="Created"
              value={formatDate(purchaseRequest.createdAt)}
            />
          </dl>
          {purchaseRequest.notes && (
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {purchaseRequest.notes}
              </dd>
            </div>
          )}
          {status === "rejected" && purchaseRequest.rejectedReason && (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <dt className="text-error-600 text-xs dark:text-error-400">Rejection reason</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {purchaseRequest.rejectedReason}
              </dd>
            </div>
          )}
        </Card>

        {/* Estimated total */}
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Summary</h2>
          <dl className="space-y-4">
            <div className="flex justify-between text-sm">
              <dt className="text-muted-foreground">Line items</dt>
              <dd className="nums text-slate-700 dark:text-slate-300">
                {purchaseRequest.items.length}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <dt className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Estimated total
              </dt>
              <dd className="text-xl font-semibold nums text-slate-900 dark:text-slate-100">
                {formatCurrency(estimatedTotal)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Items */}
      <div className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Line items</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Qty
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Est. price
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Est. total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {purchaseRequest.items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {productNames[item.productId] ?? item.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right nums text-slate-700 dark:text-slate-300">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-right nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(item.estimatedPrice)}
                    </td>
                    <td className="px-3 py-2 text-right nums font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.quantity * item.estimatedPrice)}
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
            requestNumber={purchaseRequest.requestNumber}
            isPending={isPending}
            error={actionError}
            onConfirm={handleCancel}
            onCancel={() => setShowCancel(false)}
          />
        )}
        {showReject && (
          <RejectDialog
            requestNumber={purchaseRequest.requestNumber}
            reason={rejectReason}
            isPending={isPending}
            error={actionError}
            onReasonChange={setRejectReason}
            onConfirm={handleReject}
            onCancel={() => setShowReject(false)}
          />
        )}
        {showConvert && (
          <ConvertDialog
            requestNumber={purchaseRequest.requestNumber}
            suppliers={suppliers}
            supplierId={supplierId}
            isPending={isPending}
            error={actionError}
            onSupplierChange={setSupplierId}
            onConfirm={handleConvert}
            onCancel={() => setShowConvert(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
