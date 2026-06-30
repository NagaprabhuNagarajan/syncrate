"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { SlidersHorizontal, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adjustStockAction } from "@/features/inventory/actions/inventory.actions";
import type {
  ProductOption,
} from "@/features/inventory/types/inventory.types";
import type { BranchOption } from "@/features/organization/server/branch-options";
import { cn } from "@/utils/cn";

const selectClass =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out hover:border-slate-400 dark:hover:border-slate-600 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";

interface AdjustStockDialogProps {
  readonly organizationId: string;
  readonly products: readonly ProductOption[];
  readonly branches: readonly BranchOption[];
  readonly defaultProductId?: string;
  readonly defaultBranchId?: string;
  readonly onClose: () => void;
  readonly onDone: () => void;
}

export function AdjustStockDialog({
  organizationId,
  products,
  branches,
  defaultProductId,
  defaultBranchId,
  onClose,
  onDone,
}: AdjustStockDialogProps) {
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [branchId, setBranchId] = useState(defaultBranchId ?? "");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("branchId", branchId);
    formData.append("quantity", quantity);
    if (reason.trim()) {
      formData.append("reason", reason.trim());
    }

    startTransition(async () => {
      const result = await adjustStockAction(organizationId, formData);
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
      aria-label="Adjust stock"
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
            <SlidersHorizontal
              className="h-5 w-5 text-white"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Adjust stock
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Record a manual correction. Use a negative quantity to remove
              damaged or lost stock.
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
              htmlFor="adjust-product"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Product
            </label>
            <select
              id="adjust-product"
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

          <div>
            <label
              htmlFor="adjust-branch"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Branch
            </label>
            <select
              id="adjust-branch"
              required
              className={selectClass}
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              <option value="">Select a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="adjust-quantity"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Quantity change
            </label>
            <input
              id="adjust-quantity"
              type="number"
              required
              step="1"
              className={cn(selectClass, "nums")}
              placeholder="e.g. 10 or -3"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="adjust-reason"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Reason
            </label>
            <textarea
              id="adjust-reason"
              rows={2}
              className={selectClass}
              placeholder="Stock count correction, breakage, …"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
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
              Apply adjustment
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

AdjustStockDialog.displayName = "AdjustStockDialog";
