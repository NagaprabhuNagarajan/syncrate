"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { FileText, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createPurchaseInvoiceSchema,
  updatePurchaseInvoiceSchema,
  PURCHASE_TAX_RATES,
} from "@/features/purchase/schemas/purchase-invoice.schemas";
import {
  createPurchaseInvoiceAction,
  updatePurchaseInvoiceAction,
} from "@/features/purchase/actions/purchase-invoice.actions";
import type { PurchaseInvoiceWithItems } from "@/features/purchase/types/purchase-invoice.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Option + form value shapes
// ─────────────────────────────────────────────────────────────

export interface SupplierOption {
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
  taxRate: string;
}

interface PurchaseInvoiceFormValues {
  supplierId: string;
  invoiceNumber: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  notes: string;
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
  const net = num(item.quantity) * num(item.unitPrice);
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
      className="text-error-600 mt-1.5 flex items-center gap-1.5 text-xs"
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
        className="mb-1.5 block text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span className="text-error-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

function SectionTitle({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 border-t border-slate-100" />
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {children}
      </span>
      <div className="flex-1 border-t border-slate-100" />
    </div>
  );
}

const inputClass = (hasError: boolean) =>
  cn(
    "block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
    hasError
      ? "border-error-400 bg-error-50/30"
      : "border-slate-300 bg-white hover:border-slate-400"
  );

const cellClass = cn(
  "block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm",
  "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
);

// ─────────────────────────────────────────────────────────────
// Purchase invoice form (create + edit)
// ─────────────────────────────────────────────────────────────

interface PurchaseInvoiceFormProps {
  readonly organizationId: string;
  readonly suppliers: readonly SupplierOption[];
  readonly products: readonly ProductOption[];
  readonly purchaseInvoice?: PurchaseInvoiceWithItems;
}

export function PurchaseInvoiceForm({
  organizationId,
  suppliers,
  products,
  purchaseInvoice,
}: PurchaseInvoiceFormProps) {
  const router = useRouter();
  const isEdit = Boolean(purchaseInvoice);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit
      ? zodResolver(updatePurchaseInvoiceSchema)
      : zodResolver(createPurchaseInvoiceSchema)
  ) as unknown as Resolver<PurchaseInvoiceFormValues>;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchaseInvoiceFormValues>({
    resolver,
    defaultValues: {
      supplierId: purchaseInvoice?.supplierId ?? "",
      invoiceNumber: purchaseInvoice?.invoiceNumber ?? "",
      supplierInvoiceNumber: purchaseInvoice?.supplierInvoiceNumber ?? "",
      invoiceDate: purchaseInvoice
        ? purchaseInvoice.invoiceDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      dueDate: purchaseInvoice?.dueDate
        ? purchaseInvoice.dueDate.toISOString().slice(0, 10)
        : "",
      notes: purchaseInvoice?.notes ?? "",
      items:
        purchaseInvoice && purchaseInvoice.items.length > 0
          ? purchaseInvoice.items.map((item) => ({
              productId: item.productId,
              description: item.description ?? "",
              quantity: String(item.quantity),
              unitPrice: String(item.unitPrice),
              taxRate: String(item.taxRate),
            }))
          : [emptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray<PurchaseInvoiceFormValues>({
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
  const taxTotal = round2(lines.reduce((sum, line) => sum + line.tax, 0));
  const grandTotal = round2(subtotal + taxTotal);

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
    if (values.invoiceNumber.trim()) {
      fd.append("invoiceNumber", values.invoiceNumber.trim());
    }
    if (values.supplierInvoiceNumber.trim()) {
      fd.append("supplierInvoiceNumber", values.supplierInvoiceNumber.trim());
    }
    if (values.invoiceDate) {
      fd.append("invoiceDate", values.invoiceDate);
    }
    if (values.dueDate) {
      fd.append("dueDate", values.dueDate);
    }
    if (values.notes.trim()) {
      fd.append("notes", values.notes.trim());
    }
    if (isEdit && purchaseInvoice) {
      // Carry the optimistic-lock version so the server can detect a stale edit.
      fd.append("version", String(purchaseInvoice.version ?? 1));
    }

    const items = values.items.map((item) => ({
      productId: item.productId,
      description: item.description.trim() || undefined,
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      taxRate: num(item.taxRate),
    }));
    fd.append("items", JSON.stringify(items));

    startTransition(async () => {
      const result =
        isEdit && purchaseInvoice
          ? await updatePurchaseInvoiceAction(
              organizationId,
              purchaseInvoice.id,
              fd
            )
          : await createPurchaseInvoiceAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      const id = result.success ? result.data.id : purchaseInvoice?.id;
      router.push(id ? `/purchases/invoices/${id}` : "/purchases/invoices");
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/60 bg-white px-6 py-6 shadow-xl shadow-slate-200/50 sm:px-8 sm:py-8"
    >
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50">
          <FileText className="h-5 w-5 text-primary-600" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            {isEdit ? "Edit purchase invoice" : "New purchase invoice"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Update the draft purchase invoice"
              : "Record a supplier bill against your business"}
          </p>
        </div>
      </div>

      {serverError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="border-error-200 bg-error-50 text-error-800 mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <AlertCircle
            className="text-error-500 mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span>{serverError}</span>
        </motion.div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {isEdit && purchaseInvoice && (
          <input
            type="hidden"
            name="version"
            value={String(purchaseInvoice.version ?? 1)}
            readOnly
          />
        )}
        {/* Header fields */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
            label="Supplier invoice no."
            htmlFor="supplierInvoiceNumber"
            error={errors.supplierInvoiceNumber?.message}
          >
            <input
              id="supplierInvoiceNumber"
              type="text"
              className={inputClass(!!errors.supplierInvoiceNumber)}
              placeholder="Bill number on the supplier's invoice"
              {...register("supplierInvoiceNumber")}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <FormField
            label="Invoice number"
            htmlFor="invoiceNumber"
            error={errors.invoiceNumber?.message}
            hint="Leave blank to auto-generate"
          >
            <input
              id="invoiceNumber"
              type="text"
              className={inputClass(!!errors.invoiceNumber)}
              placeholder="Auto-generated"
              {...register("invoiceNumber")}
            />
          </FormField>
          <FormField
            label="Invoice date"
            htmlFor="invoiceDate"
            error={errors.invoiceDate?.message}
          >
            <input
              id="invoiceDate"
              type="date"
              className={inputClass(!!errors.invoiceDate)}
              {...register("invoiceDate")}
            />
          </FormField>
          <FormField
            label="Due date"
            htmlFor="dueDate"
            error={errors.dueDate?.message}
          >
            <input
              id="dueDate"
              type="date"
              className={inputClass(!!errors.dueDate)}
              {...register("dueDate")}
            />
          </FormField>
        </div>

        {/* Line items */}
        <SectionTitle>Line items</SectionTitle>
        {itemsError && <FieldError message={itemsError} />}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
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
                  Tax
                </th>
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
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium text-slate-900">
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
          <dl className="w-full max-w-xs space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums text-slate-700">
                {formatCurrency(subtotal)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Tax</dt>
              <dd className="tabular-nums text-slate-700">
                {formatCurrency(taxTotal)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <dt>Grand total</dt>
              <dd className="tabular-nums">{formatCurrency(grandTotal)}</dd>
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
            placeholder="Internal notes about this purchase invoice"
            {...register("notes")}
          />
        </FormField>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/purchases/invoices")}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={isPending}>
            {isEdit ? "Save changes" : "Create purchase invoice"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
