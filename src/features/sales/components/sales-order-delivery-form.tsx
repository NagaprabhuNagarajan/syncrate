"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Truck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { recordSalesOrderDeliveryAction } from "@/features/sales/actions/sales-order.actions";
import type { SalesOrderWithItems } from "@/features/sales/types/sales-order.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Form value shapes
// ─────────────────────────────────────────────────────────────

interface DeliveryLineValue {
  itemId: string;
  deliverQty: string;
}

interface DeliveryFormValues {
  items: DeliveryLineValue[];
}

interface DeliveryLineMeta {
  readonly itemId: string;
  readonly productName: string;
  readonly ordered: number;
  readonly alreadyDelivered: number;
  readonly remaining: number;
}

function num(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const cellClass = cn(
  "block w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-slate-900 shadow-sm transition-[border-color,box-shadow] duration-150 ease-out dark:text-slate-100",
  "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
);

// ─────────────────────────────────────────────────────────────
// Section chrome (mirrors sales-order-form)
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
// Sales order delivery form
// ─────────────────────────────────────────────────────────────

interface SalesOrderDeliveryFormProps {
  readonly organizationId: string;
  readonly salesOrder: SalesOrderWithItems;
  readonly productNames: Readonly<Record<string, string>>;
}

export function SalesOrderDeliveryForm({
  organizationId,
  salesOrder,
  productNames,
}: SalesOrderDeliveryFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const org = searchParams.get("org");
  const detailHref = org
    ? `/sales-orders/${salesOrder.id}?org=${org}`
    : `/sales-orders/${salesOrder.id}`;

  const meta: DeliveryLineMeta[] = useMemo(
    () =>
      salesOrder.items.map((item) => {
        const remaining = Math.max(0, item.quantity - item.deliveredQty);
        return {
          itemId: item.id,
          productName:
            productNames[item.productId] ?? item.description ?? item.productId,
          ordered: item.quantity,
          alreadyDelivered: item.deliveredQty,
          remaining,
        };
      }),
    [salesOrder.items, productNames]
  );

  const { register, handleSubmit, watch } = useForm<DeliveryFormValues>({
    defaultValues: {
      items: meta.map((line) => ({
        itemId: line.itemId,
        deliverQty: String(line.remaining),
      })),
    },
  });

  const watchedItems = watch("items");
  const totalDelivering = (watchedItems ?? []).reduce(
    (sum, item) => sum + num(item.deliverQty),
    0
  );

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const lines = values.items
      .map((item) => ({
        itemId: item.itemId,
        deliverQty: num(item.deliverQty),
      }))
      .filter((item) => item.deliverQty > 0);

    if (lines.length === 0) {
      setServerError("Enter a delivery quantity for at least one line.");
      return;
    }

    const fd = new FormData();
    fd.append("version", String(salesOrder.version));
    fd.append("lines", JSON.stringify(lines));

    startTransition(async () => {
      const result = await recordSalesOrderDeliveryAction(
        organizationId,
        salesOrder.id,
        fd
      );
      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }
      router.push(detailHref);
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
          <Truck className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Record delivery
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Record delivered quantities for{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {salesOrder.soNumber}
            </span>
          </p>
        </div>
      </motion.div>

      {serverError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-800 dark:text-error-300 mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <AlertCircle
            className="text-error-500 mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span>{serverError}</span>
        </motion.div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Line items */}
        <Section
          title="Line items"
          description="Quantities delivered for each ordered product."
          delay={0.05}
        >
          <Table wrapperClassName="border-slate-100 dark:border-slate-800">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Already delivered</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Deliver now</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meta.map((line, index) => (
                <TableRow key={line.itemId}>
                  <TableCell className="text-slate-700 dark:text-slate-300">
                    {line.productName}
                  </TableCell>
                  <TableCell className="nums text-right text-slate-600 dark:text-slate-400">
                    {line.ordered}
                  </TableCell>
                  <TableCell className="nums text-right text-slate-600 dark:text-slate-400">
                    {line.alreadyDelivered}
                  </TableCell>
                  <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                    {line.remaining}
                  </TableCell>
                  <TableCell className="text-right">
                    <input
                      type="number"
                      min={0}
                      max={line.remaining}
                      step="any"
                      aria-label={`Deliver quantity for ${line.productName}`}
                      className={cn(cellClass, "ml-auto w-24 text-right")}
                      {...register(`items.${index}.deliverQty`)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        {/* Sticky action bar */}
        <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Delivering
            <span className="nums ml-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              {totalDelivering}
            </span>
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(detailHref)}
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
              <Truck className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Record delivery
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

SalesOrderDeliveryForm.displayName = "SalesOrderDeliveryForm";
