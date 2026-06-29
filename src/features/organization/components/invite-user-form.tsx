"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  inviteUserSchema,
  type InviteUserFormValues,
} from "@/features/organization/schemas/organization.schemas";
import { inviteUserAction } from "@/features/organization/actions/organization.actions";
import type {
  Branch,
  Role,
} from "@/features/organization/types/organization.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

interface FieldErrorProps {
  readonly message?: string;
}

function FieldError({ message }: FieldErrorProps) {
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

interface AlertBannerProps {
  readonly type: "error" | "success";
  readonly message: string;
}

function AlertBanner({ type, message }: AlertBannerProps) {
  const isError = type === "error";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        isError
          ? "border-error-200 bg-error-50 text-error-800 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          : "border-success-200 bg-success-50 text-success-800 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
      )}
      role="alert"
      aria-live="assertive"
    >
      {isError ? (
        <AlertCircle
          className="text-error-500 mt-0.5 h-4 w-4 shrink-0"
          aria-hidden="true"
        />
      ) : (
        <CheckCircle2
          className="text-success-500 mt-0.5 h-4 w-4 shrink-0"
          aria-hidden="true"
        />
      )}
      <span>{message}</span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Invite User Form
// ─────────────────────────────────────────────────────────────

const inputClass = (hasError: boolean) =>
  cn(
    "block w-full rounded-lg border px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground shadow-sm transition-[border-color,box-shadow] duration-150 ease-out",
    "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary",
    hasError
      ? "border-destructive bg-destructive/5"
      : "border-input bg-background hover:border-slate-400 dark:hover:border-slate-600"
  );

interface InviteUserFormProps {
  readonly organizationId: string;
  readonly roles: Role[];
  readonly branches: Branch[];
  readonly onSuccess?: () => void;
}

export function InviteUserForm({
  organizationId,
  roles,
  branches,
  onSuccess,
}: InviteUserFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteUserFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { email: "", fullName: "", roleId: "", branchId: undefined },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    setSuccessMessage(null);

    const fd = new FormData();
    fd.append("email", values.email);
    if (values.fullName) {
      fd.append("fullName", values.fullName);
    }
    fd.append("roleId", values.roleId);
    if (values.branchId) {
      fd.append("branchId", values.branchId);
    }

    startTransition(async () => {
      const result = await inviteUserAction(organizationId, fd);
      if (!result.success) {
        setServerError(result.error.message);
        return;
      }
      setSuccessMessage(`Invitation sent to ${values.email}.`);
      reset();
      onSuccess?.();
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Invite a team member
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          They&apos;ll receive an email with a link to join.
        </p>
      </div>

      {(serverError ?? successMessage) && (
        <div className="mb-4 space-y-3">
          {successMessage && (
            <AlertBanner type="success" message={successMessage} />
          )}
          {serverError && <AlertBanner type="error" message={serverError} />}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Email */}
        <div>
          <label
            htmlFor="invite-email"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Email address
          </label>
          <input
            id="invite-email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? "true" : "false"}
            className={inputClass(Boolean(errors.email))}
            placeholder="colleague@company.com"
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>

        {/* Full name */}
        <div>
          <label
            htmlFor="invite-full-name"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Full name{" "}
            <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <input
            id="invite-full-name"
            type="text"
            autoComplete="name"
            aria-invalid={errors.fullName ? "true" : "false"}
            className={inputClass(Boolean(errors.fullName))}
            placeholder="Jane Doe"
            {...register("fullName")}
          />
          <FieldError message={errors.fullName?.message} />
        </div>

        {/* Role */}
        <div>
          <label
            htmlFor="invite-role"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Role
          </label>
          <select
            id="invite-role"
            aria-invalid={errors.roleId ? "true" : "false"}
            className={inputClass(Boolean(errors.roleId))}
            defaultValue=""
            {...register("roleId")}
          >
            <option value="" disabled>
              Select a role
            </option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.roleId?.message} />
        </div>

        {/* Branch */}
        <div>
          <label
            htmlFor="invite-branch"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Branch{" "}
            <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
          </label>
          <select
            id="invite-branch"
            aria-invalid={errors.branchId ? "true" : "false"}
            className={inputClass(Boolean(errors.branchId))}
            defaultValue=""
            {...register("branchId", {
              setValueAs: (value: string) =>
                value === "" ? undefined : value,
            })}
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.branchId?.message} />
        </div>

        <Button
          type="submit"
          variant="gradient"
          className="w-full"
          loading={isPending}
          disabled={isPending}
        >
          <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
          Send invitation
        </Button>
      </form>
    </motion.div>
  );
}
