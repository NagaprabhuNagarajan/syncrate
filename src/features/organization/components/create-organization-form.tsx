"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Building2, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createOrganizationSchema,
  type CreateOrganizationFormValues,
} from "@/features/organization/schemas/organization.schemas";
import { createOrganizationAction } from "@/features/organization/actions/organization.actions";
import { cn } from "@/utils/cn";

const BUSINESS_TYPES = [
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "llp", label: "LLP (Limited Liability Partnership)" },
  { value: "private_limited", label: "Private Limited Company" },
  { value: "public_limited", label: "Public Limited Company" },
  { value: "one_person_company", label: "One Person Company (OPC)" },
  { value: "other", label: "Other" },
] as const;

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli",
  "Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

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
    "block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors dark:text-slate-100 dark:placeholder-slate-500",
    "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
    hasError
      ? "border-error-400 bg-error-50/30 dark:bg-error-500/10"
      : "border-slate-300 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
  );

export function CreateOrganizationForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrganizationFormValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: "",
      country: "IN",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    Object.entries(values).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        fd.append(key, String(val));
      }
    });

    startTransition(async () => {
      const result = await createOrganizationAction(fd);
      if (result && !result.success) {
        setServerError(result.error.message);
      }
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/60 bg-white px-8 py-8 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header */}
      <div className="mb-7 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-500/10">
          <Building2 className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Set up your organization
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tell us about your business — you can update this later
          </p>
        </div>
      </div>

      {serverError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="border-error-200 bg-error-50 text-error-800 mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
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
        {/* Organization Name */}
        <FormField
          label="Organization name"
          htmlFor="name"
          required
          error={errors.name?.message}
          hint="This will be your business display name across Syncrate"
        >
          <input
            id="name"
            type="text"
            autoFocus
            autoComplete="organization"
            aria-invalid={errors.name ? "true" : "false"}
            className={inputClass(!!errors.name)}
            placeholder="Sharma Enterprises Pvt. Ltd."
            {...register("name")}
          />
        </FormField>

        {/* Business Type */}
        <FormField
          label="Business type"
          htmlFor="businessType"
          error={errors.businessType?.message}
        >
          <select
            id="businessType"
            className={inputClass(!!errors.businessType)}
            {...register("businessType")}
          >
            <option value="">Select business type</option>
            {BUSINESS_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>
                {bt.label}
              </option>
            ))}
          </select>
        </FormField>

        {/* GST Number */}
        <FormField
          label="GST number"
          htmlFor="gstNumber"
          error={errors.gstNumber?.message}
          hint="22AAAAA0000A1Z5 format — leave blank if not registered"
        >
          <input
            id="gstNumber"
            type="text"
            autoComplete="off"
            aria-invalid={errors.gstNumber ? "true" : "false"}
            className={cn(inputClass(!!errors.gstNumber), "uppercase")}
            placeholder="22AAAAA0000A1Z5"
            {...register("gstNumber")}
          />
        </FormField>

        {/* Divider */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Contact details (optional)
          </span>
          <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
        </div>

        {/* Phone + Email — 2-col */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField
            label="Phone"
            htmlFor="phone"
            error={errors.phone?.message}
          >
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
            label="Business email"
            htmlFor="email"
            error={errors.email?.message}
          >
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={inputClass(!!errors.email)}
              placeholder="info@company.com"
              {...register("email")}
            />
          </FormField>
        </div>

        {/* Address */}
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

        {/* City + State — 2-col */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
            <select
              id="state"
              className={inputClass(!!errors.state)}
              {...register("state")}
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Pincode */}
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
            className={cn(inputClass(!!errors.pincode), "max-w-[160px]")}
            placeholder="400001"
            {...register("pincode")}
          />
        </FormField>

        {/* Submit */}
        <div className="pt-2">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={isPending}
            disabled={isPending}
          >
            Continue
            <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
          <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
            You can add branches, invite team members, and configure settings
            after setup.
          </p>
        </div>
      </form>
    </motion.div>
  );
}
