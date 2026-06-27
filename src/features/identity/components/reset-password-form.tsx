"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/features/identity/schemas/auth.schemas";
import { resetPasswordAction } from "@/features/identity/actions/auth.actions";
import { cn } from "@/utils/cn";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("password", values.password);
    fd.append("confirmPassword", values.confirmPassword);
    fd.append("token", token);

    startTransition(async () => {
      const result = await resetPasswordAction(fd);
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
      className="rounded-2xl border border-slate-200/60 bg-white px-8 py-8 shadow-xl shadow-slate-200/50"
    >
      <div className="mb-7">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
          <Lock className="h-6 w-6 text-primary-600" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Set new password
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose a strong password for your account
        </p>
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
        {/* New Password */}
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            New password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={errors.password ? "true" : "false"}
              className={cn(
                "block w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors",
                "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500",
                errors.password
                  ? "border-error-400 bg-error-50/30"
                  : "border-slate-300 bg-white hover:border-slate-400"
              )}
              placeholder="At least 8 characters"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password && (
            <p
              className="text-error-600 mt-1.5 flex items-center gap-1.5 text-xs"
              role="alert"
            >
              <AlertCircle
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Confirm new password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? "true" : "false"}
              className={cn(
                "block w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors",
                "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500",
                errors.confirmPassword
                  ? "border-error-400 bg-error-50/30"
                  : "border-slate-300 bg-white hover:border-slate-400"
              )}
              placeholder="Confirm your password"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p
              className="text-error-600 mt-1.5 flex items-center gap-1.5 text-xs"
              role="alert"
            >
              <AlertCircle
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isPending}
          disabled={isPending}
        >
          <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
          Set new password
        </Button>
      </form>
    </motion.div>
  );
}
