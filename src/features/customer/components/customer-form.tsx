"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@/features/customer/schemas/customer.schemas";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/features/customer/actions/customer.actions";
import type {
  Customer,
  CustomerStatus,
} from "@/features/customer/types/customer.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Form value shape (superset of create + update fields)
// ─────────────────────────────────────────────────────────────

interface CustomerFormValues {
  code: string;
  name: string;
  company: string;
  gstNumber: string;
  panNumber: string;
  mobile: string;
  email: string;
  website: string;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  creditLimit: string;
  paymentTermsDays: string;
  preferredPaymentMethod: string;
  openingBalance: string;
  notes: string;
  status?: CustomerStatus;
}

const OPTIONAL_TEXT_FIELDS = [
  "code",
  "company",
  "gstNumber",
  "panNumber",
  "mobile",
  "email",
  "website",
  "billingAddressLine1",
  "billingAddressLine2",
  "billingCity",
  "billingState",
  "billingPincode",
  "shippingAddressLine1",
  "shippingAddressLine2",
  "shippingCity",
  "shippingState",
  "shippingPincode",
  "preferredPaymentMethod",
  "notes",
] as const;

const NUMBER_FIELDS = [
  "creditLimit",
  "paymentTermsDays",
  "openingBalance",
] as const;

const CUSTOMER_STATUSES: { value: CustomerStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" },
  { value: "archived", label: "Archived" },
];

