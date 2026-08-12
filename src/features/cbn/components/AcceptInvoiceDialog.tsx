"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { ErrorBanner } from "@/components/shared/error-banner";
import {
  acceptCbnInvoice,
  acceptCbnPurchaseOrder,
  resolveCbnInvoiceLines,
  resolveCbnPurchaseOrderLines,
} from "@/features/cbn/actions/sync.actions";
import { formatCurrency } from "@/utils/format";
import type {
  CbnDocumentKind,
  InvoiceLineMapping,
  ProductMatchSource,
  ResolvedInvoiceLine,
} from "@/features/cbn/types/cbn.types";
import type { ProductOption } from "@/features/product/types/product.types";

interface AcceptInvoiceDialogProps {
  /** Invoice → bill, or purchase order → sales order. */
  readonly kind?: CbnDocumentKind;
  readonly cbnInvoiceId: string;
  readonly connectionId: string;
  readonly organizationId: string;
  readonly senderName: string;
  readonly invoiceNumber: string;
  readonly products: readonly ProductOption[];
  readonly onClose: () => void;
}

const MATCH_LABEL: Record<ProductMatchSource, string> = {
  link: "Matched from a previous invoice",
  barcode: "Matched by barcode",
  sku: "Matched by SKU",
  none: "No match — choose a product",
};

/**
 * Maps each line of an incoming network invoice to a product in this
 * organization's own catalog, then creates the bill.
 *
 * A product id is meaningless across organizations, so the sender's lines carry
 * only a snapshot plus identifiers. Anything matched confidently is pre-filled;
 * the rest must be chosen deliberately, because binding the wrong product would
 * quietly corrupt stock and cost history.
 */
export function AcceptInvoiceDialog({
  kind = "invoice",
  cbnInvoiceId,
  connectionId,
  organizationId,
  senderName,
  invoiceNumber,
  products,
  onClose,
}: AcceptInvoiceDialogProps) {
  const router = useRouter();
  const [lines, setLines] = useState<readonly ResolvedInvoiceLine[] | null>(
    null
  );
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, startAccept] = useTransition();

  useEffect(() => {
    let active = true;
    const resolve =
      kind === "invoice" ? resolveCbnInvoiceLines : resolveCbnPurchaseOrderLines;
    void resolve(cbnInvoiceId, organizationId, connectionId)
      .then((result) => {
        if (!active) {
          return;
        }
        if (!result.success) {
          setLoadError(result.error.message);
          return;
        }
        setLines(result.data);
        setSelection(
          Object.fromEntries(
            result.data
              .filter((resolved) => resolved.productId !== null)
              .map((resolved) => [resolved.line.id, resolved.productId as string])
          )
        );
      })
      .catch(() => {
        if (active) {
          setLoadError("Could not load the invoice lines.");
        }
      });
    return () => {
      active = false;
    };
  }, [kind, cbnInvoiceId, organizationId, connectionId]);

  const unmappedCount =
    lines?.filter((resolved) => !selection[resolved.line.id]).length ?? 0;

  const handleSelect = (lineId: string, productId: string): void => {
    setSelection((prev) => ({ ...prev, [lineId]: productId }));
  };

  const handleAccept = (): void => {
    if (!lines) {
      return;
    }
    setError(null);
    const mappings: InvoiceLineMapping[] = lines.map((resolved) => ({
      cbnInvoiceItemId: resolved.line.id,
      productId: selection[resolved.line.id] ?? "",
    }));
    const accept =
      kind === "invoice" ? acceptCbnInvoice : acceptCbnPurchaseOrder;

    startAccept(async () => {
      const result = await accept(cbnInvoiceId, organizationId, mappings);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      onClose();
      router.refresh();
    });
  };

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
        aria-label="Review and accept invoice"
        className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
            <PackageSearch className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Accept {invoiceNumber} from {senderName}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Match each line to one of your products. We remember your
              choices, so the next document from {senderName} won&apos;t ask
              again.
            </p>
          </div>
        </div>

        {loadError && <ErrorBanner message={loadError} className="mt-4" />}

        {!lines && !loadError && (
          <div className="py-10">
            <LoadingSpinner />
          </div>
        )}

        {lines && lines.length === 0 && (
          <div className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <p className="font-medium">
              No line items arrived with this document
            </p>
            <p className="mt-1">
              Only the total crossed the network, so there is nothing to match
              and nothing can be created from it. This happens when it was sent
              before line-item exchange was available. Reject it and ask{" "}
              {senderName} to send it again.
            </p>
          </div>
        )}

        {lines && lines.length > 0 && (
          <ul className="mt-5 space-y-3">
            {lines.map((resolved) => {
              const chosen = selection[resolved.line.id] ?? "";
              return (
                <li
                  key={resolved.line.id}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {resolved.line.productName ??
                        resolved.line.description ??
                        "Unnamed item"}
                    </p>
                    <p className="nums text-sm text-slate-600 dark:text-slate-400">
                      {resolved.line.quantity} ×{" "}
                      {formatCurrency(resolved.line.unitPrice, true)} ={" "}
                      {formatCurrency(resolved.line.lineTotal, true)}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label
                      htmlFor={`map-${resolved.line.id}`}
                      className="text-xs text-slate-500 dark:text-slate-400"
                    >
                      Your product
                    </label>
                    <select
                      id={`map-${resolved.line.id}`}
                      value={chosen}
                      onChange={(e) =>
                        handleSelect(resolved.line.id, e.target.value)
                      }
                      className="min-w-56 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      <option value="">Select a product…</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <p
                    className={
                      resolved.matchedBy === "none"
                        ? "mt-1.5 text-xs text-amber-700 dark:text-amber-400"
                        : "mt-1.5 text-xs text-slate-500 dark:text-slate-400"
                    }
                  >
                    {MATCH_LABEL[resolved.matchedBy]}
                    {resolved.line.productBarcode
                      ? ` · barcode ${resolved.line.productBarcode}`
                      : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        {error && <ErrorBanner message={error} className="mt-4" />}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {/* An invoice with no lines has nothing to match — saying
                "All lines matched" there reads as if it were ready to accept. */}
            {!lines || lines.length === 0
              ? ""
              : unmappedCount === 0
                ? "All lines matched"
                : unmappedCount === 1
                  ? "1 line still needs a product"
                  : `${unmappedCount} lines still need a product`}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isAccepting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="gradient"
              onClick={handleAccept}
              loading={isAccepting}
              disabled={
                isAccepting ||
                !lines ||
                lines.length === 0 ||
                unmappedCount > 0
              }
            >
              <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {kind === "invoice" ? "Accept as bill" : "Accept as sales order"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
