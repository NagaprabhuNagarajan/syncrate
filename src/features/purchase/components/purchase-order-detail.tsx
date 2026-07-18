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
  AlertTriangle,
  Truck,
  Building2,
  Calendar,
  PackageCheck,
  FileText,
  Undo2,
  ChevronLeft,
  Receipt,
  Percent,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/shared/error-banner";
import { KpiTile } from "@/components/shared/kpi-tile";
import { StatusBadge } from "@/components/shared/status-badge";
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
  submitPurchaseOrderAction,
  approvePurchaseOrderAction,
  orderPurchaseOrderAction,
  cancelPurchaseOrderAction,
} from "@/features/purchase/actions/purchase-order.actions";
import { PO_STATUS } from "@/features/purchase/utils/purchase-order-display";
import { formatCurrency, formatDate } from "@/utils/format";
import type { PurchaseOrderWithItems } from "@/features/purchase/types/purchase-order.types";
import type { BillListItem } from "@/features/purchase/types/bill.types";
import type { PurchaseReturnListItem } from "@/features/purchase/types/purchase-return.types";
import type { GoodsReceiptListItem } from "@/features/purchase/types/goods-receipt.types";
import { BILL_STATUS } from "@/features/purchase/utils/bill-display";
import { PRET_STATUS } from "@/features/purchase/utils/purchase-return-display";
import { GRN_STATUS } from "@/features/purchase/utils/goods-receipt-display";

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
            <AlertTriangle
              className="text-error-600 dark:text-error-400 h-5 w-5"
              aria-hidden="true"
            />
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
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {poNumber}
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

interface LinkedDocRow {
  readonly id: string;
  /** Detail link, when the document has its own page (goods receipts don't). */
  readonly href?: string;
  readonly number: string;
  readonly date: string;
  /** Pre-formatted trailing value (e.g. a currency total or a quantity). */
  readonly trailing?: string;
  readonly statusLabel: string;
  readonly statusVariant: BadgeProps["variant"];
}

