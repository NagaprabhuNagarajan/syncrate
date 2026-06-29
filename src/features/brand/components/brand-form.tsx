"use client";

import { useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Tag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createBrandSchema,
  updateBrandSchema,
} from "@/features/brand/schemas/brand.schemas";
import {
  createBrandAction,
  updateBrandAction,
} from "@/features/brand/actions/brand.actions";
import type { Brand, BrandStatus } from "@/features/brand/types/brand.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Form value shape (superset of create + update fields)
// ─────────────────────────────────────────────────────────────

interface BrandFormValues {
  name: string;
  description: string;
  status?: BrandStatus;
}

const BRAND_STATUSES: { value: BrandStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

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
    "block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 shadow-sm transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
    hasError
      ? "border-error-400 bg-error-50/30"
      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400"
  );

// ─────────────────────────────────────────────────────────────
// Brand form (create + edit)
// ─────────────────────────────────────────────────────────────

interface BrandFormProps {
  readonly organizationId: string;
  readonly brand?: Brand;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
}

export function BrandForm({
  organizationId,
  brand,
  onSuccess,
  onCancel,
}: BrandFormProps) {
  const isEdit = Boolean(brand);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit ? zodResolver(updateBrandSchema) : zodResolver(createBrandSchema)
  ) as unknown as Resolver<BrandFormValues>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BrandFormValues>({
    resolver,
    defaultValues: {
      name: brand?.name ?? "",
      description: brand?.description ?? "",
      status: brand?.status ?? "active",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("name", values.name);
    if (values.description.trim() !== "") {
      fd.append("description", values.description.trim());
    }
    if (isEdit && values.status) {
      fd.append("status", values.status);
    }

    startTransition(async () => {
      const result =
        isEdit && brand
          ? await updateBrandAction(organizationId, brand.id, fd)
          : await createBrandAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      onSuccess?.();
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/60 bg-white dark:bg-slate-900 px-6 py-6 shadow-xl shadow-slate-200/50 sm:px-8 sm:py-8"
    >
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-500/10">
          <Tag className="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit brand" : "Add brand"}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the details for this brand"
              : "Create a new brand for your product catalog"}
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

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormField
          label="Brand name"
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
            placeholder="Samsung"
            {...register("name")}
          />
        </FormField>

        <FormField
          label="Description"
          htmlFor="description"
          error={errors.description?.message}
        >
          <textarea
            id="description"
            rows={3}
            className={inputClass(!!errors.description)}
            placeholder="Notes about this brand"
            {...register("description")}
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
              {BRAND_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={isPending}>
            {isEdit ? "Save changes" : "Create brand"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
