"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Barcode, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  serialNumberSchema,
  serialStatusSchema,
} from "@/features/serial/schemas/serial.schemas";
import {
  bulkCreateSerialsAction,
  updateSerialAction,
} from "@/features/serial/actions/serial.actions";
import type {
  SerialNumber,
  SerialStatus,
} from "@/features/serial/types/serial.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Option types
// ─────────────────────────────────────────────────────────────

export interface ProductOption {
  readonly id: string;
  readonly name: string;
  readonly code: string;
}

export interface WarehouseOption {
  readonly id: string;
  readonly name: string;
}

export const SERIAL_STATUS_LABELS: Record<SerialStatus, string> = {
  in_stock: "In stock",
  reserved: "Reserved",
  sold: "Sold",
  returned: "Returned",
  damaged: "Damaged",
};

const STATUS_OPTIONS: readonly SerialStatus[] = [
  "in_stock",
  "reserved",
  "sold",
  "returned",
  "damaged",
];

// ─────────────────────────────────────────────────────────────
// Form values + resolvers
// ─────────────────────────────────────────────────────────────

interface SerialFormValues {
  productId: string;
  serialNumbers: string;
  warehouseId: string;
  notes: string;
  status?: SerialStatus;
}

const createFormSchema = z.object({
  productId: z.string().uuid("Please select a product"),
  serialNumbers: z.string().trim().min(1, "Enter at least one serial number"),
  warehouseId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const editFormSchema = z.object({
  productId: z.string().uuid("Please select a product"),
  serialNumbers: serialNumberSchema,
  warehouseId: z.string().optional(),
  notes: z.string().max(2000).optional(),
  status: serialStatusSchema,
});

// ─────────────────────────────────────────────────────────────
// Field helpers (mirror customer-form / create-organization-form)
// ─────────────────────────────────────────────────────────────

function FieldError({ message }: { readonly message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-error-600 dark:text-error-400 mt-1.5 flex items-center gap-1.5 text-xs"
      role="alert"
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </motion.p>
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

const inputClass = (hasError: boolean) =>
  cn(
    "block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
    hasError
      ? "border-error-400 bg-error-50/30 dark:bg-error-500/10"
      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600"
  );

// ─────────────────────────────────────────────────────────────
// Serial form (create bulk + edit single)
// ─────────────────────────────────────────────────────────────

interface SerialFormProps {
  readonly organizationId: string;
  readonly products: readonly ProductOption[];
  readonly warehouses: readonly WarehouseOption[];
  readonly serial?: SerialNumber;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
}

export function SerialForm({
  organizationId,
  products,
  warehouses,
  serial,
  onSuccess,
  onCancel,
}: SerialFormProps) {
  const router = useRouter();
  const isEdit = Boolean(serial);
  const [serverError, setServerError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit ? zodResolver(editFormSchema) : zodResolver(createFormSchema)
  ) as unknown as Resolver<SerialFormValues>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SerialFormValues>({
    resolver,
    defaultValues: {
      productId: serial?.productId ?? "",
      serialNumbers: serial?.serialNumber ?? "",
      warehouseId: serial?.warehouseId ?? "",
      notes: serial?.notes ?? "",
      status: serial?.status ?? "in_stock",
    },
  });

  const finish = (): void => {
    if (onSuccess) {
      onSuccess();
    } else {
      router.refresh();
    }
  };

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    setSummary(null);

    const fd = new FormData();
    fd.append("productId", values.productId);
    fd.append("warehouseId", values.warehouseId ?? "");
    fd.append("notes", values.notes ?? "");

    startTransition(async () => {
      if (isEdit && serial) {
        fd.append("serialNumber", values.serialNumbers.trim());
        if (values.status) {
          fd.append("status", values.status);
        }
        const result = await updateSerialAction(organizationId, serial.id, fd);
        if (!result.success) {
          setServerError(result.error.message);
          return;
        }
        finish();
        return;
      }

      fd.append("serialNumbers", values.serialNumbers);
      const result = await bulkCreateSerialsAction(organizationId, fd);
      if (!result.success) {
        setServerError(result.error.message);
        return;
      }

      const { created, skipped, errors: rowErrors } = result.data;
      if (skipped === 0 && created > 0) {
        finish();
        return;
      }

      if (created === 0) {
        setServerError(
          rowErrors[0]?.message ?? "No serials were registered."
        );
        return;
      }

      setSummary(
        `${created} serial(s) registered, ${skipped} skipped.`
      );
      router.refresh();
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-6 shadow-xl shadow-slate-200/50 sm:px-8 sm:py-8"
    >
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="bg-primary-50 dark:bg-primary-500/10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <Barcode className="text-primary-600 dark:text-primary-400 h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit serial number" : "Register serial numbers"}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the details for this serial number"
              : "Register one or more serial numbers for a product"}
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

      {summary && (
        <div
          className="border-warning/40 bg-warning/10 text-warning-dark mb-5 rounded-lg border px-4 py-3 text-sm"
          role="status"
        >
          {summary}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormField
          label="Product"
          htmlFor="productId"
          required
          error={errors.productId?.message}
        >
          <select
            id="productId"
            aria-invalid={errors.productId ? "true" : "false"}
            className={inputClass(!!errors.productId)}
            {...register("productId")}
          >
            <option value="">Select a product…</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.code})
              </option>
            ))}
          </select>
        </FormField>

        {isEdit ? (
          <FormField
            label="Serial number"
            htmlFor="serialNumbers"
            required
            error={errors.serialNumbers?.message}
          >
            <input
              id="serialNumbers"
              type="text"
              autoComplete="off"
              className={inputClass(!!errors.serialNumbers)}
              placeholder="SN-000123"
              {...register("serialNumbers")}
            />
          </FormField>
        ) : (
          <FormField
            label="Serial numbers"
            htmlFor="serialNumbers"
            required
            error={errors.serialNumbers?.message}
            hint="Enter one per line, or separate with commas"
          >
            <textarea
              id="serialNumbers"
              rows={5}
              className={inputClass(!!errors.serialNumbers)}
              placeholder={"SN-000123\nSN-000124\nSN-000125"}
              {...register("serialNumbers")}
            />
          </FormField>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
              <option value="">Unassigned</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </FormField>

          {isEdit && (
            <FormField
              label="Status"
              htmlFor="status"
              error={errors.status?.message}
            >
              <select
                id="status"
                className={inputClass(!!errors.status)}
                {...register("status")}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {SERIAL_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>

        <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
          <textarea
            id="notes"
            rows={2}
            className={inputClass(!!errors.notes)}
            placeholder="Optional notes about these serials"
            {...register("notes")}
          />
        </FormField>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel ?? (() => router.refresh())}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={isPending}>
            {isEdit ? "Save changes" : "Register serials"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