function LinkedDocTable({
  rows,
  trailingLabel,
}: {
  readonly rows: readonly LinkedDocRow[];
  /** Header for the trailing column; omit to hide it. */
  readonly trailingLabel?: string;
}) {
  return (
    <Table wrapperClassName="shadow-none">
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          {trailingLabel && (
            <TableHead className="text-right">{trailingLabel}</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              {row.href ? (
                <Link
                  href={row.href}
                  className="font-mono text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
                >
                  {row.number}
                </Link>
              ) : (
                <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                  {row.number}
                </span>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap text-slate-600 dark:text-slate-400">
              {row.date}
            </TableCell>
            <TableCell>
              <Badge variant={row.statusVariant}>{row.statusLabel}</Badge>
            </TableCell>
            {trailingLabel && (
              <TableCell className="nums text-right font-medium text-slate-700 dark:text-slate-300">
                {row.trailing}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface PurchaseOrderDetailProps {
  readonly purchaseOrder: PurchaseOrderWithItems;
  readonly supplierName: string | null;
  readonly branchName: string | null;
  readonly productNames: Readonly<Record<string, string>>;
  readonly linkedBills: readonly BillListItem[];
  readonly linkedReturns: readonly PurchaseReturnListItem[];
  readonly linkedReceipts: readonly GoodsReceiptListItem[];
  /** Resolved display name of the approver (falls back to the id). */
  readonly approvedByName?: string | null;
  readonly organizationId: string;
  readonly canManage: boolean;
  readonly canApprove: boolean;
  readonly canCancel: boolean;
  readonly canReceive: boolean;
}

export function PurchaseOrderDetail({
  purchaseOrder,
  supplierName,
  branchName,
  productNames,
  linkedBills,
  linkedReturns,
  linkedReceipts,
  approvedByName,
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
  const withOrg = (path: string): string =>
    org ? `${path}?org=${org}` : path;
  const editHref = withOrg(`/purchases/${purchaseOrder.id}/edit`);
  const receiveHref = withOrg(`/purchases/${purchaseOrder.id}/receive`);
  const newBillHref = withOrg(
    `/bills/new?fromPurchaseOrder=${purchaseOrder.id}`
  );
  const newReturnHref = withOrg(
    `/purchases/returns/new?fromPurchaseOrder=${purchaseOrder.id}`
  );

  const { status } = purchaseOrder;
  const isDraft = status === "draft";
  const isSubmitted = status === "submitted";
  const isApproved = status === "approved";
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
  const handleOrder = (): void =>
    run(() => orderPurchaseOrderAction(organizationId, purchaseOrder.id));
  const handleCancel = (): void =>
    run(() => cancelPurchaseOrderAction(organizationId, purchaseOrder.id));

  return (
    <div className="p-4 lg:p-6">
      {/* Back link */}
      <Link
        href={withOrg("/purchases")}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Purchase orders
      </Link>

      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {purchaseOrder.poNumber}
              </h1>
              <StatusBadge {...PO_STATUS[status]} />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {supplierName ?? "No supplier"}
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
            {isApproved && canManage && (
              <Button
                type="button"
                variant="gradient"
                size="sm"
                onClick={handleOrder}
                loading={isPending}
              >
                <Truck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Mark as ordered
              </Button>
            )}
            {canReceiveNow && (
              <Button asChild variant="gradient" size="sm">
                <Link href={receiveHref}>
                  <PackageCheck
                    className="mr-1.5 h-4 w-4"
                    aria-hidden="true"
                  />
                  Receive goods
                </Link>
              </Button>
            )}
            {canCreateDocuments && (
              <Button asChild variant="outline" size="sm">
                <Link href={newBillHref}>
                  <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Create bill
                </Link>
              </Button>
            )}
            {canCreateDocuments && (
              <Button asChild variant="outline" size="sm">
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
          value={purchaseOrder.totalAmount}
          tint="bg-gradient-brand"
          emphasis
          index={0}
        />
        <KpiTile
          icon={Wallet}
          label="Subtotal"
          value={purchaseOrder.subtotal}
          tint="bg-gradient-violet"
          index={1}
        />
        <KpiTile
          icon={Percent}
          label="Tax"
          value={purchaseOrder.taxAmount}
          tint="bg-gradient-info"
          index={2}
        />
        <KpiTile
          icon={Calendar}
          label="Order date"
          value={0}
          displayValue={formatDate(purchaseOrder.orderDate)}
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
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Disc %</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrder.items.map((item) => (
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
                        {item.discountPercent}%
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

          {(purchaseOrder.terms || purchaseOrder.notes) && (
            <SectionCard title="Terms & notes" delay={0.15}>
              <div className="space-y-4">
                {purchaseOrder.terms && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Terms</dt>
                    <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                      {purchaseOrder.terms}
                    </dd>
                  </div>
                )}
                {purchaseOrder.notes && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Notes</dt>
                    <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                      {purchaseOrder.notes}
                    </dd>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Linked documents" delay={0.2}>
            {linkedReceipts.length === 0 &&
            linkedBills.length === 0 &&
            linkedReturns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No goods receipts, bills or returns are linked to this purchase
                order yet. Receive goods, or use &ldquo;Create bill&rdquo; /
                &ldquo;Create return&rdquo; above to raise one from this order.
              </p>
            ) : (
              <div className="space-y-5">
                {linkedReceipts.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Goods receipts
                    </p>
                    <LinkedDocTable
                      trailingLabel="Received qty"
                      rows={linkedReceipts.map((g) => ({
                        id: g.id,
                        href: withOrg(
                          `/purchases/goods-receipts?search=${encodeURIComponent(
                            g.grnNumber
                          )}`
                        ),
                        number: g.grnNumber,
                        date: formatDate(g.receivedDate),
                        trailing: String(g.totalReceivedQuantity),
                        statusLabel: GRN_STATUS[g.status].label,
                        statusVariant: GRN_STATUS[g.status].variant,
                      }))}
                    />
                  </div>
                )}
                {linkedBills.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Bills
                    </p>
                    <LinkedDocTable
                      trailingLabel="Total"
                      rows={linkedBills.map((b) => ({
                        id: b.id,
                        href: withOrg(`/bills/${b.id}`),
                        number: b.invoiceNumber,
                        date: formatDate(b.invoiceDate),
                        trailing: formatCurrency(b.totalAmount),
                        statusLabel: BILL_STATUS[b.status].label,
                        statusVariant: BILL_STATUS[b.status].variant,
                      }))}
                    />
                  </div>
                )}
                {linkedReturns.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Returns
                    </p>
                    <LinkedDocTable
                      trailingLabel="Total"
                      rows={linkedReturns.map((r) => ({
                        id: r.id,
                        href: withOrg(`/purchases/returns/${r.id}`),
                        number: r.returnNumber,
                        date: formatDate(r.returnDate),
                        trailing: formatCurrency(r.totalAmount),
                        statusLabel: PRET_STATUS[r.status].label,
                        statusVariant: PRET_STATUS[r.status].variant,
                      }))}
                    />
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <SectionCard title="Details" delay={0.1}>
            <dl className="space-y-4">
              <InfoRow icon={Truck} label="Supplier" value={supplierName} />
              <InfoRow icon={Building2} label="Branch" value={branchName} />
              <InfoRow
                icon={Calendar}
                label="Order date"
                value={formatDate(purchaseOrder.orderDate)}
              />
              <InfoRow
                icon={Calendar}
                label="Expected delivery"
                value={
                  purchaseOrder.expectedDeliveryDate
                    ? formatDate(purchaseOrder.expectedDeliveryDate)
                    : null
                }
              />
              <InfoRow
                icon={CheckCircle2}
                label="Approved by"
                value={approvedByName ?? purchaseOrder.approvedBy}
              />
              <InfoRow
                icon={Calendar}
                label="Approved at"
                value={
                  purchaseOrder.approvedAt
                    ? formatDate(purchaseOrder.approvedAt)
                    : null
                }
              />
            </dl>
          </SectionCard>

          <SectionCard title="Summary" delay={0.15}>
            <dl className="space-y-4">
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(purchaseOrder.subtotal, true)}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  −{formatCurrency(purchaseOrder.discountAmount, true)}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(purchaseOrder.taxAmount, true)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <dt className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Total
                </dt>
                <dd className="nums text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(purchaseOrder.totalAmount, true)}
                </dd>
              </div>
            </dl>
          </SectionCard>
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
