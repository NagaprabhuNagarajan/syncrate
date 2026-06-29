"use client";

import { useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Warehouse as WarehouseIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
} from "@/features/warehouse/schemas/warehouse.schemas";
import {
  createWarehouseAction,
  updateWarehouseAction,
} from "@/features/warehouse/actions/warehouse.actions";
import type {
  Warehouse,
  WarehouseStatus,
} from "@/features/warehouse/types/warehouse.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Form value shape
// ─────────────────────────────────────────────────────────────

interface WarehouseFormValues {
  code: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
  capacity: string;
  isDefault: boolean;
  status?: WarehouseStatus;
}

const OPTIONAL_TEXT_FIELDS = [
  "addressLine1",
  "city",
  "state",
  "pincode",
] as const;

const WAREHOUSE_STATUSES: { value: WarehouseStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

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
      {hint && !error && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      <FieldError message={error} />
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

// ─────────────────────────────────────────────────────────────
// Warehouse form (create + edit)
// ─────────────────────────────────────────────────────────────

interface WarehouseFormProps {
  readonly organizationId: string;
  readonly warehouse?: Warehouse;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
}

export function WarehouseForm({
  organizationId,
  warehouse,
  onSuccess,
  onCancel,
}: WarehouseFormProps) {
  const isEdit = Boolean(warehouse);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit
      ? zodResolver(updateWarehouseSchema)
      : zodResolver(createWarehouseSchema)
  ) as unknown as Resolver<WarehouseFormValues>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WarehouseFormValues>({
    resolver,
    defaultValues: {
      code: warehouse?.code ?? "",
      name: warehouse?.name ?? "",
      addressLine1: warehouse?.addressLine1 ?? "",
      city: warehouse?.city ?? "",
      state: warehouse?.state ?? "",
      pincode: warehouse?.pincode ?? "",
      capacity:
        warehouse?.capacity !== null && warehouse?.capacity !== undefined
          ? String(warehouse.capacity)
          : "",
      isDefault: warehouse?.isDefault ?? false,
      status: warehouse?.status ?? "active",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const formData = new FormData();
    formData.append("code", values.code);
    formData.append("name", values.name);

    OPTIONAL_TEXT_FIELDS.forEach((key) => {
      const value = values[key];
      if (typeof value === "string" && value.trim() !== "") {
        formData.append(key, value.trim());
      }
    });

    if (values.capacity !== undefined && String(values.capacity) !== "") {
      formData.append("capacity", String(values.capacity));
    }
    if (values.isDefault) {
      formData.append("isDefault", "true");
    }
    if (isEdit && values.status) {
      formData.append("status", values.status);
    }

    startTransition(async () => {
      const result =
        isEdit && warehouse
          ? await updateWarehouseAction(organizationId, warehouse.id, formData)
          : await createWarehouseAction(organizationId, formData);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      onSuccess?.();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="bg-gradient-brand shadow-glow-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
          <WarehouseIcon
            className="h-5 w-5 text-white"
            aria-hidden="true"
          />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit warehouse" : "Add warehouse"}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the details for this warehouse"
              : "Create a new stock location for your organization"}
          </p>
        </div>
      </div>

      {serverError && (
        <div
          className="border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-800 dark:text-error-300 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          <AlertCircle
            className="text-error-500 mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span>{serverError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Warehouse name"
          htmlFor="name"
          required
          error={errors.name?.message}
        >
          <input
            id="name"
            type="text"
            autoFocus
            aria-invalid={errors.name ? "true" : "false"}
            className={inputClass(!!errors.name)}
            placeholder="Chennai Central"
            {...register("name")}
          />
        </FormField>
        <FormField
          label="Warehouse code"
          htmlFor="code"
          required
          error={errors.code?.message}
        >
          <input
            id="code"
            type="text"
            autoComplete="off"
            aria-invalid={errors.code ? "true" : "false"}
            className={cn(inputClass(!!errors.code), "uppercase")}
            placeholder="WH-CHN-01"
            {...register("code")}
          />
        </FormField>
      </div>

      <FormField
        label="Address"
        htmlFor="addressLine1"
        error={errors.addressLine1?.message}
      >
        <input
          id="addressLine1"
          type="text"
          className={inputClass(!!errors.addressLine1)}
          placeholder="Street address, building name"
          {...register("addressLine1")}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="City" htmlFor="city" error={errors.city?.message}>
          <input
            id="city"
            type="text"
            className={inputClass(!!errors.city)}
            placeholder="Chennai"
            {...register("city")}
          />
        </FormField>
        <FormField label="State" htmlFor="state" error={errors.state?.message}>
          <input
            id="state"
            type="text"
            className={inputClass(!!errors.state)}
            placeholder="Tamil Nadu"
            {...register("state")}
          />
        </FormField>
        <FormField
          label="Pincode"
          htmlFor="pincode"
          error={errors.pincode?.message}
        >
          <input
            id="pincode"
            type="text"
            inputMode="numeric"
            maxLength={6}
            className={inputClass(!!errors.pincode)}
            placeholder="600001"
            {...register("pincode")}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Capacity (units)"
          htmlFor="capacity"
          error={errors.capacity?.message}
        >
          <input
            id="capacity"
            type="number"
            min={0}
            className={inputClass(!!errors.capacity)}
            placeholder="0"
            {...register("capacity")}
          />
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
              {WAREHOUSE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        )}
      </div>

      <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-primary-500"
          {...register("isDefault")}
        />
        Set as the default warehouse
      </label>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
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
          {isEdit ? "Save changes" : "Create warehouse"}
        </Button>
      </div>
    </form>
  );
}

WarehouseForm.displayName = "WarehouseForm";

// ─────────────────────────────────────────────────────────────
// Modal wrapper (re-used by the warehouses view)
// ─────────────────────────────────────────────────────────────

interface WarehouseFormDialogProps extends WarehouseFormProps {
  readonly onClose: () => void;
}

export function WarehouseFormDialog({
  onClose,
  ...formProps
}: WarehouseFormDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Warehouse form"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <WarehouseForm
          {...formProps}
          onCancel={formProps.onCancel ?? onClose}
        />
      </motion.div>
    </div>
  );
}

WarehouseFormDialog.displayName = "WarehouseFormDialog";
