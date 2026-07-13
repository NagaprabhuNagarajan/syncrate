"use client";

import { useState, useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Building2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/shared/error-banner";
import {
  createBranchSchema,
  updateBranchSchema,
} from "@/features/organization/schemas/organization.schemas";
import {
  createBranchAction,
  updateBranchAction,
} from "@/features/organization/actions/organization.actions";
import type {
  Branch,
  BranchStatus,
} from "@/features/organization/types/organization.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Form value shape (superset of create + update fields)
// ─────────────────────────────────────────────────────────────

interface BranchFormValues {
  name: string;
  code: string;
  isHeadquarters?: boolean;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstNumber?: string;
  status?: BranchStatus;
}

const BRANCH_STATUSES: { value: BranchStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "closed", label: "Closed" },
];

const OPTIONAL_TEXT_FIELDS = [
  "phone",
  "email",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "pincode",
  "gstNumber",
] as const;

// ─────────────────────────────────────────────────────────────
// Field helpers (mirror create-organization-form)
// ─────────────────────────────────────────────────────────────

function FieldError({ message }: { readonly message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-error-600 mt-1.5 flex items-center gap-1.5 text-xs dark:text-error-400"
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
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      )}
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
// Branch form (create + edit)
// ─────────────────────────────────────────────────────────────

interface BranchFormProps {
  readonly organizationId: string;
  readonly branch?: Branch;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
}

export function BranchForm({
  organizationId,
  branch,
  onSuccess,
  onCancel,
}: BranchFormProps) {
  const isEdit = Boolean(branch);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit ? zodResolver(updateBranchSchema) : zodResolver(createBranchSchema)
  ) as Resolver<BranchFormValues>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchFormValues>({
    resolver,
    defaultValues: {
      name: branch?.name ?? "",
      code: branch?.code ?? "",
      isHeadquarters: branch?.isHeadquarters ?? false,
      phone: branch?.phone ?? "",
      email: branch?.email ?? "",
      addressLine1: branch?.addressLine1 ?? "",
      addressLine2: branch?.addressLine2 ?? "",
      city: branch?.city ?? "",
      state: branch?.state ?? "",
      pincode: branch?.pincode ?? "",
      gstNumber: branch?.gstNumber ?? "",
      status: branch?.status ?? "active",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("name", values.name);
    fd.append("code", values.code);
    // Booleans: only present in FormData ("on") when checked.
    if (values.isHeadquarters) {
      fd.append("isHeadquarters", "on");
    }
    OPTIONAL_TEXT_FIELDS.forEach((key) => {
      const value = values[key];
      if (typeof value === "string" && value !== "") {
        fd.append(key, value);
      }
    });
    if (isEdit && values.status) {
      fd.append("status", values.status);
    }

    startTransition(async () => {
      const result =
        isEdit && branch
          ? await updateBranchAction(organizationId, branch.id, fd)
          : await createBranchAction(organizationId, fd);

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
      className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-6"
    >
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit branch" : "Add branch"}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the details for this branch"
              : "Create a new branch for your organization"}
          </p>
        </div>
      </div>

      {serverError && <ErrorBanner message={serverError} className="mb-4" />}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Name + Code */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Branch name"
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
              placeholder="Mumbai Head Office"
              {...register("name")}
            />
          </FormField>
          <FormField
            label="Branch code"
            htmlFor="code"
            required
            error={errors.code?.message}
            hint="2–10 uppercase letters or digits"
          >
            <input
              id="code"
              type="text"
              autoComplete="off"
              aria-invalid={errors.code ? "true" : "false"}
              className={cn(inputClass(!!errors.code), "uppercase")}
              placeholder="MUM01"
              {...register("code")}
            />
          </FormField>
        </div>

        {/* Headquarters */}
        <label
          htmlFor="isHeadquarters"
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50"
        >
          <input
            id="isHeadquarters"
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700"
            {...register("isHeadquarters")}
          />
          <span>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Set as headquarters
            </span>
            <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">
              The headquarters branch cannot be deleted
            </span>
          </span>
        </label>

        {/* Status (edit only) */}
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
              {BRANCH_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Contact &amp; address (optional)
          </span>
          <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
        </div>

        {/* Phone + Email */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              className={inputClass(!!errors.phone)}
              placeholder="+91 98765 43210"
              {...register("phone")}
            />
          </FormField>
          <FormField
            label="Email"
            htmlFor="email"
            error={errors.email?.message}
          >
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={inputClass(!!errors.email)}
              placeholder="branch@company.com"
              {...register("email")}
            />
          </FormField>
        </div>

        {/* Address line 1 + 2 */}
        <FormField
          label="Address line 1"
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
        <FormField
          label="Address line 2"
          htmlFor="addressLine2"
          error={errors.addressLine2?.message}
        >
          <input
            id="addressLine2"
            type="text"
            className={inputClass(!!errors.addressLine2)}
            placeholder="Area, landmark"
            {...register("addressLine2")}
          />
        </FormField>

        {/* City + State */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="City" htmlFor="city" error={errors.city?.message}>
            <input
              id="city"
              type="text"
              className={inputClass(!!errors.city)}
              placeholder="Mumbai"
              {...register("city")}
            />
          </FormField>
          <FormField label="State" htmlFor="state" error={errors.state?.message}>
            <input
              id="state"
              type="text"
              className={inputClass(!!errors.state)}
              placeholder="Maharashtra"
              {...register("state")}
            />
          </FormField>
        </div>

        {/* Pincode + GST */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              placeholder="400001"
              {...register("pincode")}
            />
          </FormField>
          <FormField
            label="GST number"
            htmlFor="gstNumber"
            error={errors.gstNumber?.message}
          >
            <input
              id="gstNumber"
              type="text"
              autoComplete="off"
              className={cn(inputClass(!!errors.gstNumber), "uppercase")}
              placeholder="22AAAAA0000A1Z5"
              {...register("gstNumber")}
            />
          </FormField>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="gradient"
            loading={isPending}
            disabled={isPending}
          >
            {isEdit ? "Save changes" : "Create branch"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
