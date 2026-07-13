"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/shared/error-banner";
import { transferStockAction } from "@/features/inventory/actions/inventory.actions";
import type { ProductOption } from "@/features/inventory/types/inventory.types";
import type { BranchOption } from "@/features/organization/server/branch-options";

const selectClass =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out hover:border-slate-400 dark:hover:border-slate-600 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";

interface TransferStockDialogProps {
  readonly organizationId: string;
  readonly products: readonly ProductOption[];
  readonly branches: readonly BranchOption[];
  readonly defaultProductId?: string;
  readonly onClose: () => void;
  readonly onDone: () => void;
}

export function TransferStockDialog({
  organizationId,
  products,
  branches,
  defaultProductId,
  onClose,
  onDone,
}: TransferStockDialogProps) {
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError(null);

    if (fromBranchId && fromBranchId === toBranchId) {
      setError("Source and destination branches must be different");
      return;
    }

    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("fromBranchId", fromBranchId);
    formData.append("toBranchId", toBranchId);
    formData.append("quantity", quantity);
    if (note.trim()) {
      formData.append("note", note.trim());
    }

    startTransition(async () => {
      const result = await transferStockAction(organizationId, formData);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      onDone();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Transfer stock"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
            <ArrowLeftRight
              className="h-5 w-5 text-white"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Transfer stock
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Move stock between branches. This writes two ledger entries.
            </p>
          </div>
        </div>

        {error && <ErrorBanner message={error} className="mb-5" />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="transfer-product"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Product
            </label>
            <select
              id="transfer-product"
              required
              className={selectClass}
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Select a product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="transfer-from"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                From branch
              </label>
              <select
                id="transfer-from"
                required
                className={selectClass}
                value={fromBranchId}
                onChange={(event) => setFromBranchId(event.target.value)}
              >
                <option value="">Source</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="transfer-to"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                To branch
              </label>
              <select
                id="transfer-to"
                required
                className={selectClass}
                value={toBranchId}
                onChange={(event) => setToBranchId(event.target.value)}
              >
                <option value="">Destination</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="transfer-quantity"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Quantity
            </label>
            <input
              id="transfer-quantity"
              type="number"
              required
              min={1}
              step="1"
              className={`${selectClass} nums`}
              placeholder="0"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="transfer-note"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Note
            </label>
            <textarea
              id="transfer-note"
              rows={2}
              className={selectClass}
              placeholder="Reason for transfer (optional)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              loading={isPending}
              disabled={isPending}
            >
              Transfer stock
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

TransferStockDialog.displayName = "TransferStockDialog";
