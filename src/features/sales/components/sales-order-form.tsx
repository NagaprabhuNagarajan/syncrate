"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { TrendingUp, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createSalesOrderSchema,
  updateSalesOrderSchema,
  SALES_GST_RATES,
} from "@/features/sales/schemas/sales-order.schemas";
import {
  createSalesOrderAction,
  updateSalesOrderAction,
} from "@/features/sales/actions/sales-order.actions";
import type { SalesOrderWithItems } from "@/features/sales/types/sales-order.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Option types
// ─────────────────────────────────────────────────────────────

export interface CustomerOption {
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
  readonly sellingPrice: number;
  readonly gstRate: number;
}

// ─────────────────────────────────────────────────────────────
// Form value shapes
// ─────────────────────────────────────────────────────────────

interface LineItemValue {
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  gstRate: string;
}

interface SalesOrderFormValues {
  customerId: string;
  branchId: string;
  orderDate: string;
  deliveryDate: string;
  paymentTermsDays: string;
  supplyState: string;
  notes: string;
  terms: string;
  version?: number;
  items: LineItemValue[];
}

// ─────────────────────────────────────────────────────────────
// GST calculation (inline)
// ─────────────────────────────────────────────────────────────

function num(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

interface LineGST {
  readonly net: number;
  readonly taxable: number;
  readonly cgst: number;
  readonly sgst: number;
  readonly igst: number;
  readonly lineTotal: number;
  readonly isIntra: boolean;
}

function computeLineGST(
  item: LineItemValue,
  orgState: string,
  supplyState: string
): LineGST {
  const gross = round2(num(item.quantity) * num(item.unitPrice));
  const disc = round2(gross * (num(item.discountPercent) / 100));
  const taxable = round2(gross - disc);
  const rate = num(item.gstRate);

  const isIntra =
    orgState.trim() !== "" &&
    supplyState.trim() !== "" &&
    orgState.trim().toLowerCase() === supplyState.trim().toLowerCase();

  const taxAmount = round2(taxable * (rate / 100));
  const cgst = isIntra ? round2(taxAmount / 2) : 0;
  const sgst = isIntra ? round2(taxAmount / 2) : 0;
  const igst = isIntra ? 0 : taxAmount;

  return { net: gross, taxable, cgst, sgst, igst, lineTotal: round2(taxable + taxAmount), isIntra };
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
    gstRate: "0",
  };
}

// ─────────────────────────────────────────────────────────────
// Field helpers
// ─────────────────────────────────────────────────────────────

