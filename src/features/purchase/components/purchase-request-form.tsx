"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { ClipboardList, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createPurchaseRequestSchema,
  updatePurchaseRequestSchema,
} from "@/features/purchase/schemas/purchase-request.schemas";
import {
  createPurchaseRequestAction,
  updatePurchaseRequestAction,
} from "@/features/purchase/actions/purchase-request.actions";
import type { PurchaseRequestWithItems } from "@/features/purchase/types/purchase-request.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Option + form value shapes
// ─────────────────────────────────────────────────────────────

export interface PrWarehouseOption {
  readonly id: string;
  readonly name: string;
}

export interface PrSupplierOption {
  readonly id: string;
  readonly name: string;
}

export interface PrProductOption {
  readonly id: string;
  readonly name: string;
  readonly purchasePrice: number;
}

interface LineItemValue {
  productId: string;
  description: string;
  quantity: string;
  estimatedPrice: string;
}

interface PurchaseRequestFormValues {
  requestNumber: string;
  warehouseId: string;
  requiredDate: string;
  notes: string;
  items: LineItemValue[];
}

// ─────────────────────────────────────────────────────────────
// Math (estimated total preview)
// ─────────────────────────────────────────────────────────────

function num(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    estimatedPrice: "0",
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
// Purchase request form (create + edit)
// ─────────────────────────────────────────────────────────────

interface PurchaseRequestFormProps {
  readonly organizationId: string;
  readonly warehouses: readonly PrWarehouseOption[];
  readonly products: readonly PrProductOption[];
  readonly purchaseRequest?: PurchaseRequestWithItems;
}

export function PurchaseRequestForm({
  organizationId,
  warehouses,
  products,
  purchaseRequest,
}: PurchaseRequestFormProps) {
  const router = useRouter();
  const isEdit = Boolean(purchaseRequest);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit
      ? zodResolver(updatePurchaseRequestSchema)
      : zodResolver(createPurchaseRequestSchema)
  ) as unknown as Resolver<PurchaseRequestFormValues>;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchaseRequestFormValues>({
    resolver,
    defaultValues: {
      requestNumber: purchaseRequest?.requestNumber ?? "",
      warehouseId: purchaseRequest?.warehouseId ?? "",
      requiredDate: purchaseRequest?.requiredDate
        ? purchaseRequest.requiredDate.toISOString().slice(0, 10)
        : "",
      notes: purchaseRequest?.notes ?? "",
      items:
        purchaseRequest && purchaseRequest.items.length > 0
          ? purchaseRequest.items.map((item) => ({
              productId: item.productId,
              description: item.description ?? "",
              quantity: String(item.quantity),
              estimatedPrice: String(item.estimatedPrice),
            }))
          : [emptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray<PurchaseRequestFormValues>({
    control,
    name: "items",
  });

  const watchedItems = watch("items");

  const estimatedTotal = round2(
    (watchedItems ?? []).reduce(
      (sum, item) => sum + num(item.quantity) * num(item.estimatedPrice),
      0
    )
  );

  const itemsError =
    typeof errors.items?.message === "string" ? errors.items.message : undefined;

  const handleProductChange = (index: number, productId: string): void => {
    setValue(`items.${index}.productId`, productId, { shouldValidate: true });
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.estimatedPrice`, String(product.purchasePrice));
    }
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    if (values.requestNumber.trim()) {
      fd.append("requestNumber", values.requestNumber.trim());
    }
    if (values.warehouseId) {
      fd.append("warehouseId", values.warehouseId);
    }
    if (values.requiredDate) {
      fd.append("requiredDate", values.requiredDate);
    }
    if (values.notes.trim()) {
      fd.append("notes", values.notes.trim());
    }
    if (isEdit && purchaseRequest) {
      fd.append("version", String(purchaseRequest.version));
    }

    const items = values.items.map((item) => ({
      productId: item.productId,
      description: item.description.trim() || undefined,
      quantity: num(item.quantity),
      estimatedPrice: num(item.estimatedPrice),
    }));
    fd.append("items", JSON.stringify(items));

    startTransition(async () => {
      const result =
        isEdit && purchaseRequest
          ? await updatePurchaseRequestAction(
              organizationId,
              purchaseRequest.id,
              fd
            )
          : await createPurchaseRequestAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      const id = result.success ? result.data.id : purchaseRequest?.id;
      router.push(id ? `/purchases/requests/${id}` : "/purchases/requests");
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
          <ClipboardList
            className="h-5 w-5 text-primary-600"
            aria-hidden="true"
          />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            {isEdit ? "Edit purchase request" : "New purchase request"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Update the draft requisition"
              : "Raise an internal requisition for goods you need"}
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
        {/* Header fields */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Request number"
            htmlFor="requestNumber"
            error={errors.requestNumber?.message}
            hint="Leave blank to auto-generate (PR-#####)"
          >
            <input
              id="requestNumber"
              type="text"
              className={inputClass(!!errors.requestNumber)}
              placeholder="Auto-generated"
              {...register("requestNumber")}
            />
          </FormField>
          <FormField
            label="Warehouse"
            htmlFor="warehouseId"
            error={errors.warehouseId?.message}
          >
            <select
              id="warehouseId"
              className={inputClass(!!errors.warehouseId)}
              {...register("warehouseId")}
            >
              <option value="">— None —</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Required by"
            htmlFor="requiredDate"
            error={errors.requiredDate?.message}
          >
            <input
              id="requiredDate"
              type="date"
              className={inputClass(!!errors.requiredDate)}
              {...register("requiredDate")}
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
                  Est. price
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Est. total
                </th>
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const rowErrors = errors.items?.[index];
                const lineTotal =
                  num(watchedItems?.[index]?.quantity ?? "0") *
                  num(watchedItems?.[index]?.estimatedPrice ?? "0");
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
                        aria-label={`Estimated price for line ${index + 1}`}
                        type="number"
                        min={0}
                        step="0.01"
                        className={cn(cellClass, "w-28")}
                        {...register(`items.${index}.estimatedPrice`)}
                      />
                      <FieldError message={rowErrors?.estimatedPrice?.message} />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium text-slate-900">
                      {formatCurrency(round2(lineTotal))}
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

        {/* Estimated total */}
        <div className="flex justify-end">
          <dl className="w-full max-w-xs space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
              <dt>Estimated total</dt>
              <dd className="tabular-nums">{formatCurrency(estimatedTotal)}</dd>
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
            placeholder="Why is this requisition needed?"
            {...register("notes")}
          />
        </FormField>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/purchases/requests")}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={isPending}>
            {isEdit ? "Save changes" : "Create purchase request"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
