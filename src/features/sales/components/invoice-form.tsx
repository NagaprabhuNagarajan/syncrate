"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { FileText, AlertCircle, Plus, Trash2 } from "lucide-react";
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
  readonly billingState: string | null;
  readonly shippingState: string | null;
}

export interface ProductOption {
  readonly id: string;
  readonly name: string;
  readonly salePrice: number;
  readonly gstRate: number;
}

export interface BranchOption {
  readonly id: string;
  readonly name: string;
  readonly state: string | null;
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
// Invoice form
// ─────────────────────────────────────────────────────────────

export interface InvoicePrefillItem {
  readonly productId: string;
  readonly description: string;
  readonly hsnCode?: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountPercent: number;
  readonly gstRate: number;
}

export interface InvoicePrefill {
  readonly customerId: string;
  readonly salesOrderId: string;
  readonly salesOrderNumber: string;
  readonly branchId: string;
  readonly supplyState: string;
  readonly isInterstate: boolean;
  readonly items: readonly InvoicePrefillItem[];
}

interface InvoiceFormProps {
  readonly organizationId: string;
  readonly orgState: string | null;
  readonly customers: readonly CustomerOption[];
  readonly products: readonly ProductOption[];
  readonly branches: readonly BranchOption[];
  readonly invoice?: InvoiceWithItems;
  readonly prefill?: InvoicePrefill;
}

export function InvoiceForm({
  organizationId,
  orgState,
  customers,
  products,
  branches,
  invoice,
  prefill,
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

  // The GST source state is the dispatching branch/warehouse's state, falling
  // back to the organization's state when the branch has none (or none is
  // selected). This is what decides CGST/SGST (intra-state) vs IGST.
  const resolveSourceState = (branchId: string): string => {
    const selectedBranch = branches.find((b) => b.id === branchId);
    return selectedBranch?.state?.trim() ? selectedBranch.state : orgState ?? "";
  };

  const initialSourceState = resolveSourceState(
    invoice?.branchId ?? prefill?.branchId ?? ""
  );

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
      customerId: invoice?.customerId ?? prefill?.customerId ?? "",
      salesOrderId: invoice?.salesOrderId ?? prefill?.salesOrderId ?? "",
      branchId: invoice?.branchId ?? prefill?.branchId ?? "",
      invoiceDate: invoice
        ? invoice.invoiceDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      dueDate: invoice?.dueDate
        ? invoice.dueDate.toISOString().slice(0, 10)
        : "",
      invoiceType: invoice?.invoiceType ?? "tax_invoice",
      supplyState: invoice?.supplyState ?? prefill?.supplyState ?? initialSourceState,
      isInterstate: invoice?.isInterstate ?? prefill?.isInterstate ?? false,
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
          : prefill && prefill.items.length > 0
            ? prefill.items.map((item) => ({
                productId: item.productId,
                description: item.description,
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
  const watchedBranchId = watch("branchId");
  const watchedSalesOrderId = watch("salesOrderId");

  const sourceState = resolveSourceState(watchedBranchId ?? "");

  // Determine if intra or inter-state for the GST preview
  const isInterstate = useMemo(() => {
    if (!sourceState || !watchedSupplyState) {return false;}
    return sourceState.trim().toLowerCase() !== watchedSupplyState.trim().toLowerCase();
  }, [sourceState, watchedSupplyState]);

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

  const customerField = register("customerId");

  const handleCustomerChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    // Preserve react-hook-form's own onChange for the registered field…
    void customerField.onChange(event);
    // …then auto-fill the place-of-supply from the chosen customer's state.
    const picked = customers.find((c) => c.id === event.target.value);
    setValue(
      "supplyState",
      picked?.shippingState ?? picked?.billingState ?? sourceState,
      { shouldValidate: true, shouldDirty: true }
    );
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("customerId", values.customerId);
    if (values.invoiceType) {fd.append("invoiceType", values.invoiceType);}
    if (values.salesOrderId?.trim()) {fd.append("salesOrderId", values.salesOrderId.trim());}
    if (values.branchId?.trim()) {fd.append("branchId", values.branchId.trim());}
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
      router.push(id ? `/invoices/${id}` : "/invoices");
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
          <FileText className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit invoice" : "New invoice"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the draft invoice"
              : "Create a sales invoice for your customer"}
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
        {isEdit && invoice && (
          <input
            type="hidden"
            name="version"
            value={String(invoice.version ?? 1)}
            readOnly
          />
        )}

        {/* Invoice details */}
        <Section
          title="Invoice details"
          description="Customer, type and scheduling for this invoice."
          delay={0.05}
        >
          <div className="space-y-3">
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
                  name={customerField.name}
                  ref={customerField.ref}
                  onBlur={customerField.onBlur}
                  onChange={handleCustomerChange}
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

            {branches.length > 0 && (
              <FormField
                label="Dispatch from branch"
                htmlFor="branchId"
                error={errors.branchId?.message}
              >
                <select
                  id="branchId"
                  className={inputClass(!!errors.branchId)}
                  {...register("branchId")}
                >
                  <option value="">— Optional —</option>
                  {branches.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                    ? "Auto-filled from the customer's state — edit if goods ship elsewhere. Inter-state (IGST applies)."
                    : sourceState.trim()
                    ? "Auto-filled from the customer's state — edit if goods ship elsewhere. Intra-state (CGST + SGST)."
                    : "Auto-filled from the customer's state — edit if goods ship elsewhere. Set org state for GST auto-detection."
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

            {!sourceState.trim() && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertCircle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Your organization&apos;s state isn&apos;t set, so GST is
                  defaulting to inter-state (IGST). Set it in{" "}
                  <Link
                    href="/organization"
                    className="font-medium underline underline-offset-2"
                  >
                    Settings → Organization
                  </Link>
                  .
                </span>
              </div>
            )}
          </div>
        </Section>

        {/* References */}
        <Section
          title="References"
          description="Optional links to a sales order or your own reference number."
          delay={0.1}
        >
          {/* salesOrderId is the FK — carried as a hidden value and shown
              read-only as the SO number (never the raw UUID). */}
          <input type="hidden" {...register("salesOrderId")} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {watchedSalesOrderId && (
              <FormField label="Sales order" htmlFor="salesOrderRef">
                <div
                  id="salesOrderRef"
                  className="flex items-center rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm"
                >
                  <Link
                    href={`/sales-orders/${watchedSalesOrderId}?org=${organizationId}`}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {prefill?.salesOrderNumber ?? "View sales order"}
                  </Link>
                </div>
              </FormField>
            )}
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
        </Section>

        {/* Line items */}
        <Section title="Line items" delay={0.15}>
          {itemsError && <FieldError message={itemsError} />}

          {sourceState.trim() && (
            <div
              className={cn(
                "mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
                isInterstate
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                  : "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300"
              )}
            >
              <span>
                {isInterstate
                  ? `Inter-state supply — IGST applies (supply state: ${watchedSupplyState || "—"})`
                  : `Intra-state supply — CGST + SGST applies (state: ${sourceState})`}
              </span>
            </div>
          )}

          <Table wrapperClassName="border-slate-100 dark:border-slate-800">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Disc %</TableHead>
                <TableHead>GST %</TableHead>
                <TableHead className="text-right">
                  {isInterstate ? "IGST" : "CGST+SGST"}
                </TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const rowErrors = errors.items?.[index];
                const line = lines[index];
                return (
                  <TableRow key={field.id} className="align-top">
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      <input
                        aria-label={`HSN code for line ${index + 1}`}
                        type="text"
                        maxLength={8}
                        placeholder="HSN"
                        className={cn(cellClass, "w-20")}
                        {...register(`items.${index}.hsnCode`)}
                      />
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
                        className={cn(cellClass, "w-16")}
                        {...register(`items.${index}.discountPercent`)}
                      />
                      <FieldError
                        message={rowErrors?.discountPercent?.message}
                      />
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                      {isInterstate
                        ? formatCurrency(line?.igstAmount ?? 0)
                        : formatCurrency(
                            (line?.cgstAmount ?? 0) + (line?.sgstAmount ?? 0)
                          )}
                    </TableCell>
                    <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(line?.lineTotal ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">
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

          {/* Totals panel */}
          <div className="mt-4 flex justify-end">
            <dl className="w-full max-w-sm space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Subtotal</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(subtotal)}
                </dd>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">
                    Discount
                  </dt>
                  <dd className="nums text-slate-700 dark:text-slate-300">
                    −{formatCurrency(discountTotal)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">
                  Taxable value
                </dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(taxableTotal)}
                </dd>
              </div>
              {isInterstate ? (
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">IGST</dt>
                  <dd className="nums text-slate-700 dark:text-slate-300">
                    {formatCurrency(igstTotal)}
                  </dd>
                </div>
              ) : (
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
              )}
              {roundOff !== 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">
                    Round off
                  </dt>
                  <dd className="nums text-slate-700 dark:text-slate-300">
                    {roundOff > 0 ? "+" : ""}
                    {formatCurrency(roundOff)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100">
                <dt>TOTAL</dt>
                <dd className="nums">{formatCurrency(grandTotal)}</dd>
              </div>
            </dl>
          </div>
        </Section>

        {/* Notes & terms */}
        <Section
          title="Notes & terms"
          description="Optional notes and terms for this invoice."
          delay={0.2}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Notes"
              htmlFor="notes"
              error={errors.notes?.message}
            >
              <textarea
                id="notes"
                rows={3}
                className={inputClass(!!errors.notes)}
                placeholder="Notes to customer"
                {...register("notes")}
              />
            </FormField>
            <FormField
              label="Terms & conditions"
              htmlFor="terms"
              error={errors.terms?.message}
            >
              <textarea
                id="terms"
                rows={3}
                className={inputClass(!!errors.terms)}
                placeholder="Payment terms, delivery conditions…"
                {...register("terms")}
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
              onClick={() => router.push("/invoices")}
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
              {isEdit ? "Save changes" : "Create invoice"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
