"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  Hash,
  Download,
  Share2,
  Edit,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  INV_STATUS_VARIANT,
  INV_STATUS_LABEL,
  PAYMENT_STATUS_VARIANT,
  PAYMENT_STATUS_LABEL,
} from "@/features/sales/components/invoices-view";
import {
  postInvoiceAction,
  cancelInvoiceAction,
} from "@/features/sales/actions/invoice.actions";
import type { InvoiceWithItems } from "@/features/sales/types/invoice.types";

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
              id="cancel-inv-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Cancel invoice
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Are you sure you want to cancel{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">{invoiceNumber}</span>
              ? This cannot be undone.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-800 dark:text-error-300 mt-4 rounded-lg border px-3 py-2 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}

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
// Props
// ─────────────────────────────────────────────────────────────

interface InvoiceDetailProps {
  readonly invoice: InvoiceWithItems;
  readonly customerName: string | null;
  readonly productNames: Readonly<Record<string, string>>;
  readonly organizationId: string;
  readonly canManage: boolean;
  readonly canCancel: boolean;
}

export function InvoiceDetail({
  invoice,
  customerName,
  productNames,
  organizationId,
  canManage,
  canCancel,
}: InvoiceDetailProps) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { status } = invoice;
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
    run(() => postInvoiceAction(organizationId, invoice.id));

  const handleCancel = (): void =>
    run(() => cancelInvoiceAction(organizationId, invoice.id));

  const pdfUrl = `/api/sales/invoices/${invoice.id}/pdf`;
  const shareUrl = `/sales/invoices/${invoice.id}/share`;

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title={invoice.invoiceNumber}
        description={customerName ?? undefined}
        icon={FileText}
      >
        {isDraft && canManage && (
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/sales/invoices/${invoice.id}/edit`}>
                <Edit className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Edit
              </Link>
            </Button>
            <Button type="button" variant="gradient" onClick={handlePost} loading={isPending}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Post
            </Button>
          </>
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
        <Button asChild variant="outline" size="sm">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download PDF"
          >
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
      </PageHeader>

      {/* Status badges */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant={INV_STATUS_VARIANT[status]}>
          {INV_STATUS_LABEL[status]}
        </Badge>
        <Badge variant={PAYMENT_STATUS_VARIANT[invoice.paymentStatus]}>
          {PAYMENT_STATUS_LABEL[invoice.paymentStatus]}
        </Badge>
        {invoice.postedAt && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Posted on {formatDate(invoice.postedAt)}
          </span>
        )}
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
            Invoice details
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              value={formatDate(invoice.dueDate)}
            />
            {invoice.supplyState && (
              <InfoRow
                icon={Hash}
                label={invoice.isInterstate ? "Supply state (inter-state)" : "Supply state (intra-state)"}
                value={invoice.supplyState}
              />
            )}
            {invoice.referenceNumber && (
              <InfoRow
                icon={Hash}
                label="Reference"
                value={invoice.referenceNumber}
              />
            )}
          </dl>
          {invoice.notes && (
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <dt className="text-xs text-muted-foreground">Notes</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {invoice.notes}
              </dd>
            </div>
          )}
          {invoice.terms && (
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <dt className="text-xs text-muted-foreground">Terms &amp; conditions</dt>
              <dd className="mt-1 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                {invoice.terms}
              </dd>
            </div>
          )}
        </Card>

        {/* Totals summary */}
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">Summary</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                {formatCurrency(invoice.subtotal)}
              </dd>
            </div>
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                  −{formatCurrency(invoice.discountAmount)}
                </dd>
              </div>
            )}
            {invoice.isInterstate ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">IGST</dt>
                <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(invoice.igstAmount)}
                </dd>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">CGST</dt>
                  <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(invoice.cgstAmount)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">SGST</dt>
                  <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(invoice.sgstAmount)}
                  </dd>
                </div>
              </>
            )}
            {invoice.roundOff !== 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Round off</dt>
                <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                  {invoice.roundOff > 0 ? "+" : ""}
                  {formatCurrency(invoice.roundOff)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
              <dt className="text-base font-bold text-slate-900 dark:text-slate-100">
                GRAND TOTAL
              </dt>
              <dd className="text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {formatCurrency(invoice.totalAmount)}
              </dd>
            </div>
            <div className="flex justify-between pt-1 text-xs">
              <dt className="text-muted-foreground">Amount paid</dt>
              <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                {formatCurrency(invoice.amountPaid)}
              </dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-muted-foreground">Balance due</dt>
              <dd className="tabular-nums font-medium text-slate-900 dark:text-slate-100">
                {formatCurrency(invoice.totalAmount - invoice.amountPaid)}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Line items table */}
      <div className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Line items</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    HSN
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Qty
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Rate
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Disc %
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Taxable
                  </th>
                  {invoice.isInterstate ? (
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      IGST
                    </th>
                  ) : (
                    <>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        CGST
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        SGST
                      </th>
                    </>
                  )}
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {productNames[item.productId] ?? item.description ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {item.hsnCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {item.discountPercent > 0
                        ? `${item.discountPercent}%`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {formatCurrency(item.taxableAmount)}
                    </td>
                    {invoice.isInterstate ? (
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {item.igstRate > 0
                          ? `${formatCurrency(item.igstAmount)} (${item.igstRate}%)`
                          : "—"}
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {item.cgstRate > 0
                            ? `${formatCurrency(item.cgstAmount)} (${item.cgstRate}%)`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {item.sgstRate > 0
                            ? `${formatCurrency(item.sgstAmount)} (${item.sgstRate}%)`
                            : "—"}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* GST summary */}
      <div className="mt-4 flex justify-end">
        <dl className="w-full max-w-sm space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Taxable value</dt>
            <dd className="tabular-nums text-slate-700 dark:text-slate-300">
              {formatCurrency(invoice.subtotal - invoice.discountAmount)}
            </dd>
          </div>
          {invoice.isInterstate ? (
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">IGST</dt>
              <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                {formatCurrency(invoice.igstAmount)}
              </dd>
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">CGST</dt>
                <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(invoice.cgstAmount)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">SGST</dt>
                <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(invoice.sgstAmount)}
                </dd>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Total GST</dt>
            <dd className="tabular-nums font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(invoice.taxAmount)}
            </dd>
          </div>
          {invoice.roundOff !== 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Round off</dt>
              <dd className="tabular-nums text-slate-700 dark:text-slate-300">
                {invoice.roundOff > 0 ? "+" : ""}
                {formatCurrency(invoice.roundOff)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-base font-bold text-slate-900 dark:text-slate-100">
            <dt>Grand total</dt>
            <dd className="tabular-nums">{formatCurrency(invoice.totalAmount)}</dd>
          </div>
        </dl>
      </div>

      <AnimatePresence>
        {showCancel && (
          <CancelDialog
            invoiceNumber={invoice.invoiceNumber}
            isPending={isPending}
            error={actionError}
            onConfirm={handleCancel}
            onClose={() => setShowCancel(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
