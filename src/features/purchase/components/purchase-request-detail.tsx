"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Pencil,
  Send,
  CheckCircle2,
  XCircle,
  Ban,
  AlertTriangle,
  Building2,
  Calendar,
  ShoppingCart,
  ChevronLeft,
  ListOrdered,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/shared/error-banner";
import { KpiTile } from "@/components/shared/kpi-tile";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PR_STATUS_LABEL,
  PR_STATUS_VARIANT,
} from "@/features/purchase/utils/purchase-request-display";
import type { PrSupplierOption } from "@/features/purchase/components/purchase-request-form";
import {
  submitPurchaseRequestAction,
  approvePurchaseRequestAction,
  rejectPurchaseRequestAction,
  cancelPurchaseRequestAction,
  convertPurchaseRequestAction,
} from "@/features/purchase/actions/purchase-request.actions";
import { formatCurrency, formatDate } from "@/utils/format";
import type { PurchaseRequestWithItems } from "@/features/purchase/types/purchase-request.types";

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
            <AlertTriangle
              className="text-error-600 dark:text-error-400 h-5 w-5"
              aria-hidden="true"
            />
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
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {requestNumber}
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

        {error && <ErrorBanner message={error} className="mt-4" />}

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

        {error && <ErrorBanner message={error} className="mt-4" />}

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
  const withOrg = (path: string): string =>
    org ? `${path}?org=${org}` : path;
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
    run(() =>
      approvePurchaseRequestAction(organizationId, purchaseRequest.id)
    );
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
      {/* Back link */}
      <Link
        href={withOrg("/purchases/requests")}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Purchase requests
      </Link>

      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {purchaseRequest.requestNumber}
              </h1>
              <Badge dot variant={PR_STATUS_VARIANT[status]}>
                {PR_STATUS_LABEL[status]}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {branchName ?? "No branch"}
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
                onClick={handleSubmit}
                loading={isPending}
              >
                <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Submit
              </Button>
            )}
            {isSubmitted && canApprove && (
              <Button
                type="button"
                variant="gradient"
                size="sm"
                onClick={handleApprove}
                loading={isPending}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Approve
              </Button>
            )}
            {isSubmitted && canApprove && (
              <Button
                type="button"
                variant="outline"
                size="sm"
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
                size="sm"
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
              <Button asChild variant="outline" size="sm">
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
          icon={ListOrdered}
          label="Line items"
          displayValue={String(purchaseRequest.items.length)}
          tint="bg-gradient-brand"
          emphasis
          index={0}
        />
        <KpiTile
          icon={FileText}
          label="Est. total"
          displayValue={formatCurrency(estimatedTotal, true)}
          tint="bg-gradient-violet"
          index={1}
        />
        <KpiTile
          icon={Building2}
          label="Branch"
          displayValue={branchName ?? "—"}
          tint="bg-gradient-info"
          index={2}
        />
        <KpiTile
          icon={Calendar}
          label="Required by"
          displayValue={
            purchaseRequest.requiredDate
              ? formatDate(purchaseRequest.requiredDate)
              : "—"
          }
          tint="bg-gradient-success"
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
                    <TableHead className="text-right">Est. price</TableHead>
                    <TableHead className="text-right">Est. total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseRequest.items.map((item) => (
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
                        {formatCurrency(item.estimatedPrice, true)}
                      </TableCell>
                      <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(
                          item.quantity * item.estimatedPrice,
                          true
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </motion.div>

          {(purchaseRequest.notes ||
            (status === "rejected" && purchaseRequest.rejectedReason)) && (
            <SectionCard title="Notes" delay={0.15}>
              <div className="space-y-4">
                {purchaseRequest.notes && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Notes</dt>
                    <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                      {purchaseRequest.notes}
                    </dd>
                  </div>
                )}
                {status === "rejected" && purchaseRequest.rejectedReason && (
                  <div>
                    <dt className="text-error-600 text-xs dark:text-error-400">
                      Rejection reason
                    </dt>
                    <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                      {purchaseRequest.rejectedReason}
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
              <InfoRow icon={Building2} label="Branch" value={branchName} />
              <InfoRow
                icon={Calendar}
                label="Required by"
                value={
                  purchaseRequest.requiredDate
                    ? formatDate(purchaseRequest.requiredDate)
                    : null
                }
              />
              <InfoRow
                icon={Calendar}
                label="Created"
                value={formatDate(purchaseRequest.createdAt)}
              />
              <InfoRow
                icon={CheckCircle2}
                label="Approved by"
                value={purchaseRequest.approvedBy}
              />
              <InfoRow
                icon={Calendar}
                label="Approved at"
                value={
                  purchaseRequest.approvedAt
                    ? formatDate(purchaseRequest.approvedAt)
                    : null
                }
              />
            </dl>
          </SectionCard>

          <SectionCard title="Summary" delay={0.15}>
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
                <dd className="nums text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(estimatedTotal, true)}
                </dd>
              </div>
            </dl>
          </SectionCard>
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
