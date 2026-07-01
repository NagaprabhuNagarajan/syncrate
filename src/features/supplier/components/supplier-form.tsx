"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Truck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  code: string;
  name: string;
  contactPerson: string;
  gstNumber: string;
  panNumber: string;
  mobile: string;
  email: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankName: string;
  upiId: string;
  paymentTermsDays: string;
  openingBalance: string;
  rating: string;
  notes: string;
  status?: SupplierStatus;
}

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

const NUMBER_FIELDS = [
  "paymentTermsDays",
  "openingBalance",
  "rating",
] as const;

const SUPPLIER_STATUSES: { value: SupplierStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

/** Dot color per status, mirroring the badge palette used elsewhere. */
const STATUS_DOT: Record<SupplierStatus, string> = {
  active: "bg-success",
  inactive: "bg-slate-400 dark:bg-slate-500",
  archived: "bg-slate-500 dark:bg-slate-600",
};

// ─────────────────────────────────────────────────────────────
// Field helpers
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
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
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
    "block w-full rounded-lg border px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out",
    "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary",
    hasError
      ? "border-destructive bg-destructive/5"
      : "border-input bg-background hover:border-slate-400 dark:hover:border-slate-600"
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
  const [tags, setTags] = useState<string>(supplier?.tags.join(", ") ?? "");
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit ? zodResolver(updateSupplierSchema) : zodResolver(createSupplierSchema)
  ) as unknown as Resolver<SupplierFormValues>;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver,
    defaultValues: {
      code: supplier?.code ?? "",
      name: supplier?.name ?? "",
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
      paymentTermsDays: supplier ? String(supplier.paymentTermsDays) : "",
      openingBalance: supplier ? String(supplier.openingBalance) : "",
      rating: supplier?.rating !== null && supplier?.rating !== undefined
        ? String(supplier.rating)
        : "",
      notes: supplier?.notes ?? "",
      status: supplier?.status ?? "active",
    },
  });

  const currentStatus = watch("status");

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("name", values.name);

    OPTIONAL_TEXT_FIELDS.forEach((key) => {
      const value = values[key];
      if (typeof value === "string" && value.trim() !== "") {
        fd.append(key, value.trim());
      }
    });

    NUMBER_FIELDS.forEach((key) => {
      const value = values[key];
      if (value !== undefined && String(value) !== "") {
        fd.append(key, String(value));
      }
    });

    // Tags are entered as a comma-separated string; the action splits them.
    fd.append("tags", tags);

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
      } else {
        router.push("/suppliers");
      }
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
          <Truck className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit supplier" : "Add supplier"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the details for this supplier"
              : "Create a new supplier for your organization"}
          </p>
        </div>
      </motion.div>

      {serverError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-800 dark:text-error-300 mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
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
        {/* Basic info */}
        <Section
          title="Basic information"
          description="The supplier's name and identifier."
          delay={0.05}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>
        </Section>

        {/* Tax details */}
        <Section
          title="Tax details"
          description="Used on purchase invoices and for GST reporting."
          delay={0.1}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="GST number"
              htmlFor="gstNumber"
              error={errors.gstNumber?.message}
              hint="22AAAAA0000A1Z5 format"
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
        </Section>

        {/* Contact */}
        <Section
          title="Contact"
          description="How you reach this supplier."
          delay={0.12}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  placeholder="supplier@company.com"
                  {...register("email")}
                />
              </FormField>
            </div>
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
        </Section>

        {/* Address */}
        <Section title="Address" delay={0.14}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField label="City" htmlFor="city" error={errors.city?.message}>
                <input
                  id="city"
                  type="text"
                  className={inputClass(!!errors.city)}
                  placeholder="Mumbai"
                  {...register("city")}
                />
              </FormField>
              <FormField
                label="State"
                htmlFor="state"
                error={errors.state?.message}
              >
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
          </div>
        </Section>

        {/* Bank details */}
        <Section
          title="Bank details"
          description="Used for payments to this supplier."
          delay={0.16}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <FormField
                label="UPI ID"
                htmlFor="upiId"
                error={errors.upiId?.message}
              >
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
          </div>
        </Section>

        {/* Commercial & classification */}
        <Section
          title="Commercial & classification"
          description="Payment defaults and organization for this supplier."
          delay={0.2}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                label="Opening balance (₹)"
                htmlFor="openingBalance"
                error={errors.openingBalance?.message}
              >
                <input
                  id="openingBalance"
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass(!!errors.openingBalance)}
                  placeholder="0"
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

            {isEdit && (
              <FormField
                label="Status"
                htmlFor="status"
                error={errors.status?.message}
                hint="Set to a non-archived status to restore an archived supplier"
              >
                <div
                  id="status"
                  role="radiogroup"
                  aria-label="Status"
                  className="flex flex-wrap gap-2"
                >
                  {SUPPLIER_STATUSES.map((s) => {
                    const selected = currentStatus === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          setValue("status", s.value, { shouldDirty: true })
                        }
                        className={cn(
                          "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          selected
                            ? "border-primary bg-primary/5 text-slate-900 ring-1 ring-primary/40 dark:text-slate-100"
                            : "border-input bg-background text-slate-600 hover:border-slate-400 dark:text-slate-300 dark:hover:border-slate-600"
                        )}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            STATUS_DOT[s.value]
                          )}
                          aria-hidden="true"
                        />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </FormField>
            )}
            <FormField
              label="Tags"
              htmlFor="tags"
              hint="Separate tags with commas"
            >
              <input
                id="tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className={inputClass(false)}
                placeholder="raw-materials, preferred"
              />
            </FormField>
            <FormField
              label="Notes"
              htmlFor="notes"
              error={errors.notes?.message}
            >
              <textarea
                id="notes"
                rows={3}
                className={inputClass(!!errors.notes)}
                placeholder="Internal notes about this supplier"
                {...register("notes")}
              />
            </FormField>
          </div>
        </Section>

        {/* Sticky action bar */}
        <div className="sticky bottom-4 z-10 flex flex-col-reverse gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {isEdit
              ? "Changes are saved when you submit."
              : "Only the name is required to create a supplier."}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel ?? (() => router.push("/suppliers"))}
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
              {isEdit ? "Save changes" : "Create supplier"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
