"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { FileText, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  SALES_GST_RATES,
  INVOICE_TYPES,
  type CreateInvoiceFormValues,
} from "@/features/sales/schemas/invoice.schemas";
import {
  createInvoiceAction,
  updateInvoiceAction,
} from "@/features/sales/actions/invoice.actions";
import type { InvoiceWithItems } from "@/features/sales/types/invoice.types";
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
// Math (client-side preview; server re-computes on submit)
// ─────────────────────────────────────────────────────────────

type FormItemValues = CreateInvoiceFormValues["items"][number];

function num(value: string | number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

interface LineMath {
  readonly gross: number;
  readonly discountAmount: number;
  readonly taxableAmount: number;
  readonly cgstAmount: number;
  readonly sgstAmount: number;
  readonly igstAmount: number;
  readonly taxAmount: number;
  readonly lineTotal: number;
}

function computeLine(
  item: FormItemValues,
  isInterstate: boolean
): LineMath {
  const gross = round2(num(item.quantity) * num(item.unitPrice));
  const discountAmount = round2(gross * (num(item.discountPercent) / 100));
  const taxableAmount = round2(gross - discountAmount);
  const gstRate = num(item.gstRate);
  const halfRate = gstRate / 2;

  const cgstAmount = isInterstate ? 0 : round2(taxableAmount * (halfRate / 100));
  const sgstAmount = isInterstate ? 0 : round2(taxableAmount * (halfRate / 100));
  const igstAmount = isInterstate ? round2(taxableAmount * (gstRate / 100)) : 0;
  const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);
  const lineTotal = round2(taxableAmount + taxAmount);

  return {
    gross,
    discountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    lineTotal,
  };
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
    description: "",
    hsnCode: "",
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
    gstRate: 18,
  };
}

const INVOICE_TYPE_LABELS: Record<(typeof INVOICE_TYPES)[number], string> = {
  tax_invoice: "Tax Invoice",
  retail_invoice: "Retail Invoice",
  proforma_invoice: "Proforma Invoice",
  commercial_invoice: "Commercial Invoice",
  export_invoice: "Export Invoice",
};

// ─────────────────────────────────────────────────────────────
// Field helpers
// ─────────────────────────────────────────────────────────────