// ─────────────────────────────────────────────────────────────
// Field helpers (mirror create-organization-form / branch-form)
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
      {hint && !error && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

function SectionTitle({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
      <span className="text-xs font-medium tracking-wide text-slate-400 dark:text-slate-500">
        {children}
      </span>
      <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
    </div>
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
// Customer form (create + edit)
// ─────────────────────────────────────────────────────────────

interface CustomerFormProps {
  readonly organizationId: string;
  readonly customer?: Customer;
  readonly onSuccess?: () => void;
  readonly onCancel?: () => void;
}

export function CustomerForm({
  organizationId,
  customer,
  onSuccess,
  onCancel,
}: CustomerFormProps) {
  const router = useRouter();
  const isEdit = Boolean(customer);
  const [serverError, setServerError] = useState<string | null>(null);
  const [tags, setTags] = useState<string>(customer?.tags.join(", ") ?? "");
  const [isPending, startTransition] = useTransition();

  const resolver = (
    isEdit
      ? zodResolver(updateCustomerSchema)
      : zodResolver(createCustomerSchema)
  ) as unknown as Resolver<CustomerFormValues>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver,
    defaultValues: {
      code: customer?.code ?? "",
      name: customer?.name ?? "",
      company: customer?.company ?? "",
      gstNumber: customer?.gstNumber ?? "",
      panNumber: customer?.panNumber ?? "",
      mobile: customer?.mobile ?? "",
      email: customer?.email ?? "",
      website: customer?.website ?? "",
      billingAddressLine1: customer?.billingAddressLine1 ?? "",
      billingAddressLine2: customer?.billingAddressLine2 ?? "",
      billingCity: customer?.billingCity ?? "",
      billingState: customer?.billingState ?? "",
      billingPincode: customer?.billingPincode ?? "",
      shippingAddressLine1: customer?.shippingAddressLine1 ?? "",
      shippingAddressLine2: customer?.shippingAddressLine2 ?? "",
      shippingCity: customer?.shippingCity ?? "",
      shippingState: customer?.shippingState ?? "",
      shippingPincode: customer?.shippingPincode ?? "",
      creditLimit: customer ? String(customer.creditLimit) : "",
      paymentTermsDays: customer ? String(customer.paymentTermsDays) : "",
      preferredPaymentMethod: customer?.preferredPaymentMethod ?? "",
      openingBalance: customer ? String(customer.openingBalance) : "",
      notes: customer?.notes ?? "",
      status: customer?.status ?? "active",
    },
  });

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
        isEdit && customer
          ? await updateCustomerAction(organizationId, customer.id, fd)
          : await createCustomerAction(organizationId, fd);

      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/customers");
      }
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-lg shadow-slate-200/50 dark:shadow-none sm:p-5"
    >
      {/* Header */}
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <Users className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit customer" : "Add customer"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the details for this customer"
              : "Create a new customer record for your organization"}
          </p>
        </div>
      </div>

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

      <form onSubmit={onSubmit} noValidate className="space-y-3">
        {/* Identity */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Customer name"
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
              placeholder="Kumar Traders"
              {...register("name")}
            />
          </FormField>
          <FormField
            label="Customer code"
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
              placeholder="CUST-00001"
              {...register("code")}
            />
          </FormField>
        </div>

        <FormField
          label="Company"
          htmlFor="company"
          error={errors.company?.message}
        >
          <input
            id="company"
            type="text"
            className={inputClass(!!errors.company)}
            placeholder="Kumar Traders Pvt. Ltd."
            {...register("company")}
          />
        </FormField>

        {/* Tax */}
        <SectionTitle>Tax details</SectionTitle>
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

        {/* Contact */}
        <SectionTitle>Contact</SectionTitle>
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
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={inputClass(!!errors.email)}
              placeholder="contact@company.com"
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

        {/* Billing address */}
        <SectionTitle>Billing address</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Address line 1"
            htmlFor="billingAddressLine1"
            error={errors.billingAddressLine1?.message}
          >
            <input
              id="billingAddressLine1"
              type="text"
              className={inputClass(!!errors.billingAddressLine1)}
              placeholder="Street address, building name"
              {...register("billingAddressLine1")}
            />
          </FormField>
          <FormField
            label="Address line 2"
            htmlFor="billingAddressLine2"
            error={errors.billingAddressLine2?.message}
          >
            <input
              id="billingAddressLine2"
              type="text"
              className={inputClass(!!errors.billingAddressLine2)}
              placeholder="Area, landmark"
              {...register("billingAddressLine2")}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField
            label="City"
            htmlFor="billingCity"
            error={errors.billingCity?.message}
          >
            <input
              id="billingCity"
              type="text"
              className={inputClass(!!errors.billingCity)}
              placeholder="Mumbai"
              {...register("billingCity")}
            />
          </FormField>
          <FormField
            label="State"
            htmlFor="billingState"
            error={errors.billingState?.message}
          >
            <input
              id="billingState"
              type="text"
              className={inputClass(!!errors.billingState)}
              placeholder="Maharashtra"
              {...register("billingState")}
            />
          </FormField>
          <FormField
            label="Pincode"
            htmlFor="billingPincode"
            error={errors.billingPincode?.message}
          >
            <input
              id="billingPincode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={inputClass(!!errors.billingPincode)}
              placeholder="400001"
              {...register("billingPincode")}
            />
          </FormField>
        </div>

        {/* Shipping address */}
        <SectionTitle>Shipping address</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Address line 1"
            htmlFor="shippingAddressLine1"
            error={errors.shippingAddressLine1?.message}
          >
            <input
              id="shippingAddressLine1"
              type="text"
              className={inputClass(!!errors.shippingAddressLine1)}
              placeholder="Street address, building name"
              {...register("shippingAddressLine1")}
            />
          </FormField>
          <FormField
            label="Address line 2"
            htmlFor="shippingAddressLine2"
            error={errors.shippingAddressLine2?.message}
          >
            <input
              id="shippingAddressLine2"
              type="text"
              className={inputClass(!!errors.shippingAddressLine2)}
              placeholder="Area, landmark"
              {...register("shippingAddressLine2")}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField
            label="City"
            htmlFor="shippingCity"
            error={errors.shippingCity?.message}
          >
            <input
              id="shippingCity"
              type="text"
              className={inputClass(!!errors.shippingCity)}
              placeholder="Mumbai"
              {...register("shippingCity")}
            />
          </FormField>
          <FormField
            label="State"
            htmlFor="shippingState"
            error={errors.shippingState?.message}
          >
            <input
              id="shippingState"
              type="text"
              className={inputClass(!!errors.shippingState)}
              placeholder="Maharashtra"
              {...register("shippingState")}
            />
          </FormField>
          <FormField
            label="Pincode"
            htmlFor="shippingPincode"
            error={errors.shippingPincode?.message}
          >
            <input
              id="shippingPincode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={inputClass(!!errors.shippingPincode)}
              placeholder="400001"
              {...register("shippingPincode")}
            />
          </FormField>
        </div>

        {/* Commercial terms */}
        <SectionTitle>Commercial terms</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Credit limit (₹)"
            htmlFor="creditLimit"
            error={errors.creditLimit?.message}
          >
            <input
              id="creditLimit"
              type="number"
              min={0}
              step="0.01"
              className={inputClass(!!errors.creditLimit)}
              placeholder="0"
              {...register("creditLimit")}
            />
          </FormField>
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
              placeholder="0"
              {...register("paymentTermsDays")}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Preferred payment method"
            htmlFor="preferredPaymentMethod"
            error={errors.preferredPaymentMethod?.message}
          >
            <input
              id="preferredPaymentMethod"
              type="text"
              className={inputClass(!!errors.preferredPaymentMethod)}
              placeholder="UPI, NEFT, Cash…"
              {...register("preferredPaymentMethod")}
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
        </div>

        {/* Classification */}
        <SectionTitle>Classification</SectionTitle>
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
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField label="Tags" htmlFor="tags" hint="Separate tags with commas">
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className={inputClass(false)}
            placeholder="vip, wholesale, priority"
          />
        </FormField>
        <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
          <textarea
            id="notes"
            rows={3}
            className={inputClass(!!errors.notes)}
            placeholder="Internal notes about this customer"
            {...register("notes")}
          />
        </FormField>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel ?? (() => router.push("/customers"))}
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
            {isEdit ? "Save changes" : "Create customer"}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
