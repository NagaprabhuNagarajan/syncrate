"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Undo2, AlertCircle, Plus, Trash2 } from "lucide-react";
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
import {
  createPurchaseReturnSchema,
  updatePurchaseReturnSchema,
  PURCHASE_TAX_RATES,
  PURCHASE_RETURN_REASONS,
  PURCHASE_RETURN_REASON_LABELS,
} from "@/features/purchase/schemas/purchase-return.schemas";
import {
  createPurchaseReturnAction,
  updatePurchaseReturnAction,
} from "@/features/purchase/actions/purchase-return.actions";
import type { PurchaseReturnWithItems } from "@/features/purchase/types/purchase-return.types";
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
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

interface PurchaseReturnFormValues {
  returnNumber: string;
  supplierId: string;
  branchId: string;
  returnDate: string;
  reason: string;
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
  return { productId: "", quantity: "1", unitPrice: "0", taxRate: "0" };
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
// Purchase return form (create + edit)
// ─────────────────────────────────────────────────────────────

/** Server-supplied initial values for a new return (e.g. from a purchase order). */
export interface PurchaseReturnPrefill {
  readonly supplierId: string;
  readonly branchId: string;
  /** Links the new return back to the originating purchase order. */
  readonly purchaseOrderId?: string;
  readonly items: readonly {
    readonly productId: string;
    readonly quantity: string;
    readonly unitPrice: string;
    readonly taxRate: string;
  }[];
}

interface PurchaseReturnFormProps {
  readonly organizationId: string;
  readonly suppliers: readonly SupplierOption[];
  readonly branches: readonly BranchOption[];
  readonly products: readonly ProductOption[];
  readonly purchaseReturn?: PurchaseReturnWithItems;
  /** Initial values for a new return, e.g. carried over from a purchase order. */
  readonly prefill?: PurchaseReturnPrefill;
}

export function PurchaseReturnForm({
  organizationId,
  suppliers,
  branches,
  products,
  purchaseReturn,
  prefill,
}: PurchaseReturnFormProps) {
  const router = useRouter();
  const isEdit = Boolean(purchaseReturn);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit
      ? zodResolver(updatePurchaseReturnSchema)
      : zodResolver(createPurchaseReturnSchema)
  ) as unknown as Resolver<PurchaseReturnFormValues>;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchaseReturnFormValues>({
    resolver,
    defaultValues: {
      returnNumber: purchaseReturn?.returnNumber ?? "",
      supplierId: purchaseReturn?.supplierId ?? prefill?.supplierId ?? "",
      branchId: purchaseReturn?.branchId ?? prefill?.branchId ?? "",
      returnDate: purchaseReturn
        ? purchaseReturn.returnDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      reason: purchaseReturn?.reason ?? "other",
      notes: purchaseReturn?.notes ?? "",
      items:
        purchaseReturn && purchaseReturn.items.length > 0
          ? purchaseReturn.items.map((item) => ({
              productId: item.productId,
              quantity: String(item.quantity),
              unitPrice: String(item.unitPrice),
              taxRate: String(item.taxRate),
            }))
          : prefill && prefill.items.length > 0
            ? prefill.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate,
              }))
            : [emptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray<PurchaseReturnFormValues>({
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
    if (values.returnNumber.trim()) {
      fd.append("returnNumber", values.returnNumber.trim());
    }
    fd.append("supplierId", values.supplierId);
    fd.append("branchId", values.branchId);
    if (values.returnDate) {
      fd.append("returnDate", values.returnDate);
    }
    fd.append("reason", values.reason);
    if (values.notes.trim()) {
      fd.append("notes", values.notes.trim());
    }
    if (isEdit && purchaseReturn) {
      // Carry the optimistic-lock version so the server can detect a stale edit.
      fd.append("version", String(purchaseReturn.version ?? 1));
    }

    // Preserve the purchase-order link (existing, or carried over from a PO).
    const linkedPurchaseOrderId =
      purchaseReturn?.purchaseOrderId ?? prefill?.purchaseOrderId;
    if (linkedPurchaseOrderId) {
      fd.append("purchaseOrderId", linkedPurchaseOrderId);
    }

    const items = values.items.map((item) => ({
      productId: item.productId,
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      taxRate: num(item.taxRate),
    }));
    fd.append("items", JSON.stringify(items));

    startTransition(async () => {
      const result =
        isEdit && purchaseReturn
          ? await updatePurchaseReturnAction(
              organizationId,
              purchaseReturn.id,
              fd
            )
          : await createPurchaseReturnAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      const id = result.success ? result.data.id : purchaseReturn?.id;
      router.push(id ? `/purchases/returns/${id}` : "/purchases/returns");
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
          <Undo2 className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit purchase return" : "New purchase return"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the draft purchase return"
              : "Return goods to one of your suppliers"}
          </p>
        </div>
      </motion.div>

      {serverError && <ErrorBanner message={serverError} className="mb-5" />}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {isEdit && purchaseReturn && (
          <input
            type="hidden"
            name="version"
            value={String(purchaseReturn.version ?? 1)}
            readOnly
          />
        )}

        {/* Return details */}
        <Section
          title="Return details"
          description="Supplier, branch and reason for this return."
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
                required
                error={errors.branchId?.message}
                hint="Stock is decreased from this branch on completion"
              >
                <select
                  id="branchId"
                  className={inputClass(!!errors.branchId)}
                  {...register("branchId")}
                >
                  <option value="">— Select branch —</option>
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
                label="Return date"
                htmlFor="returnDate"
                error={errors.returnDate?.message}
              >
                <Input
                  id="returnDate"
                  type="date"
                  aria-invalid={errors.returnDate ? "true" : "false"}
                  {...register("returnDate")}
                />
              </FormField>
              <FormField
                label="Reason"
                htmlFor="reason"
                required
                error={errors.reason?.message}
              >
                <select
                  id="reason"
                  className={inputClass(!!errors.reason)}
                  {...register("reason")}
                >
                  {PURCHASE_RETURN_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {PURCHASE_RETURN_REASON_LABELS[reason]}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Return number"
                htmlFor="returnNumber"
                error={errors.returnNumber?.message}
              >
                <Input
                  id="returnNumber"
                  type="text"
                  aria-invalid={errors.returnNumber ? "true" : "false"}
                  placeholder="Auto-generated"
                  {...register("returnNumber")}
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
            <dl className="w-full max-w-xs space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">
                  Subtotal
                </dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Tax</dt>
                <dd className="nums text-slate-700 dark:text-slate-300">
                  {formatCurrency(taxTotal)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
                <dt>Grand total</dt>
                <dd className="nums">{formatCurrency(grandTotal)}</dd>
              </div>
            </dl>
          </div>
        </Section>

        {/* Notes */}
        <Section
          title="Notes"
          description="Optional internal notes for this return."
          delay={0.15}
        >
          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <Textarea
              id="notes"
              rows={2}
              aria-invalid={errors.notes ? "true" : "false"}
              placeholder="Internal notes about this purchase return"
              {...register("notes")}
            />
          </FormField>
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
              onClick={() => router.push("/purchases/returns")}
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
              {isEdit ? "Save changes" : "Create purchase return"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