function FieldError({ message }: { readonly message?: string }) {
  if (!message) {return null;}
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
// Invoice form
// ─────────────────────────────────────────────────────────────

interface InvoiceFormProps {
  readonly organizationId: string;
  readonly orgState: string | null;
  readonly customers: readonly CustomerOption[];
  readonly products: readonly ProductOption[];
  readonly warehouses: readonly WarehouseOption[];
  readonly invoice?: InvoiceWithItems;
}

export function InvoiceForm({
  organizationId,
  orgState,
  customers,
  products,
  warehouses,
  invoice,
}: InvoiceFormProps) {
  const router = useRouter();
  const isEdit = Boolean(invoice);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit
      ? zodResolver(updateInvoiceSchema)
      : zodResolver(createInvoiceSchema)
  ) as unknown as Resolver<CreateInvoiceFormValues>;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateInvoiceFormValues>({
    resolver,
    defaultValues: {
      customerId: invoice?.customerId ?? "",
      salesOrderId: invoice?.salesOrderId ?? "",
      quotationId: invoice?.quotationId ?? "",
      warehouseId: invoice?.warehouseId ?? "",
      invoiceDate: invoice
        ? invoice.invoiceDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      dueDate: invoice?.dueDate
        ? invoice.dueDate.toISOString().slice(0, 10)
        : "",
      invoiceType: invoice?.invoiceType ?? "tax_invoice",
      supplyState: invoice?.supplyState ?? orgState ?? "",
      isInterstate: invoice?.isInterstate ?? false,
      referenceNumber: invoice?.referenceNumber ?? "",
      notes: invoice?.notes ?? "",
      terms: invoice?.terms ?? "",
      items:
        invoice && invoice.items.length > 0
          ? invoice.items.map((item) => ({
              productId: item.productId,
              description: item.description ?? "",
              hsnCode: item.hsnCode ?? "",
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent,
              gstRate: item.gstRate,
            }))
          : [emptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray<CreateInvoiceFormValues>({
    control,
    name: "items",
  });

  const watchedItems = watch("items");
  const watchedSupplyState = watch("supplyState");

  // Determine if intra or inter-state for the GST preview
  const isInterstate = useMemo(() => {
    if (!orgState || !watchedSupplyState) {return false;}
    return orgState.trim().toLowerCase() !== watchedSupplyState.trim().toLowerCase();
  }, [orgState, watchedSupplyState]);

  const lines = (watchedItems ?? []).map((item) =>
    computeLine(item, isInterstate)
  );

  const subtotal = round2(lines.reduce((s, l) => s + l.gross, 0));
  const discountTotal = round2(lines.reduce((s, l) => s + l.discountAmount, 0));
  const taxableTotal = round2(subtotal - discountTotal);
  const cgstTotal = round2(lines.reduce((s, l) => s + l.cgstAmount, 0));
  const sgstTotal = round2(lines.reduce((s, l) => s + l.sgstAmount, 0));
  const igstTotal = round2(lines.reduce((s, l) => s + l.igstAmount, 0));
  const taxTotal = round2(cgstTotal + sgstTotal + igstTotal);
  const rawTotal = taxableTotal + taxTotal;
  const roundOff = round2(Math.round(rawTotal) - rawTotal);
  const grandTotal = round2(rawTotal + roundOff);

  const itemsError =
    typeof errors.items?.message === "string"
      ? errors.items.message
      : undefined;

  const handleProductChange = (index: number, productId: string): void => {
    setValue(`items.${index}.productId`, productId, { shouldValidate: true });
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.unitPrice`, product.salePrice);
      const matchedRate = SALES_GST_RATES.includes(
        product.gstRate as (typeof SALES_GST_RATES)[number]
      )
        ? product.gstRate
        : 18;
      setValue(`items.${index}.gstRate`, matchedRate);
    }
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("customerId", values.customerId);
    if (values.invoiceType) {fd.append("invoiceType", values.invoiceType);}
    if (values.salesOrderId?.trim()) {fd.append("salesOrderId", values.salesOrderId.trim());}
    if (values.quotationId?.trim()) {fd.append("quotationId", values.quotationId.trim());}
    if (values.warehouseId?.trim()) {fd.append("warehouseId", values.warehouseId.trim());}
    if (values.invoiceDate) {fd.append("invoiceDate", values.invoiceDate);}
    if (values.dueDate) {fd.append("dueDate", values.dueDate);}
    if (values.supplyState?.trim()) {fd.append("supplyState", values.supplyState.trim());}
    fd.append("isInterstate", String(isInterstate));
    if (values.referenceNumber?.trim()) {fd.append("referenceNumber", values.referenceNumber.trim());}
    if (values.notes?.trim()) {fd.append("notes", values.notes.trim());}
    if (values.terms?.trim()) {fd.append("terms", values.terms.trim());}
    if (isEdit && invoice) {
      fd.append("version", String(invoice.version ?? 1));
    }

    const items = values.items.map((item) => ({
      productId: item.productId,
      description: item.description?.trim() || undefined,
      hsnCode: item.hsnCode?.trim() || undefined,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discountPercent: Number(item.discountPercent ?? 0),
      gstRate: Number(item.gstRate ?? 18),
    }));
    fd.append("items", JSON.stringify(items));

    startTransition(async () => {
      const result =
        isEdit && invoice
          ? await updateInvoiceAction(organizationId, invoice.id, fd)
          : await createInvoiceAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      const id = result.success ? result.data.id : invoice?.id;
      router.push(id ? `/sales/invoices/${id}` : "/sales/invoices");
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
            {isEdit ? "Edit invoice" : "New invoice"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Update the draft invoice"
              : "Create a sales invoice for your customer"}
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
        {isEdit && invoice && (
          <input
            type="hidden"
            name="version"
            value={String(invoice.version ?? 1)}
            readOnly
          />
        )}

        {/* Customer + Invoice type */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Invoice type"
            htmlFor="invoiceType"
            error={errors.invoiceType?.message}
          >
            <select
              id="invoiceType"
              className={inputClass(!!errors.invoiceType)}
              {...register("invoiceType")}
            >
              {INVOICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {INVOICE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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
          <FormField
            label="Supply state"
            htmlFor="supplyState"
            hint={
              isInterstate
                ? "Inter-state (IGST applies)"
                : orgState
                ? "Intra-state (CGST + SGST)"
                : "Set org state for GST auto-detection"
            }
            error={errors.supplyState?.message}
          >
            <input
              id="supplyState"
              type="text"
              placeholder="e.g. Maharashtra"
              className={inputClass(!!errors.supplyState)}
              {...register("supplyState")}
            />
          </FormField>
        </div>

        {/* References */}
        <SectionTitle>References (optional)</SectionTitle>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <FormField
            label="Sales order ref."
            htmlFor="salesOrderId"
            error={errors.salesOrderId?.message}
          >
            <input
              id="salesOrderId"
              type="text"
              placeholder="SO ID"
              className={inputClass(!!errors.salesOrderId)}
              {...register("salesOrderId")}
            />
          </FormField>
          <FormField
            label="Quotation ref."
            htmlFor="quotationId"
            error={errors.quotationId?.message}
          >
            <input
              id="quotationId"
              type="text"
              placeholder="QT ID"
              className={inputClass(!!errors.quotationId)}
              {...register("quotationId")}
            />
          </FormField>
          <FormField
            label="Your reference no."
            htmlFor="referenceNumber"
            error={errors.referenceNumber?.message}
          >
            <input
              id="referenceNumber"
              type="text"
              placeholder="PO / external ref"
              className={inputClass(!!errors.referenceNumber)}
              {...register("referenceNumber")}
            />
          </FormField>
        </div>

        {/* Warehouse */}
        {warehouses.length > 0 && (
          <FormField
            label="Dispatch from warehouse"
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
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {/* Line items */}
        <SectionTitle>Line items</SectionTitle>
        {itemsError && <FieldError message={itemsError} />}

        {/* GST mode indicator */}
        {orgState && (
          <div className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
            isInterstate
              ? "bg-amber-50 text-amber-700"
              : "bg-green-50 text-green-700"
          )}>
            <span>
              {isInterstate
                ? `Inter-state supply — IGST applies (supply state: ${watchedSupplyState || "—"})`
                : `Intra-state supply — CGST + SGST applies (state: ${orgState})`}
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-2 py-2 font-medium">
                  Product
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  HSN
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Qty
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Rate
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  Disc %
                </th>
                <th scope="col" className="px-2 py-2 font-medium">
                  GST %
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Taxable
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  {isInterstate ? "IGST" : "CGST+SGST"}
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Total
                </th>
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const rowErrors = errors.items?.[index];
                const line = lines[index];
                return (
                  <tr key={field.id} className="align-top">
                    <td className="px-2 py-2">
                      <select
                        aria-label={`Product for line ${index + 1}`}
                        className={cn(cellClass, "min-w-[140px]")}
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
                        aria-label={`HSN code for line ${index + 1}`}
                        type="text"
                        maxLength={8}
                        placeholder="HSN"
                        className={cn(cellClass, "w-20")}
                        {...register(`items.${index}.hsnCode`)}
                      />
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
                        className={cn(cellClass, "w-16")}
                        {...register(`items.${index}.discountPercent`)}
                      />
                      <FieldError message={rowErrors?.discountPercent?.message} />
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
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                      {formatCurrency(line?.taxableAmount ?? 0)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                      {isInterstate
                        ? formatCurrency(line?.igstAmount ?? 0)
                        : formatCurrency(
                            (line?.cgstAmount ?? 0) + (line?.sgstAmount ?? 0)
                          )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium text-slate-900">
                      {formatCurrency(line?.lineTotal ?? 0)}
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

        {/* Totals panel */}
        <div className="flex justify-end">
          <dl className="w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular-nums text-slate-700">
                {formatCurrency(subtotal)}
              </dd>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Discount</dt>
                <dd className="tabular-nums text-slate-700">
                  −{formatCurrency(discountTotal)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Taxable value</dt>
              <dd className="tabular-nums text-slate-700">
                {formatCurrency(taxableTotal)}
              </dd>
            </div>
            {isInterstate ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">IGST</dt>
                <dd className="tabular-nums text-slate-700">
                  {formatCurrency(igstTotal)}
                </dd>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <dt className="text-slate-500">CGST</dt>
                  <dd className="tabular-nums text-slate-700">
                    {formatCurrency(cgstTotal)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">SGST</dt>
                  <dd className="tabular-nums text-slate-700">
                    {formatCurrency(sgstTotal)}
                  </dd>
                </div>
              </>
            )}
            {roundOff !== 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Round off</dt>
                <dd className="tabular-nums text-slate-700">
                  {roundOff > 0 ? "+" : ""}
                  {formatCurrency(roundOff)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <dt>TOTAL</dt>
              <dd className="tabular-nums">{formatCurrency(grandTotal)}</dd>
            </div>
          </dl>
        </div>

        {/* Notes + Terms */}
        <SectionTitle>Notes &amp; terms</SectionTitle>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <textarea
              id="notes"
              rows={3}
              className={inputClass(!!errors.notes)}
              placeholder="Notes to customer"
              {...register("notes")}
            />
          </FormField>
          <FormField label="Terms &amp; conditions" htmlFor="terms" error={errors.terms?.message}>
            <textarea
              id="terms"
              rows={3}
              className={inputClass(!!errors.terms)}
              placeholder="Payment terms, delivery conditions…"
              {...register("terms")}
            />
          </FormField>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/sales/invoices")}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={isPending}>
            {isEdit ? "Save changes" : "Create invoice"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
