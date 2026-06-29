"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { RotateCcw, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createSalesReturnSchema,
  updateSalesReturnSchema,
  SALES_RETURN_REASONS,
  SALES_RETURN_TAX_RATES,
  type CreateSalesReturnFormValues,
} from "@/features/sales/schemas/sales-return.schemas";
import {
  createSalesReturnAction,
} from "@/features/sales/actions/sales-return.actions";
import type { SalesReturnWithItems } from "@/features/sales/types/sales-return.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Option shapes
// ─────────────────────────────────────────────────────────────

export interface CustomerOption {
  readonly id: string;
  readonly name: string;
}

export interface ProductOption {
  readonly id: string;
  readonly name: string;
  readonly salePrice: number;
  readonly gstRate: number;
}

export interface WarehouseOption {
  readonly id: string;
  readonly name: string;
}

// ─────────────────────────────────────────────────────────────
// Math
// ─────────────────────────────────────────────────────────────

type FormItemValues = CreateSalesReturnFormValues["items"][number];

function num(value: string | number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function computeLine(item: FormItemValues): {
  net: number;
  tax: number;
  lineTotal: number;
} {
  const net = round2(num(item.quantity) * num(item.unitPrice));
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

function emptyItem(): FormItemValues {
  return {
    productId: "",
    quantity: 1,
    unitPrice: 0,
    taxRate: 18,
    batchId: "",
  };
}

const REASON_LABELS: Record<(typeof SALES_RETURN_REASONS)[number], string> = {
  damaged: "Damaged",
  wrong_product: "Wrong product",
  expired: "Expired",
  customer_rejection: "Customer rejection",
  warranty: "Warranty",
  other: "Other",
};

// ─────────────────────────────────────────────────────────────
// Field helpers
// ─────────────────────────────────────────────────────────────

function FieldError({ message }: { readonly message?: string }) {
  if (!message) {return null;}
  return (
    <p className="text-error-600 dark:text-error-400 mt-1.5 flex items-center gap-1.5 text-xs" role="alert">
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
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && (
          <span className="text-error-500 ml-0.5" aria-hidden="true">*</span>
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
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{children}</span>
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
// Sales return form
// ─────────────────────────────────────────────────────────────

interface SalesReturnFormProps {
  readonly organizationId: string;
  readonly customers: readonly CustomerOption[];
  readonly products: readonly ProductOption[];
  readonly warehouses: readonly WarehouseOption[];
  readonly salesReturn?: SalesReturnWithItems;
  /** Pre-populate the invoice reference. */
  readonly defaultInvoiceId?: string;
  readonly defaultCustomerId?: string;
}

export function SalesReturnForm({
  organizationId,
  customers,
  products,
  warehouses,
  salesReturn,
  defaultInvoiceId,
  defaultCustomerId,
}: SalesReturnFormProps) {
  const router = useRouter();
  const isEdit = Boolean(salesReturn);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit
      ? zodResolver(updateSalesReturnSchema)
      : zodResolver(createSalesReturnSchema)
  ) as unknown as Resolver<CreateSalesReturnFormValues>;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateSalesReturnFormValues>({
    resolver,
    defaultValues: {
      returnNumber: salesReturn?.returnNumber ?? "",
      invoiceId: salesReturn?.invoiceId ?? defaultInvoiceId ?? "",
      customerId: salesReturn?.customerId ?? defaultCustomerId ?? "",
      warehouseId: salesReturn?.warehouseId ?? "",
      returnDate: salesReturn
        ? salesReturn.returnDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      reason: salesReturn?.reason ?? "damaged",
      notes: salesReturn?.notes ?? "",
      items:
        salesReturn && salesReturn.items.length > 0
          ? salesReturn.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              batchId: item.batchId ?? "",
            }))
          : [emptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray<CreateSalesReturnFormValues>({
    control,
    name: "items",
  });

  const watchedItems = watch("items");

  const lines = (watchedItems ?? []).map(computeLine);
  const subtotal = round2(lines.reduce((s, l) => s + l.net, 0));
  const taxTotal = round2(lines.reduce((s, l) => s + l.tax, 0));
  const grandTotal = round2(subtotal + taxTotal);

  const itemsError =
    typeof errors.items?.message === "string" ? errors.items.message : undefined;

  const handleProductChange = (index: number, productId: string): void => {
    setValue(`items.${index}.productId`, productId, { shouldValidate: true });
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.unitPrice`, product.salePrice);
      const matchedRate = SALES_RETURN_TAX_RATES.includes(
        product.gstRate as (typeof SALES_RETURN_TAX_RATES)[number]
      )
        ? product.gstRate
        : 18;
      setValue(`items.${index}.taxRate`, matchedRate);
    }
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("customerId", values.customerId);
    fd.append("reason", values.reason);
    if (values.returnNumber?.trim()) {fd.append("returnNumber", values.returnNumber.trim());}
    if (values.invoiceId?.trim()) {fd.append("invoiceId", values.invoiceId.trim());}
    if (values.warehouseId?.trim()) {fd.append("warehouseId", values.warehouseId.trim());}
    if (values.returnDate) {fd.append("returnDate", values.returnDate);}
    if (values.notes?.trim()) {fd.append("notes", values.notes.trim());}
    if (isEdit && salesReturn) {
      fd.append("version", String(salesReturn.version ?? 1));
    }

    const items = values.items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate ?? 0),
      batchId: item.batchId?.trim() || undefined,
    }));
    fd.append("items", JSON.stringify(items));

    startTransition(async () => {
      const result = await createSalesReturnAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      const id = result.success ? result.data.id : salesReturn?.id;
      router.push(id ? `/sales/returns/${id}` : "/sales/returns");
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-5 shadow-lg shadow-slate-200/50 dark:shadow-none sm:p-6"
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <RotateCcw className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit sales return" : "New sales return"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
            {isEdit
              ? "Update the draft sales return"
              : "Record goods returned by a customer"}
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
          <AlertCircle className="text-error-500 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{serverError}</span>
        </motion.div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {isEdit && salesReturn && (
          <input type="hidden" name="version" value={String(salesReturn.version ?? 1)} readOnly />
        )}

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
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Return reason"
            htmlFor="reason"
            required
            error={errors.reason?.message}
          >
            <select
              id="reason"
              className={inputClass(!!errors.reason)}
              {...register("reason")}
            >
              {SALES_RETURN_REASONS.map((r) => (
                <option key={r} value={r}>{REASON_LABELS[r]}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            label="Return date"
            htmlFor="returnDate"
            error={errors.returnDate?.message}
          >
            <input
              id="returnDate"
              type="date"
              className={inputClass(!!errors.returnDate)}
              {...register("returnDate")}
            />
          </FormField>
          <FormField
            label="Invoice reference"
            htmlFor="invoiceId"
            error={errors.invoiceId?.message}
            hint="Optional: link to the original invoice"
          >
            <input
              id="invoiceId"
              type="text"
              placeholder="Invoice ID"
              className={inputClass(!!errors.invoiceId)}
              {...register("invoiceId")}
            />
          </FormField>
          <FormField
            label="Return to warehouse"
            htmlFor="warehouseId"
            error={errors.warehouseId?.message}
          >
            <select
              id="warehouseId"
              className={inputClass(!!errors.warehouseId)}
              {...register("warehouseId")}
            >
              <option value="">— Optional —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Optional return number */}
        <FormField
          label="Return number"
          htmlFor="returnNumber"
          hint="Leave blank to auto-generate"
          error={errors.returnNumber?.message}
        >
          <input
            id="returnNumber"
            type="text"
            placeholder="Auto-generated"
            className={inputClass(!!errors.returnNumber)}
            {...register("returnNumber")}
          />
        </FormField>

        {/* Line items */}
        <SectionTitle>Line items</SectionTitle>
        {itemsError && <FieldError message={itemsError} />}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <tr>
                <th scope="col" className="px-2 py-2 font-medium">Product</th>
                <th scope="col" className="px-2 py-2 font-medium">Qty</th>
                <th scope="col" className="px-2 py-2 font-medium">Unit price</th>
                <th scope="col" className="px-2 py-2 font-medium">Tax %</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Line total</th>
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const rowErrors = errors.items?.[index];
                return (
                  <tr key={field.id} className="align-top">
                    <td className="px-2 py-2">
                      <select
                        aria-label={`Product for line ${index + 1}`}
                        className={cn(cellClass, "min-w-[140px]")}
                        value={watchedItems?.[index]?.productId ?? ""}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                      >
                        <option value="">— Select —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
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
                      <select
                        aria-label={`Tax rate for line ${index + 1}`}
                        className={cn(cellClass, "w-20")}
                        {...register(`items.${index}.taxRate`)}
                      >
                        {SALES_RETURN_TAX_RATES.map((rate) => (
                          <option key={rate} value={rate}>{rate}%</option>
                        ))}
                      </select>
                      <FieldError message={rowErrors?.taxRate?.message} />
                    </td>
                    <td className="px-2 py-2 text-right nums font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(lines[index]?.lineTotal ?? 0)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove line ${index + 1}`}
                        disabled={fields.length <= 1}
                        onClick={() => remove(index)}
                        className="text-error-600 hover:bg-error-50 hover:text-error-700"
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
              <dt className="text-slate-500 dark:text-slate-400 dark:text-slate-500">Subtotal</dt>
              <dd className="nums text-slate-700 dark:text-slate-300">{formatCurrency(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400 dark:text-slate-500">Tax</dt>
              <dd className="nums text-slate-700 dark:text-slate-300">{formatCurrency(taxTotal)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <dt>Total credit</dt>
              <dd className="nums">{formatCurrency(grandTotal)}</dd>
            </div>
          </dl>
        </div>

        {/* Notes */}
        <SectionTitle>Notes</SectionTitle>
        <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
          <textarea
            id="notes"
            rows={2}
            className={inputClass(!!errors.notes)}
            placeholder="Internal notes about this return"
            {...register("notes")}
          />
        </FormField>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/sales/returns")}
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
            {isEdit ? "Save changes" : "Create return"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
