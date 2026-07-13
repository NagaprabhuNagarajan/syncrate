"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Users, AlertCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { ErrorBanner } from "@/components/shared/error-banner";
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

const BILLING_TO_SHIPPING = [
  ["billingAddressLine1", "shippingAddressLine1"],
  ["billingAddressLine2", "shippingAddressLine2"],
  ["billingCity", "shippingCity"],
  ["billingState", "shippingState"],
  ["billingPincode", "shippingPincode"],
] as const;

const CUSTOMER_STATUSES: { value: CustomerStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" },
  { value: "archived", label: "Archived" },
];

/** Dot color per status, mirroring the badge palette used elsewhere. */
const STATUS_DOT: Record<CustomerStatus, string> = {
  active: "bg-success",
  inactive: "bg-slate-400 dark:bg-slate-500",
  blacklisted: "bg-destructive",
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
  action,
  children,
  delay,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
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
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action}
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
    isEdit ? zodResolver(updateCustomerSchema) : zodResolver(createCustomerSchema)
  ) as unknown as Resolver<CustomerFormValues>;

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
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

  const currentStatus = watch("status");

  const copyBillingToShipping = (): void => {
    BILLING_TO_SHIPPING.forEach(([from, to]) => {
      setValue(to, getValues(from), { shouldDirty: true });
    });
  };

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
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-5 flex items-start gap-3"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <Users className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {isEdit ? "Edit customer" : "Add customer"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {isEdit
              ? "Update the details for this customer"
              : "Create a new customer record for your organization"}
          </p>
        </div>
      </motion.div>

      {serverError && <ErrorBanner message={serverError} className="mb-4" />}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Basic info */}
        <Section
          title="Basic information"
          description="The customer's name and identifier."
          delay={0.05}
        >
          <div className="space-y-3">
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
          </div>
        </Section>

        {/* Tax details */}
        <Section
          title="Tax details"
          description="Used on invoices and for GST reporting."
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
          description="How you reach this customer."
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
          </div>
        </Section>

        {/* Billing address */}
        <Section title="Billing address" delay={0.14}>
          <div className="space-y-3">
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
          </div>
        </Section>

        {/* Shipping address */}
        <Section
          title="Shipping address"
          delay={0.16}
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={copyBillingToShipping}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Same as billing
            </Button>
          }
        >
          <div className="space-y-3">
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
          </div>
        </Section>

        {/* Commercial terms */}
        <Section
          title="Commercial terms"
          description="Credit and payment defaults for this customer."
          delay={0.18}
        >
          <div className="space-y-3">
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
          </div>
        </Section>

        {/* Classification */}
        <Section
          title="Classification"
          description="Organize and tag this customer."
          delay={0.2}
        >
          <div className="space-y-3">
            {isEdit && (
              <FormField
                label="Status"
                htmlFor="status"
                error={errors.status?.message}
                hint="Set to a non-archived status to restore an archived customer"
              >
                <div
                  id="status"
                  role="radiogroup"
                  aria-label="Status"
                  className="flex flex-wrap gap-2"
                >
                  {CUSTOMER_STATUSES.map((s) => {
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
                placeholder="vip, wholesale, priority"
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
                placeholder="Internal notes about this customer"
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
              : "Only the name is required to create a customer."}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
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
        </div>
      </form>
    </div>
  );
}
