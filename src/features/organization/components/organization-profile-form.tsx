"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Building2, AlertCircle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  updateOrganizationSchema,
  type UpdateOrganizationFormValues,
} from "@/features/organization/schemas/organization.schemas";
import { updateOrganizationAction } from "@/features/organization/actions/organization.actions";
import type { Organization } from "@/features/organization/types/organization.types";
import { cn } from "@/utils/cn";

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
] as const;

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
      {hint && !error && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {hint}
        </p>
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

interface OrganizationProfileFormProps {
  readonly organizationId: string;
  readonly organization: Organization;
}

export function OrganizationProfileForm({
  organizationId,
  organization,
}: OrganizationProfileFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateOrganizationFormValues>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: {
      name: organization.name,
      gstNumber: organization.gstNumber ?? "",
      phone: organization.phone ?? "",
      email: organization.email ?? "",
      addressLine1: organization.addressLine1 ?? "",
      addressLine2: organization.addressLine2 ?? "",
      city: organization.city ?? "",
      state: organization.state ?? "",
      pincode: organization.pincode ?? "",
      country: organization.country ?? "IN",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    Object.entries(values).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        fd.append(key, String(val));
      }
    });

    startTransition(async () => {
      const result = await updateOrganizationAction(organizationId, fd);
      if (result && !result.success) {
        setServerError(result.error.message);
        return;
      }
      toast.success("Organization updated", {
        description: "Your organization details have been saved.",
      });
      router.refresh();
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
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <Building2 className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Organization profile
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Update your business details, contact information, and registered
            address.
          </p>
        </div>
      </div>

      {serverError && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="border-error-200 bg-error-50 text-error-800 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300 mb-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
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
        {/* Organization name */}
        <FormField
          label="Organization name"
          htmlFor="name"
          required
          error={errors.name?.message}
        >
          <input
            id="name"
            type="text"
            autoComplete="organization"
            aria-invalid={errors.name ? "true" : "false"}
            className={inputClass(!!errors.name)}
            placeholder="Sharma Enterprises Pvt. Ltd."
            {...register("name")}
          />
        </FormField>

        {/* GST number */}
        <FormField
          label="GST number"
          htmlFor="gstNumber"
          error={errors.gstNumber?.message}
          hint="Leave blank if not registered"
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
            Contact details
          </span>
          <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
        </div>

        {/* Phone + Email */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        {/* Divider */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Registered address
          </span>
          <div className="flex-1 border-t border-slate-100 dark:border-slate-800" />
        </div>

        {/* Address lines */}
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

          {/* State — emphasized: it drives GST intra/inter-state detection */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <FormField
              label="State"
              htmlFor="state"
              error={errors.state?.message}
              hint="Used to determine CGST/SGST vs IGST on sales orders and invoices."
            >
              <div className="relative">
                <MapPin
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
                  aria-hidden="true"
                />
                <select
                  id="state"
                  className={cn(inputClass(!!errors.state), "pl-9")}
                  {...register("state")}
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </FormField>
          </div>
        </div>

        {/* Pincode + Country */}
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
            label="Country"
            htmlFor="country"
            error={errors.country?.message}
            hint="2-letter ISO code (e.g. IN)"
          >
            <input
              id="country"
              type="text"
              maxLength={2}
              className={cn(inputClass(!!errors.country), "uppercase")}
              placeholder="IN"
              {...register("country")}
            />
          </FormField>
        </div>

        {/* Submit */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="submit"
            variant="gradient"
            loading={isPending}
            disabled={isPending}
          >
            Save changes
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