function FieldError({ message }: { readonly message?: string }) {
  if (!message) {return null;}
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
      {hint && !error && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

function SectionTitle({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {children}
      </span>
      <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
    </div>
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
  "block w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-sm",
  "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
);

// ─────────────────────────────────────────────────────────────
// Sales order form
// ─────────────────────────────────────────────────────────────

interface SalesOrderFormProps {
  readonly organizationId: string;
  readonly orgState?: string;
  readonly customers: readonly CustomerOption[];
  readonly branches: readonly BranchOption[];
  readonly products: readonly ProductOption[];
  readonly salesOrder?: SalesOrderWithItems;
}

export function SalesOrderForm({
  organizationId,
  orgState = "",
  customers,
  branches,
  products,
  salesOrder,
}: SalesOrderFormProps) {
  const router = useRouter();
  const isEdit = Boolean(salesOrder);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit
      ? zodResolver(updateSalesOrderSchema)
      : zodResolver(createSalesOrderSchema)
  ) as unknown as Resolver<SalesOrderFormValues>;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SalesOrderFormValues>({
    resolver,
    defaultValues: {
      customerId: salesOrder?.customerId ?? "",
      branchId: salesOrder?.branchId ?? "",
      orderDate: salesOrder
        ? salesOrder.orderDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      deliveryDate: salesOrder?.deliveryDate
        ? salesOrder.deliveryDate.toISOString().slice(0, 10)
        : "",
      paymentTermsDays: String(salesOrder?.paymentTermsDays ?? 30),
      supplyState: salesOrder?.supplyState ?? "",
      notes: salesOrder?.notes ?? "",
      terms: salesOrder?.terms ?? "",
      version: salesOrder?.version,
      items:
        salesOrder && salesOrder.items.length > 0
          ? salesOrder.items.map((item) => ({
              productId: item.productId,
              description: item.description ?? "",
              quantity: String(item.quantity),
              unitPrice: String(item.unitPrice),
              discountPercent: String(item.discountPercent),
              gstRate: String(item.gstRate),
            }))
          : [emptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray<SalesOrderFormValues>({
    control,
    name: "items",
  });

  const watchedItems = watch("items");
  const watchedSupplyState = watch("supplyState");

  const lines = (watchedItems ?? []).map((item) =>
    computeLineGST(item, orgState, watchedSupplyState ?? "")
  );

  const isIntra =
    lines.length > 0 &&
    lines.every((l) => l.isIntra) &&
    watchedSupplyState?.trim() !== "";

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
  const cgstTotal = round2(lines.reduce((sum, l) => sum + l.cgst, 0));
  const sgstTotal = round2(lines.reduce((sum, l) => sum + l.sgst, 0));
  const igstTotal = round2(lines.reduce((sum, l) => sum + l.igst, 0));
  const grandTotal = round2(
    subtotal - discountTotal + cgstTotal + sgstTotal + igstTotal
  );

  const itemsError =
    typeof errors.items?.message === "string" ? errors.items.message : undefined;

  const handleProductChange = (index: number, productId: string): void => {
    setValue(`items.${index}.productId`, productId, { shouldValidate: true });
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.unitPrice`, String(product.sellingPrice));
      const matchedRate = SALES_GST_RATES.includes(
        product.gstRate as (typeof SALES_GST_RATES)[number]
      )
        ? product.gstRate
        : 0;
      setValue(`items.${index}.gstRate`, String(matchedRate));
    }
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("customerId", values.customerId);
    if (values.branchId) {fd.append("branchId", values.branchId);}
    if (values.orderDate) {fd.append("orderDate", values.orderDate);}
    if (values.deliveryDate) {fd.append("deliveryDate", values.deliveryDate);}
    if (values.paymentTermsDays)
      {fd.append("paymentTermsDays", values.paymentTermsDays);}
    if (values.supplyState.trim())
      {fd.append("supplyState", values.supplyState.trim());}
    if (values.notes.trim()) {fd.append("notes", values.notes.trim());}
    if (values.terms.trim()) {fd.append("terms", values.terms.trim());}
    if (isEdit && salesOrder)
      {fd.append("version", String(salesOrder.version));}

    const items = values.items.map((item) => ({
      productId: item.productId,
      description: item.description.trim() || undefined,
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      discountPercent: num(item.discountPercent),
      gstRate: num(item.gstRate),
    }));
    fd.append("items", JSON.stringify(items));

    startTransition(async () => {
      const result =
        isEdit && salesOrder
          ? await updateSalesOrderAction(organizationId, salesOrder.id, fd)
          : await createSalesOrderAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      if (result.success) {
        router.push(`/sales-orders/${result.data.id}`);
      } else {
        router.push("/sales-orders");
      }
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-lg shadow-slate-200/50 dark:shadow-none sm:p-6"
    >
      {/* Header */}
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <TrendingUp
            className="h-5 w-5 text-white"
            aria-hidden="true"
          />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit sales order" : "New sales order"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update this draft sales order"
              : "Create a confirmed sales order for a customer"}
          </p>
        </div>
      </div>

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
        {/* Header fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Customer"
            htmlFor="customerId"
            required
            error={errors.customerId?.message}
          >
            <select
              id="customerId"
              className={inputClass(!!errors.customerId)}
              {...register("customerId")}
            >
              <option value="">— Select customer —</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
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
            label="Delivery date"
            htmlFor="deliveryDate"
            error={errors.deliveryDate?.message}
          >
            <input
              id="deliveryDate"
              type="date"
              className={inputClass(!!errors.deliveryDate)}
              {...register("deliveryDate")}
            />
          </FormField>
          <FormField
            label="Payment terms (days)"
            htmlFor="paymentTermsDays"
            error={errors.paymentTermsDays?.message}
          >
            <input
              id="paymentTermsDays"
              type="number"
              min={0}
              max={365}
              className={inputClass(!!errors.paymentTermsDays)}
              placeholder="30"
              {...register("paymentTermsDays")}
            />
          </FormField>
        </div>

        <FormField
          label="Supply state"
          htmlFor="supplyState"
          error={errors.supplyState?.message}
          hint="Enter the state where goods/services are delivered (determines CGST+SGST vs IGST)"
        >
          <input
            id="supplyState"
            type="text"
            placeholder="e.g. Karnataka"
            className={inputClass(!!errors.supplyState)}
            {...register("supplyState")}
          />
        </FormField>

        {/* Line items */}
        <SectionTitle>Line items</SectionTitle>
        {itemsError && <FieldError message={itemsError} />}

        {watchedSupplyState?.trim() && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
            {isIntra ? (
              <span>
                Intra-state supply to <strong>{watchedSupplyState}</strong> —
                CGST + SGST applied
              </span>
            ) : (
              <span>Inter-state supply — IGST applied</span>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <tr>
                <th scope="col" className="px-2 py-2 font-medium">
                  Product
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Qty
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Unit price
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Disc %
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  GST %
                </th>
                {isIntra ? (
                  <>
                    <th scope="col" className="px-2 py-2 font-medium">
                      CGST
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium">
                      SGST
                    </th>
                  </>
                ) : (
                  <th scope="col" className="px-2 py-2 font-medium">
                    IGST
                  </th>
                )}
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Line total
                </th>
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const rowErrors = errors.items?.[index];
                const lineGST = lines[index];
                return (
                  <tr key={field.id} className="align-top">
                    <td className="px-2 py-2">
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
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Quantity for line ${index + 1}`}
                        type="number"
                        min={0}
                        step="any"
                        className={cn(cellClass, "w-20")}
                        {...register(`items.${index}.quantity`)}
                      />
                      <FieldError message={rowErrors?.quantity?.message} />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        aria-label={`Unit price for line ${index + 1}`}
                        type="number"
                        min={0}
                        step="0.01"
                        className={cn(cellClass, "w-28")}
                        {...register(`items.${index}.unitPrice`)}
                      />
                      <FieldError message={rowErrors?.unitPrice?.message} />
                    </td>
                    <td className="px-2 py-2">
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
                    </td>
                    <td className="px-2 py-2">
                      <select
                        aria-label={`GST rate for line ${index + 1}`}
                        className={cn(cellClass, "w-20")}
                        {...register(`items.${index}.gstRate`)}
                      >
                        {SALES_GST_RATES.map((rate) => (
                          <option key={rate} value={rate}>
                            {rate}%
                          </option>
                        ))}
                      </select>
                      <FieldError message={rowErrors?.gstRate?.message} />
                    </td>
                    {isIntra ? (
                      <>
                        <td className="px-2 py-2 nums text-slate-500 dark:text-slate-400 text-xs">
                          {lineGST ? formatCurrency(lineGST.cgst) : "—"}
                        </td>
                        <td className="px-2 py-2 nums text-slate-500 dark:text-slate-400 text-xs">
                          {lineGST ? formatCurrency(lineGST.sgst) : "—"}
                        </td>
                      </>
                    ) : (
                      <td className="px-2 py-2 nums text-slate-500 dark:text-slate-400 text-xs">
                        {lineGST ? formatCurrency(lineGST.igst) : "—"}
                      </td>
                    )}
                    <td className="px-2 py-2 text-right nums font-medium text-slate-900 dark:text-slate-100">
                      {lineGST ? formatCurrency(lineGST.lineTotal) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove line ${index + 1}`}
                        disabled={fields.length <= 1}
                        onClick={() => remove(index)}
                        className="text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-500/10 hover:text-error-700 dark:hover:text-error-300"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(emptyItem())}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add item
        </Button>

        {/* Totals */}
        <div className="flex justify-end">
          <dl className="w-full max-w-xs space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Subtotal</dt>
              <dd className="nums text-slate-700 dark:text-slate-300">
                {formatCurrency(subtotal)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Discount</dt>
              <dd className="nums text-slate-700 dark:text-slate-300">
                −{formatCurrency(discountTotal)}
              </dd>
            </div>
            {isIntra ? (
              <>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">CGST</dt>
                  <dd className="nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(cgstTotal)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">SGST</dt>
                  <dd className="nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(sgstTotal)}
                  </dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">IGST</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(igstTotal)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              <dt>Grand total</dt>
              <dd className="nums">{formatCurrency(grandTotal)}</dd>
            </div>
          </dl>
        </div>

        {/* Terms & notes */}
        <SectionTitle>Terms &amp; notes</SectionTitle>
        <FormField label="Terms" htmlFor="terms" error={errors.terms?.message}>
          <textarea
            id="terms"
            rows={2}
            className={inputClass(!!errors.terms)}
            placeholder="Payment terms, delivery conditions…"
            {...register("terms")}
          />
        </FormField>
        <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
          <textarea
            id="notes"
            rows={2}
            className={inputClass(!!errors.notes)}
            placeholder="Internal notes about this sales order"
            {...register("notes")}
          />
        </FormField>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/sales-orders")}
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
            {isEdit ? "Save changes" : "Create sales order"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
