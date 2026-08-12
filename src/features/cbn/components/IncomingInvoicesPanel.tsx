"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import {
  rejectCbnInvoice,
  rejectCbnPurchaseOrder,
} from "@/features/cbn/actions/sync.actions";
import { AcceptInvoiceDialog } from "@/features/cbn/components/AcceptInvoiceDialog";
import { formatCurrency, formatDate } from "@/utils/format";
import type {
  CbnDocumentKind,
  IncomingDocument,
} from "@/features/cbn/types/cbn.types";
import type { ProductOption } from "@/features/product/types/product.types";

interface IncomingInvoicesPanelProps {
  /** Invoices awaiting a bill, or purchase orders awaiting a sales order. */
  readonly kind?: CbnDocumentKind;
  readonly organizationId: string;
  readonly invoices: readonly IncomingDocument[];
  /** Whether the viewer may turn an incoming invoice into a bill. */
  readonly canManage: boolean;
  /** This org's products, offered when matching incoming lines. */
  readonly products?: readonly ProductOption[];
}

/**
 * Inbox of invoices sent to this organization over the Connected Business
 * Network. Accepting one creates a draft bill in the buyer's books; rejecting
 * it sends a reason back to the sender.
 */
export function IncomingInvoicesPanel({
  kind = "invoice",
  organizationId,
  invoices,
  canManage,
  products = [],
}: IncomingInvoicesPanelProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startAction] = useTransition();

  // Accepting is a two-step flow now: the incoming lines have to be matched to
  // local products before a bill can exist, so the button opens a dialog rather
  // than committing straight away.
  const [reviewing, setReviewing] = useState<IncomingDocument | null>(null);

  const handleCloseReview = (): void => {
    setReviewing(null);
  };

  const handleReject = (id: string): void => {
    const reason = window.prompt(
      "Why are you rejecting this invoice? The sender will see this."
    );
    // A blank reason is rejected server-side, so don't bother round-tripping.
    if (reason === null || reason.trim() === "") {
      return;
    }
    setError(null);
    setPendingId(id);
    startAction(async () => {
      const reject =
        kind === "invoice" ? rejectCbnInvoice : rejectCbnPurchaseOrder;
      const result = await reject(id, organizationId, reason.trim());
      setPendingId(null);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  };

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={
          kind === "invoice"
            ? "No incoming invoices"
            : "No incoming purchase orders"
        }
        description={
          kind === "invoice"
            ? "Invoices sent to you by connected businesses will appear here, ready to accept as bills."
            : "Purchase orders sent to you by connected businesses will appear here, ready to accept as sales orders."
        }
      />
    );
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Sent to you over the Connected Business Network. Accepting creates a
        draft {kind === "invoice" ? "bill" : "sales order"} you can review.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <Table aria-label={`Incoming network ${kind === "invoice" ? "invoices" : "purchase orders"}`}>
          <TableHeader>
            <TableRow>
              <TableHead>From</TableHead>
              <TableHead>{kind === "invoice" ? "Invoice #" : "PO #"}</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                  {doc.senderName}
                </TableCell>
                <TableCell className="font-mono text-xs">{doc.number}</TableCell>
                <TableCell>{formatDate(new Date(doc.date))}</TableCell>
                <TableCell className="nums text-right">
                  {formatCurrency(doc.totalAmount, true)}
                </TableCell>
                <TableCell className="text-right">
                  {canManage ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="gradient"
                        disabled={pendingId === doc.id}
                        onClick={() => setReviewing(doc)}
                        aria-label={`Review and accept invoice ${doc.number} from ${doc.senderName}`}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Review &amp; accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pendingId === doc.id}
                        onClick={() => handleReject(doc.id)}
                        aria-label={`Reject invoice ${doc.number} from ${doc.senderName}`}
                      >
                        <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      No permission
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {reviewing && (
        <AcceptInvoiceDialog
          kind={kind}
          cbnInvoiceId={reviewing.id}
          connectionId={reviewing.connectionId}
          organizationId={organizationId}
          senderName={reviewing.senderName}
          invoiceNumber={reviewing.number}
          products={products}
          onClose={handleCloseReview}
        />
      )}
    </div>
  );
}
