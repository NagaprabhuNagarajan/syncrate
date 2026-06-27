"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Ruler, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createUnitSchema,
  updateUnitSchema,
} from "@/features/unit/schemas/unit.schemas";
import {
  createUnitAction,
  updateUnitAction,
} from "@/features/unit/actions/unit.actions";
import type { Unit, UnitStatus } from "@/features/unit/types/unit.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Form value shape (superset of create + update fields)
// ─────────────────────────────────────────────────────────────

interface UnitFormValues {
  name: string;
  symbol: string;
  status?: UnitStatus;
}

const UNIT_STATUSES: { value: UnitStatus; label: string }[] = [
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
      className="text-error-600 mt-1.5 flex items-center gap-1.5 text-xs"
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

const inputClass = (hasError: boolean) =>
  cn(
    "block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
    hasError
      ? "border-error-400 bg-error-50/30"
      : "border-slate-300 bg-white hover:border-slate-400"
  );

// ─────────────────────────────────────────────────────────────
// Unit form (create + edit)
// ─────────────────────────────────────────────────────────────

interface UnitFormProps {
  readonly organizationId: string;
  readonly unit?: Unit;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
}

export function UnitForm({
  organizationId,
  unit,
  onSuccess,
  onCancel,
}: UnitFormProps) {
  const router = useRouter();
  const isEdit = Boolean(unit);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit ? zodResolver(updateUnitSchema) : zodResolver(createUnitSchema)
  ) as unknown as Resolver<UnitFormValues>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UnitFormValues>({
    resolver,
    defaultValues: {
      name: unit?.name ?? "",
      symbol: unit?.symbol ?? "",
      status: unit?.status ?? "active",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("name", values.name);
    fd.append("symbol", values.symbol);

    if (isEdit && values.status) {
      fd.append("status", values.status);
    }

    startTransition(async () => {
      const result =
        isEdit && unit
          ? await updateUnitAction(organizationId, unit.id, fd)
          : await createUnitAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/products/units");
      }
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
          <Ruler className="h-5 w-5 text-primary-600" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {isEdit ? "Edit unit" : "Add unit"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Update the details for this unit of measure"
              : "Create a new unit of measure for your organization"}
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Unit name"
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
              placeholder="Kilogram"
              {...register("name")}
            />
          </FormField>
          <FormField
            label="Symbol"
            htmlFor="symbol"
            required
            error={errors.symbol?.message}
          >
            <input
              id="symbol"
              type="text"
              autoComplete="off"
              aria-invalid={errors.symbol ? "true" : "false"}
              className={inputClass(!!errors.symbol)}
              placeholder="kg"
              {...register("symbol")}
            />
          </FormField>
        </div>

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
              {UNIT_STATUSES.map((s) => (
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
            onClick={onCancel ?? (() => router.push("/products/units"))}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={isPending}>
            {isEdit ? "Save changes" : "Create unit"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
