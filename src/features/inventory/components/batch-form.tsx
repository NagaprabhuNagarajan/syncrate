"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Layers, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBatchAction } from "@/features/inventory/actions/inventory.actions";
import type { ProductOption } from "@/features/inventory/types/inventory.types";

const inputClass =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out hover:border-slate-400 dark:hover:border-slate-600 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";

interface BatchFormDialogProps {
  readonly organizationId: string;
  readonly products: readonly ProductOption[];
  readonly defaultProductId?: string;
  readonly onClose: () => void;
  readonly onDone: () => void;
}

export function BatchFormDialog({
  organizationId,
  products,
  defaultProductId,
  onClose,
  onDone,
}: BatchFormDialogProps) {
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [batchNumber, setBatchNumber] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [supplierBatch, setSupplierBatch] = useState("");
  const [receivedQuantity, setReceivedQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("batchNumber", batchNumber);
    if (manufacturingDate) {
      formData.append("manufacturingDate", manufacturingDate);
    }
    if (expiryDate) {
      formData.append("expiryDate", expiryDate);
    }
    if (supplierBatch.trim()) {
      formData.append("supplierBatch", supplierBatch.trim());
    }
    formData.append("receivedQuantity", receivedQuantity);

    startTransition(async () => {
      const result = await createBatchAction(organizationId, formData);
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
      aria-label="Add batch"
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
            <Layers className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Add batch
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Track a manufacturing batch with its expiry and quantities.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-800 dark:text-error-300 mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
            role="alert"
          >
            <AlertCircle
              className="text-error-500 mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="batch-product"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Product
            </label>
            <select
              id="batch-product"
              required
              className={inputClass}
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
                htmlFor="batch-number"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Batch number
              </label>
              <input
                id="batch-number"
                type="text"
                required
                className={inputClass}
                placeholder="B-2026-001"
                value={batchNumber}
                onChange={(event) => setBatchNumber(event.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="batch-supplier"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Supplier batch
              </label>
              <input
                id="batch-supplier"
                type="text"
                className={inputClass}
                placeholder="Optional"
                value={supplierBatch}
                onChange={(event) => setSupplierBatch(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="batch-mfg"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Manufacturing date
              </label>
              <input
                id="batch-mfg"
                type="date"
                className={inputClass}
                value={manufacturingDate}
                onChange={(event) => setManufacturingDate(event.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="batch-expiry"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Expiry date
              </label>
              <input
                id="batch-expiry"
                type="date"
                className={inputClass}
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="batch-received"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Received quantity
            </label>
            <input
              id="batch-received"
              type="number"
              required
              min={0}
              step="1"
              className={`${inputClass} nums`}
              placeholder="0"
              value={receivedQuantity}
              onChange={(event) => setReceivedQuantity(event.target.value)}
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
              Create batch
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

BatchFormDialog.displayName = "BatchFormDialog";
