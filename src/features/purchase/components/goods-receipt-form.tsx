"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { PackageCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createGoodsReceiptAction } from "@/features/purchase/actions/goods-receipt.actions";
import type { PurchaseOrderWithItems } from "@/features/purchase/types/purchase-order.types";
import type { WarehouseOption } from "@/features/purchase/components/purchase-order-form";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Form value shapes
// ─────────────────────────────────────────────────────────────

interface ReceiptLineValue {
  purchaseOrderItemId: string;
  productId: string;
  receivedQuantity: string;
  rejectedQuantity: string;
}

interface GoodsReceiptFormValues {
  warehouseId: string;
  receivedDate: string;
  notes: string;
  items: ReceiptLineValue[];
}

interface ReceiptLineMeta {
  readonly purchaseOrderItemId: string;
  readonly productId: string;
  readonly productName: string;
  readonly ordered: number;
  readonly alreadyReceived: number;
  readonly outstanding: number;
}

function num(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const cellClass = cn(
  "block w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-slate-900 shadow-sm transition-[border-color,box-shadow] duration-150 ease-out dark:text-slate-100",
  "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
);

const inputClass = cn(
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-slate-900 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out dark:text-slate-100",
  "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary hover:border-slate-400 dark:hover:border-slate-600"
);

// ─────────────────────────────────────────────────────────────
// Goods receipt form
// ─────────────────────────────────────────────────────────────

interface GoodsReceiptFormProps {
  readonly organizationId: string;
  readonly purchaseOrder: PurchaseOrderWithItems;
  readonly productNames: Readonly<Record<string, string>>;
  readonly warehouses: readonly WarehouseOption[];
}

export function GoodsReceiptForm({
  organizationId,
  purchaseOrder,
  productNames,
  warehouses,
}: GoodsReceiptFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const meta: ReceiptLineMeta[] = useMemo(
    () =>
      purchaseOrder.items.map((item) => {
        const outstanding = Math.max(0, item.quantity - item.receivedQuantity);
        return {
          purchaseOrderItemId: item.id,
          productId: item.productId,
          productName:
            productNames[item.productId] ?? item.description ?? item.productId,
          ordered: item.quantity,
          alreadyReceived: item.receivedQuantity,
          outstanding,
        };
      }),
    [purchaseOrder.items, productNames]
  );

  const { register, handleSubmit } = useForm<GoodsReceiptFormValues>({
    defaultValues: {
      warehouseId: purchaseOrder.warehouseId ?? warehouses[0]?.id ?? "",
      receivedDate: new Date().toISOString().slice(0, 10),
      notes: "",
      items: meta.map((line) => ({
        purchaseOrderItemId: line.purchaseOrderItemId,
        productId: line.productId,
        receivedQuantity: String(line.outstanding),
        rejectedQuantity: "0",
      })),
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const lines = values.items
      .map((item) => ({
        purchaseOrderItemId: item.purchaseOrderItemId,
        productId: item.productId,
        receivedQuantity: num(item.receivedQuantity),
        rejectedQuantity: num(item.rejectedQuantity),
      }))
      .filter((item) => item.receivedQuantity > 0 || item.rejectedQuantity > 0);

    if (lines.length === 0) {
      setServerError("Record a received or rejected quantity for at least one line.");
      return;
    }

    const fd = new FormData();
    fd.append("purchaseOrderId", purchaseOrder.id);
    fd.append("warehouseId", values.warehouseId);
    if (values.receivedDate) {
      fd.append("receivedDate", values.receivedDate);
    }
    if (values.notes.trim()) {
      fd.append("notes", values.notes.trim());
    }
    fd.append("items", JSON.stringify(lines));

    startTransition(async () => {
      const result = await createGoodsReceiptAction(organizationId, fd);
      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }
      router.push(`/purchases/${purchaseOrder.id}`);
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 sm:p-6"
    >
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <PackageCheck className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Receive goods
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Record delivery against{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {purchaseOrder.poNumber}
            </span>
          </p>
        </div>
      </div>

      {serverError && (
        <div
          role="alert"
          className="border-error-200 bg-error-50 text-error-800 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300 mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {serverError}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="grn-warehouse"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Warehouse
              <span className="text-error-500 ml-0.5" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="grn-warehouse"
              className={inputClass}
              {...register("warehouseId")}
            >
              {warehouses.length === 0 && <option value="">No warehouses</option>}
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="grn-date"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Received date
            </label>
            <Input
              id="grn-date"
              type="date"
              {...register("receivedDate")}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-card dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Product
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Ordered
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Already received
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Outstanding
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Receive now
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Rejected
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {meta.map((line, index) => (
                  <tr key={line.purchaseOrderItemId}>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {line.productName}
                    </td>
                    <td className="px-3 py-2 text-right nums text-slate-600 dark:text-slate-400">
                      {line.ordered}
                    </td>
                    <td className="px-3 py-2 text-right nums text-slate-600 dark:text-slate-400">
                      {line.alreadyReceived}
                    </td>
                    <td className="px-3 py-2 text-right nums font-medium text-slate-900 dark:text-slate-100">
                      {line.outstanding}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        aria-label={`Receive quantity for ${line.productName}`}
                        className={cn(cellClass, "w-24 text-right")}
                        {...register(`items.${index}.receivedQuantity`)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        aria-label={`Rejected quantity for ${line.productName}`}
                        className={cn(cellClass, "w-24 text-right")}
                        {...register(`items.${index}.rejectedQuantity`)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <label
            htmlFor="grn-notes"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Notes
          </label>
          <Textarea
            id="grn-notes"
            rows={3}
            placeholder="Delivery condition, discrepancies, etc."
            {...register("notes")}
          />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/purchases/${purchaseOrder.id}`)}
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
            <PackageCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Record receipt
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
