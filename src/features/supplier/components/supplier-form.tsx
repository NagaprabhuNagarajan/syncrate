"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Truck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "@/features/supplier/schemas/supplier.schemas";
import {
  createSupplierAction,
  updateSupplierAction,
} from "@/features/supplier/actions/supplier.actions";
import type {
  Supplier,
  SupplierStatus,
} from "@/features/supplier/types/supplier.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Form value shape (superset of create + update fields)
// ─────────────────────────────────────────────────────────────

interface SupplierFormValues {
  name: string;
  code?: string;
  contactPerson?: string;
  gstNumber?: string;
  panNumber?: string;
  mobile?: string;
  email?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  upiId?: string;
  paymentTermsDays?: number;
  openingBalance?: number;
  rating?: number;
  tags?: string;
  notes?: string;
  status?: SupplierStatus;
}

const SUPPLIER_STATUSES: { value: SupplierStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

const OPTIONAL_TEXT_FIELDS = [
  "code",
  "contactPerson",
  "gstNumber",
  "panNumber",
  "mobile",
  "email",
  "website",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "pincode",
  "bankAccountName",
  "bankAccountNumber",
  "bankIfsc",
  "bankName",
  "upiId",
  "notes",
] as const;

const OPTIONAL_NUMBER_FIELDS = [
  "paymentTermsDays",
  "openingBalance",
  "rating",
] as const;

// ─────────────────────────────────────────────────────────────
// Field helpers (mirror branch-form)
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

const SectionDivider = ({ label }: { readonly label: string }) => (
  <div className="flex items-center gap-3 py-1">
    <div className="flex-1 border-t border-slate-100" />
    <span className="text-xs text-slate-400">{label}</span>
    <div className="flex-1 border-t border-slate-100" />
  </div>
);

// ─────────────────────────────────────────────────────────────
// Supplier form (create + edit)
// ─────────────────────────────────────────────────────────────

interface SupplierFormProps {
  readonly organizationId: string;
  readonly supplier?: Supplier;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
}

export function SupplierForm({
  organizationId,
  supplier,
  onSuccess,
  onCancel,
}: SupplierFormProps) {
  const router = useRouter();
  const isEdit = Boolean(supplier);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The `tags` field is edited as a comma-separated string in the form but the
  // schema models it as an array — omit it from client validation; the server
  // action re-validates the full payload.
  const resolver = (
    isEdit
      ? zodResolver(updateSupplierSchema.omit({ tags: true }))
      : zodResolver(createSupplierSchema.omit({ tags: true }))
  ) as Resolver<SupplierFormValues>;

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver,
    defaultValues: {
      name: supplier?.name ?? "",
      code: supplier?.code ?? "",
      contactPerson: supplier?.contactPerson ?? "",
      gstNumber: supplier?.gstNumber ?? "",
      panNumber: supplier?.panNumber ?? "",
      mobile: supplier?.mobile ?? "",
      email: supplier?.email ?? "",
      website: supplier?.website ?? "",
      addressLine1: supplier?.addressLine1 ?? "",
      addressLine2: supplier?.addressLine2 ?? "",
      city: supplier?.city ?? "",
      state: supplier?.state ?? "",
      pincode: supplier?.pincode ?? "",
      bankAccountName: supplier?.bankAccountName ?? "",
      bankAccountNumber: supplier?.bankAccountNumber ?? "",
      bankIfsc: supplier?.bankIfsc ?? "",
      bankName: supplier?.bankName ?? "",
      upiId: supplier?.upiId ?? "",
      paymentTermsDays: supplier?.paymentTermsDays ?? 0,
      openingBalance: supplier?.openingBalance ?? 0,
      rating: supplier?.rating ?? undefined,
      tags: supplier?.tags.join(", ") ?? "",
      notes: supplier?.notes ?? "",
      status: supplier?.status ?? "active",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("name", values.name);
    OPTIONAL_TEXT_FIELDS.forEach((key) => {
      const value = values[key];
      if (typeof value === "string" && value !== "") {
        fd.append(key, value);
      }
    });
    OPTIONAL_NUMBER_FIELDS.forEach((key) => {
      const value = values[key];
      if (value !== undefined && value !== null && !Number.isNaN(value)) {
        fd.append(key, String(value));
      }
    });
    // `tags` is omitted from the resolver schema, so read it from the raw form
    // value rather than the parsed submit values.
    const tagsValue = getValues("tags");
    if (typeof tagsValue === "string" && tagsValue.trim() !== "") {
      fd.append("tags", tagsValue);
    }
    if (isEdit && values.status) {
      fd.append("status", values.status);
    }

    startTransition(async () => {
      const result =
        isEdit && supplier
          ? await updateSupplierAction(organizationId, supplier.id, fd)
          : await createSupplierAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }
      if (onSuccess) {
        onSuccess();
        return;
      }
      router.push(`/suppliers?org=${organizationId}`);
      router.refresh();
    });
  });

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    router.push(`/suppliers?org=${organizationId}`);
  };

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
          <Truck className="h-5 w-5 text-primary-600" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {isEdit ? "Edit supplier" : "Add supplier"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isEdit
              ? "Update the details for this supplier"
              : "Create a new supplier for your organization"}
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
        {/* Name + Code */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Supplier name"
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
              placeholder="Acme Industries Pvt Ltd"
              {...register("name")}
            />
          </FormField>
          <FormField
            label="Supplier code"
            htmlFor="code"
            error={errors.code?.message}
            hint="Leave blank to auto-generate"
          >
            <input
              id="code"
              type="text"
              autoComplete="off"
              aria-invalid={errors.code ? "true" : "false"}
              className={cn(inputClass(!!errors.code), "uppercase")}
              placeholder="SUPP-00001"
              {...register("code")}
            />
          </FormField>
        </div>

        {/* Contact person + Mobile */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Contact person"
            htmlFor="contactPerson"
            error={errors.contactPerson?.message}
          >
            <input
              id="contactPerson"
              type="text"
              className={inputClass(!!errors.contactPerson)}
              placeholder="Ramesh Kumar"
              {...register("contactPerson")}
            />
          </FormField>
          <FormField
            label="Mobile"
            htmlFor="mobile"
            error={errors.mobile?.message}
          >
            <input
              id="mobile"
              type="tel"
              autoComplete="tel"
              className={inputClass(!!errors.mobile)}
              placeholder="+91 98765 43210"
              {...register("mobile")}
            />
          </FormField>
        </div>

        {/* Email + Website */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={inputClass(!!errors.email)}
              placeholder="supplier@company.com"
              {...register("email")}
            />
          </FormField>
          <FormField
            label="Website"
            htmlFor="website"
            error={errors.website?.message}
          >
            <input
              id="website"
              type="url"
              className={inputClass(!!errors.website)}
              placeholder="https://company.com"
              {...register("website")}
            />
          </FormField>
        </div>

        {/* GST + PAN */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
          <FormField
            label="PAN number"
            htmlFor="panNumber"
            error={errors.panNumber?.message}
          >
            <input
              id="panNumber"
              type="text"
              autoComplete="off"
              className={cn(inputClass(!!errors.panNumber), "uppercase")}
              placeholder="AAAAA0000A"
              {...register("panNumber")}
            />
          </FormField>
        </div>

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
              {SUPPLIER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {/* Address */}
        <SectionDivider label="Address (optional)" />
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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
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
        </div>

        {/* Bank details */}
        <SectionDivider label="Bank details (optional)" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Account holder name"
            htmlFor="bankAccountName"
            error={errors.bankAccountName?.message}
          >
            <input
              id="bankAccountName"
              type="text"
              className={inputClass(!!errors.bankAccountName)}
              placeholder="Acme Industries Pvt Ltd"
              {...register("bankAccountName")}
            />
          </FormField>
          <FormField
            label="Account number"
            htmlFor="bankAccountNumber"
            error={errors.bankAccountNumber?.message}
          >
            <input
              id="bankAccountNumber"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={inputClass(!!errors.bankAccountNumber)}
              placeholder="123456789012"
              {...register("bankAccountNumber")}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <FormField
            label="IFSC code"
            htmlFor="bankIfsc"
            error={errors.bankIfsc?.message}
          >
            <input
              id="bankIfsc"
              type="text"
              autoComplete="off"
              className={cn(inputClass(!!errors.bankIfsc), "uppercase")}
              placeholder="HDFC0001234"
              {...register("bankIfsc")}
            />
          </FormField>
          <FormField
            label="Bank name"
            htmlFor="bankName"
            error={errors.bankName?.message}
          >
            <input
              id="bankName"
              type="text"
              className={inputClass(!!errors.bankName)}
              placeholder="HDFC Bank"
              {...register("bankName")}
            />
          </FormField>
          <FormField label="UPI ID" htmlFor="upiId" error={errors.upiId?.message}>
            <input
              id="upiId"
              type="text"
              autoComplete="off"
              className={inputClass(!!errors.upiId)}
              placeholder="acme@okhdfcbank"
              {...register("upiId")}
            />
          </FormField>
        </div>

        {/* Commercial */}
        <SectionDivider label="Commercial & classification (optional)" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <FormField
            label="Payment terms (days)"
            htmlFor="paymentTermsDays"
            error={errors.paymentTermsDays?.message}
          >
            <input
              id="paymentTermsDays"
              type="number"
              min={0}
              max={365}
              className={inputClass(!!errors.paymentTermsDays)}
              placeholder="30"
              {...register("paymentTermsDays")}
            />
          </FormField>
          <FormField
            label="Opening balance"
            htmlFor="openingBalance"
            error={errors.openingBalance?.message}
          >
            <input
              id="openingBalance"
              type="number"
              min={0}
              step="0.01"
              className={inputClass(!!errors.openingBalance)}
              placeholder="0.00"
              {...register("openingBalance")}
            />
          </FormField>
          <FormField
            label="Rating"
            htmlFor="rating"
            error={errors.rating?.message}
            hint="0–5"
          >
            <input
              id="rating"
              type="number"
              min={0}
              max={5}
              step="0.1"
              className={inputClass(!!errors.rating)}
              placeholder="4.5"
              {...register("rating")}
            />
          </FormField>
        </div>
        <FormField
          label="Tags"
          htmlFor="tags"
          error={errors.tags?.message}
          hint="Comma-separated, e.g. raw-materials, preferred"
        >
          <input
            id="tags"
            type="text"
            className={inputClass(!!errors.tags)}
            placeholder="raw-materials, preferred"
            {...register("tags")}
          />
        </FormField>
        <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
          <textarea
            id="notes"
            rows={3}
            className={inputClass(!!errors.notes)}
            placeholder="Internal notes about this supplier"
            {...register("notes")}
          />
        </FormField>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isPending} disabled={isPending}>
            {isEdit ? "Save changes" : "Create supplier"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
