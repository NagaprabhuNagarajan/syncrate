"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transferStockAction } from "@/features/inventory/actions/inventory.actions";
import type { ProductOption } from "@/features/inventory/types/inventory.types";
import type { WarehouseOption } from "@/features/warehouse/types/warehouse.types";

const selectClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500";

interface TransferStockDialogProps {
  readonly organizationId: string;
  readonly products: readonly ProductOption[];
  readonly warehouses: readonly WarehouseOption[];
  readonly defaultProductId?: string;
  readonly onClose: () => void;
  readonly onDone: () => void;
}

export function TransferStockDialog({
  organizationId,
  products,
  warehouses,
  defaultProductId,
  onClose,
  onDone,
}: TransferStockDialogProps) {
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setError(null);

    if (fromWarehouseId && fromWarehouseId === toWarehouseId) {
      setError("Source and destination warehouses must be different");
      return;
    }

    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("fromWarehouseId", fromWarehouseId);
    formData.append("toWarehouseId", toWarehouseId);
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
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-xl sm:px-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="bg-primary-50 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <ArrowLeftRight
              className="text-primary-600 h-5 w-5"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Transfer stock
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Move stock between warehouses. This writes two ledger entries.
            </p>
          </div>
        </div>

        {error && (
          <div
            className="border-error-200 bg-error-50 text-error-800 mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
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
              htmlFor="transfer-product"
              className="mb-1.5 block text-sm font-medium text-slate-700"
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
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                From warehouse
              </label>
              <select
                id="transfer-from"
                required
                className={selectClass}
                value={fromWarehouseId}
                onChange={(event) => setFromWarehouseId(event.target.value)}
              >
                <option value="">Source</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="transfer-to"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                To warehouse
              </label>
              <select
                id="transfer-to"
                required
                className={selectClass}
                value={toWarehouseId}
                onChange={(event) => setToWarehouseId(event.target.value)}
              >
                <option value="">Destination</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="transfer-quantity"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Quantity
            </label>
            <input
              id="transfer-quantity"
              type="number"
              required
              min={1}
              step="1"
              className={selectClass}
              placeholder="0"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="transfer-note"
              className="mb-1.5 block text-sm font-medium text-slate-700"
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
            <Button type="submit" loading={isPending} disabled={isPending}>
              Transfer stock
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

TransferStockDialog.displayName = "TransferStockDialog";
