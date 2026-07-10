"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ShoppingCart, AlertCircle, Plus, Trash2 } from "lucide-react";
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
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  PURCHASE_TAX_RATES,
} from "@/features/purchase/schemas/purchase-order.schemas";
import {
  createPurchaseOrderAction,
  updatePurchaseOrderAction,
} from "@/features/purchase/actions/purchase-order.actions";
import type { PurchaseOrderWithItems } from "@/features/purchase/types/purchase-order.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Option + form value shapes
// ─────────────────────────────────────────────────────────────

export interface SupplierOption {
  readonly id: string;
  readonly name: string;
}

export interface BranchOption {
  readonly id: string;
  readonly name: string;
}

export interface ProductOption {
  readonly id: string;
  readonly name: string;
  readonly purchasePrice: number;
  readonly gstRate: number;
}

interface LineItemValue {
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  taxRate: string;
}

interface PurchaseOrderFormValues {
  supplierId: string;
  branchId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  currency: string;
  notes: string;
  terms: string;
  /** Optimistic-lock version, present (and validated) only in edit mode. */
  version?: number;
  items: LineItemValue[];
}

// ─────────────────────────────────────────────────────────────
// Math (mirrors the server-side totals computation for live preview)
// ─────────────────────────────────────────────────────────────

function num(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

interface LineMath {
  readonly net: number;
  readonly tax: number;
  readonly lineTotal: number;
}

function computeLine(item: LineItemValue): LineMath {
  const gross = num(item.quantity) * num(item.unitPrice);
  const net = gross * (1 - num(item.discountPercent) / 100);
  const tax = round2(net * (num(item.taxRate) / 100));
  return { net, tax, lineTotal: round2(net + tax) };
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function emptyItem(): LineItemValue {
  return {
    productId: "",
    description: "",
    quantity: "1",
    unitPrice: "0",
    discountPercent: "0",
    taxRate: "0",
  };
}

// ─────────────────────────────────────────────────────────────
// Field helpers
// ─────────────────────────────────────────────────────────────

function FieldError({ message }: { readonly message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p
      className="text-error-600 dark:text-error-400 mt-1.5 flex items-center gap-1.5 text-xs"
      role="alert"
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

function FormField({
  label,
  htmlFor,
  required,
  children,
  error,
  hint,
}: {
  readonly label: string;
  readonly htmlFor: string;
  readonly required?: boolean;
  readonly children: React.ReactNode;
  readonly error?: string;
  readonly hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
        {required && (
          <span className="text-error-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      )}
      <FieldError message={error} />
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
  delay,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
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
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

const inputClass = (hasError: boolean) =>
  cn(
    "block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out",
    "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary",
    hasError
      ? "border-destructive bg-destructive/5"
      : "border-input bg-background hover:border-slate-400 dark:hover:border-slate-600"
  );

const cellClass = cn(
  "block w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm transition-[border-color,box-shadow]",
  "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
);

// ─────────────────────────────────────────────────────────────
// Purchase order form (create + edit)
// ─────────────────────────────────────────────────────────────

interface PurchaseOrderFormProps {
  readonly organizationId: string;
  readonly suppliers: readonly SupplierOption[];
  readonly branches: readonly BranchOption[];
  readonly products: readonly ProductOption[];
  readonly purchaseOrder?: PurchaseOrderWithItems;
}

export function PurchaseOrderForm({
  organizationId,
  suppliers,
  branches,
  products,
  purchaseOrder,
}: PurchaseOrderFormProps) {
  const router = useRouter();
  const isEdit = Boolean(purchaseOrder);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit
      ? zodResolver(updatePurchaseOrderSchema)
      : zodResolver(createPurchaseOrderSchema)
  ) as unknown as Resolver<PurchaseOrderFormValues>;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchaseOrderFormValues>({
    resolver,
    defaultValues: {
      supplierId: purchaseOrder?.supplierId ?? "",
      branchId: purchaseOrder?.branchId ?? "",
      orderDate: purchaseOrder
        ? purchaseOrder.orderDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: purchaseOrder?.expectedDeliveryDate
        ? purchaseOrder.expectedDeliveryDate.toISOString().slice(0, 10)
        : "",
      currency: purchaseOrder?.currency ?? "INR",
      notes: purchaseOrder?.notes ?? "",
      terms: purchaseOrder?.terms ?? "",
      version: purchaseOrder?.version,
      items:
        purchaseOrder && purchaseOrder.items.length > 0
          ? purchaseOrder.items.map((item) => ({
              productId: item.productId,
              description: item.description ?? "",
              quantity: String(item.quantity),
              unitPrice: String(item.unitPrice),
              discountPercent: String(item.discountPercent),
              taxRate: String(item.taxRate),
            }))
          : [emptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray<PurchaseOrderFormValues>({
    control,
    name: "items",
  });

  const watchedItems = watch("items");

  const lines = (watchedItems ?? []).map(computeLine);
  const subtotal = round2(
    (watchedItems ?? []).reduce(
      (sum, item) => sum + num(item.quantity) * num(item.unitPrice),
      0
    )
  );
  const discountTotal = round2(
    (watchedItems ?? []).reduce((sum, item) => {
      const gross = num(item.quantity) * num(item.unitPrice);
      return sum + gross * (num(item.discountPercent) / 100);
    }, 0)
  );
  const taxTotal = round2(lines.reduce((sum, line) => sum + line.tax, 0));
  const grandTotal = round2(subtotal - discountTotal + taxTotal);

  const itemsError =
    typeof errors.items?.message === "string" ? errors.items.message : undefined;

  const handleProductChange = (index: number, productId: string): void => {
    setValue(`items.${index}.productId`, productId, { shouldValidate: true });
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.unitPrice`, String(product.purchasePrice));
      const matchedRate = PURCHASE_TAX_RATES.includes(
        product.gstRate as (typeof PURCHASE_TAX_RATES)[number]
      )
        ? product.gstRate
        : 0;
      setValue(`items.${index}.taxRate`, String(matchedRate));
    }
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("supplierId", values.supplierId);
    if (values.branchId) {
      fd.append("branchId", values.branchId);
    }
    if (values.orderDate) {
      fd.append("orderDate", values.orderDate);
    }
    if (values.expectedDeliveryDate) {
      fd.append("expectedDeliveryDate", values.expectedDeliveryDate);
    }
    if (values.currency) {
      fd.append("currency", values.currency);
    }
    if (values.notes.trim()) {
      fd.append("notes", values.notes.trim());
    }
    if (values.terms.trim()) {
      fd.append("terms", values.terms.trim());
    }
    // In edit mode carry the loaded version so the update is optimistically
    // locked — the server rejects the write if the order moved on since load.
    if (isEdit && purchaseOrder) {
      fd.append("version", String(purchaseOrder.version));
    }

    const items = values.items.map((item) => ({
      productId: item.productId,
      description: item.description.trim() || undefined,
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      discountPercent: num(item.discountPercent),
      taxRate: num(item.taxRate),
    }));
    fd.append("items", JSON.stringify(items));

    startTransition(async () => {
      const result =
        isEdit && purchaseOrder
          ? await updatePurchaseOrderAction(organizationId, purchaseOrder.id, fd)
          : await createPurchaseOrderAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      const id = result.success ? result.data.id : purchaseOrder?.id;
      router.push(id ? `/purchases/${id}` : "/purchases");
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
          <ShoppingCart className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit purchase order" : "New purchase order"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the draft purchase order"
              : "Raise a purchase order for one of your suppliers"}
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

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Purchase order details */}
        <Section
          title="Purchase order details"
          description="Supplier, branch and scheduling for this order."
          delay={0.05}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Supplier"
                htmlFor="supplierId"
                required
                error={errors.supplierId?.message}
              >
                <select
                  id="supplierId"
                  className={inputClass(!!errors.supplierId)}
                  {...register("supplierId")}
                >
                  <option value="">— Select supplier —</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Branch"
                htmlFor="branchId"
                error={errors.branchId?.message}
              >
                <select
                  id="branchId"
                  className={inputClass(!!errors.branchId)}
                  {...register("branchId")}
                >
                  <option value="">— None —</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                label="Order date"
                htmlFor="orderDate"
                error={errors.orderDate?.message}
              >
                <input
                  id="orderDate"
                  type="date"
                  className={inputClass(!!errors.orderDate)}
                  {...register("orderDate")}
                />
              </FormField>
              <FormField
                label="Expected delivery"
                htmlFor="expectedDeliveryDate"
                error={errors.expectedDeliveryDate?.message}
              >
                <input
                  id="expectedDeliveryDate"
                  type="date"
                  className={inputClass(!!errors.expectedDeliveryDate)}
                  {...register("expectedDeliveryDate")}
                />
              </FormField>
              <FormField
                label="Currency"
                htmlFor="currency"
                error={errors.currency?.message}
              >
                <input
                  id="currency"
                  type="text"
                  maxLength={3}
                  className={cn(inputClass(!!errors.currency), "uppercase")}
                  placeholder="INR"
                  {...register("currency")}
                />
              </FormField>
            </div>
          </div>
        </Section>

        {/* Line items */}
        <Section title="Line items" delay={0.1}>
          {itemsError && <FieldError message={itemsError} />}

          <Table wrapperClassName="border-slate-100 dark:border-slate-800">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit price</TableHead>
                <TableHead>Disc %</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead className="text-right">Line total</TableHead>
                <TableHead>
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const rowErrors = errors.items?.[index];
                return (
                  <TableRow key={field.id} className="align-top">
                    <TableCell>
                      <select
                        aria-label={`Product for line ${index + 1}`}
                        className={cellClass}
                        value={watchedItems?.[index]?.productId ?? ""}
                        onChange={(e) =>
                          handleProductChange(index, e.target.value)
                        }
                      >
                        <option value="">— Select —</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                      <FieldError message={rowErrors?.productId?.message} />
                    </TableCell>
                    <TableCell>
                      <input
                        aria-label={`Quantity for line ${index + 1}`}
                        type="number"
                        min={0}
                        step="any"
                        className={cn(cellClass, "w-20")}
                        {...register(`items.${index}.quantity`)}
                      />
                      <FieldError message={rowErrors?.quantity?.message} />
                    </TableCell>
                    <TableCell>
                      <input
                        aria-label={`Unit price for line ${index + 1}`}
                        type="number"
                        min={0}
                        step="0.01"
                        className={cn(cellClass, "w-28")}
                        {...register(`items.${index}.unitPrice`)}
                      />
                      <FieldError message={rowErrors?.unitPrice?.message} />
                    </TableCell>
                    <TableCell>
                      <input
                        aria-label={`Discount percent for line ${index + 1}`}
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        className={cn(cellClass, "w-20")}
                        {...register(`items.${index}.discountPercent`)}
                      />
                      <FieldError
                        message={rowErrors?.discountPercent?.message}
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        aria-label={`Tax rate for line ${index + 1}`}
                        className={cn(cellClass, "w-20")}
                        {...register(`items.${index}.taxRate`)}
                      >
                        {PURCHASE_TAX_RATES.map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}%
                          </option>
                        ))}
                      </select>
                      <FieldError message={rowErrors?.taxRate?.message} />
                    </TableCell>
                    <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(lines[index]?.lineTotal ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove line ${index + 1}`}
                        disabled={fields.length <= 1}
                        onClick={() => remove(index)}
                        className="text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10 hover:text-error-700"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => append(emptyItem())}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add item
          </Button>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <dl className="w-full max-w-xs space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">
                  Subtotal
                </dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">
                  Discount
                </dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  −{formatCurrency(discountTotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Tax</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(taxTotal)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                <dt>Grand total</dt>
                <dd className="nums">{formatCurrency(grandTotal)}</dd>
              </div>
            </dl>
          </div>
        </Section>

        {/* Terms & notes */}
        <Section
          title="Terms & notes"
          description="Optional terms and internal notes for this order."
          delay={0.15}
        >
          <div className="space-y-3">
            <FormField
              label="Terms"
              htmlFor="terms"
              error={errors.terms?.message}
            >
              <textarea
                id="terms"
                rows={2}
                className={inputClass(!!errors.terms)}
                placeholder="Payment terms, delivery conditions…"
                {...register("terms")}
              />
            </FormField>
            <FormField
              label="Notes"
              htmlFor="notes"
              error={errors.notes?.message}
            >
              <textarea
                id="notes"
                rows={2}
                className={inputClass(!!errors.notes)}
                placeholder="Internal notes about this purchase order"
                {...register("notes")}
              />
            </FormField>
          </div>
        </Section>

        {/* Sticky action bar */}
        <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Grand total
            <span className="nums ml-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              {formatCurrency(grandTotal)}
            </span>
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/purchases")}
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
              {isEdit ? "Save changes" : "Create purchase order"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
