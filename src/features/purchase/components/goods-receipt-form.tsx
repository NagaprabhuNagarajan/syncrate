"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/shared/error-banner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createGoodsReceiptAction } from "@/features/purchase/actions/goods-receipt.actions";
import type { PurchaseOrderWithItems } from "@/features/purchase/types/purchase-order.types";
import type { BranchOption } from "@/features/purchase/components/purchase-order-form";
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
  branchId: string;
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
// Section chrome (Card-wrapped, mirrors purchase-order-form)
// ─────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
  delay,
}: {
  readonly title: string;
  readonly description?: string;
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
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Goods receipt form
// ─────────────────────────────────────────────────────────────

interface GoodsReceiptFormProps {
  readonly organizationId: string;
  readonly purchaseOrder: PurchaseOrderWithItems;
  readonly productNames: Readonly<Record<string, string>>;
  readonly branches: readonly BranchOption[];
}

export function GoodsReceiptForm({
  organizationId,
  purchaseOrder,
  productNames,
  branches,
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

  const { register, handleSubmit, watch } = useForm<GoodsReceiptFormValues>({
    defaultValues: {
      branchId: purchaseOrder.branchId ?? branches[0]?.id ?? "",
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

  // Live summary for the sticky save bar — purely presentational, computed
  // from the same watched values the submit handler reads.
  const watchedItems = watch("items");
  const totalReceiving = (watchedItems ?? []).reduce(
    (sum, item) => sum + num(item.receivedQuantity),
    0
  );
  const totalRejected = (watchedItems ?? []).reduce(
    (sum, item) => sum + num(item.rejectedQuantity),
    0
  );

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
    fd.append("branchId", values.branchId);
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
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-5 flex items-start gap-3"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <PackageCheck className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Receive goods
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Record delivery against{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {purchaseOrder.poNumber}
            </span>
          </p>
        </div>
      </motion.div>

      {serverError && <ErrorBanner message={serverError} className="mb-5" />}

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Receipt details */}
        <Section
          title="Receipt details"
          description="Branch and date this delivery was received."
          delay={0.05}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="grn-branch"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Branch
                <span className="text-error-500 ml-0.5" aria-hidden="true">
                  *
                </span>
              </label>
              <select
                id="grn-branch"
                className={inputClass}
                {...register("branchId")}
              >
                {branches.length === 0 && <option value="">No branches</option>}
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
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
              <Input id="grn-date" type="date" {...register("receivedDate")} />
            </div>
          </div>
        </Section>

        {/* Line items */}
        <Section
          title="Line items"
          description="Quantities received or rejected for each ordered product."
          delay={0.1}
        >
          <Table wrapperClassName="border-slate-100 dark:border-slate-800">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Already received</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Receive now</TableHead>
                <TableHead className="text-right">Rejected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meta.map((line, index) => (
                <TableRow key={line.purchaseOrderItemId}>
                  <TableCell className="text-slate-700 dark:text-slate-300">
                    {line.productName}
                  </TableCell>
                  <TableCell className="nums text-right text-slate-600 dark:text-slate-400">
                    {line.ordered}
                  </TableCell>
                  <TableCell className="nums text-right text-slate-600 dark:text-slate-400">
                    {line.alreadyReceived}
                  </TableCell>
                  <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                    {line.outstanding}
                  </TableCell>
                  <TableCell className="text-right">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      aria-label={`Receive quantity for ${line.productName}`}
                      className={cn(cellClass, "ml-auto w-24 text-right")}
                      {...register(`items.${index}.receivedQuantity`)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      aria-label={`Rejected quantity for ${line.productName}`}
                      className={cn(cellClass, "ml-auto w-24 text-right")}
                      {...register(`items.${index}.rejectedQuantity`)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        {/* Notes */}
        <Section title="Notes" delay={0.15}>
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
        </Section>

        {/* Sticky action bar */}
        <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Receiving
            <span className="nums ml-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              {totalReceiving}
            </span>
            {totalRejected > 0 && (
              <span className="text-error-600 dark:text-error-400 ml-3">
                {totalRejected} rejected
              </span>
            )}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
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
        </div>
      </form>
    </div>
  );
}
