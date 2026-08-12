"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Network, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/shared/error-banner";
import {
  sendCbnInvoice,
  sendCbnPurchaseOrder,
} from "@/features/cbn/actions/sync.actions";
import type { CbnDocumentKind } from "@/features/cbn/types/cbn.types";

/**
 * The connection this document goes to. There is never a choice: the invoice's
 * customer is bound to exactly one connection when the network link is made, so
 * the recipient is determined by the invoice itself.
 */
export interface NetworkTarget {
  readonly connectionId: string;
  readonly name: string;
  readonly businessId?: string | null;
}

interface SendViaNetworkDialogProps {
  /** Invoice to a customer, or purchase order to a supplier. */
  readonly kind?: CbnDocumentKind;
  readonly invoiceId: string;
  readonly organizationId: string;
  readonly target: NetworkTarget;
  readonly onClose: () => void;
}

/**
 * Sends a posted invoice to the customer's connected business over the CBN —
 * the structured alternative to emailing a PDF. The server RPC re-validates the
 * connection and the `receive_invoices` grant.
 */
export function SendViaNetworkDialog({
  kind = "invoice",
  invoiceId,
  organizationId,
  target,
  onClose,
}: SendViaNetworkDialogProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSend = useCallback(() => {
    setError(null);
    const send = kind === "invoice" ? sendCbnInvoice : sendCbnPurchaseOrder;
    startTransition(async () => {
      const result = await send(invoiceId, target.connectionId, organizationId);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      onClose();
      router.refresh();
    });
  }, [kind, invoiceId, target.connectionId, organizationId, onClose, router]);

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
        aria-label="Send via Network"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
            <Network className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Send via Network
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Deliver this {kind === "invoice" ? "invoice" : "purchase order"}{" "}
              as structured data to a connected business — no PDF required.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Sending to
          </p>
          <div className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {target.name}
            </p>
            {target.businessId && (
              <p className="truncate font-mono text-xs text-slate-400 dark:text-slate-500">
                {target.businessId}
              </p>
            )}
          </div>
        </div>

        {error && <ErrorBanner message={error} className="mt-4" />}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="gradient"
            onClick={handleSend}
            loading={isPending}
            disabled={isPending}
          >
            <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {kind === "invoice" ? "Send invoice" : "Send purchase order"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
