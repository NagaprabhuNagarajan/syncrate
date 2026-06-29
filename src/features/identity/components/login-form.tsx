"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/identity/schemas/auth.schemas";
import { signInAction } from "@/features/identity/actions/auth.actions";
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
      className="text-error-600 dark:text-error-400 mt-1.5 flex items-center gap-1.5 text-xs"
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
          ? "border-error-200 dark:border-error-500/30 bg-error-50 dark:bg-error-500/10 text-error-800 dark:text-error-300"
          : "border-success-200 dark:border-success-500/30 bg-success-50 dark:bg-success-500/10 text-success-800 dark:text-success-300"
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
// Login Form
// ─────────────────────────────────────────────────────────────

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const message = searchParams.get("message");

  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const successMessage =
    message === "password-reset"
      ? "Your password has been reset. Please log in."
      : null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("email", values.email);
    fd.append("password", values.password);
    if (values.rememberMe) {
      fd.append("rememberMe", "on");
    }
    fd.append("redirectTo", redirectTo);

    startTransition(async () => {
      const result = await signInAction(fd);
      // If result comes back (redirect would have happened), show the error
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
      className="rounded-2xl border border-slate-200/60 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 sm:p-6 shadow-lg shadow-slate-200/50 dark:shadow-none"
    >
      {/* Heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sign in to your Syncrate account
        </p>
      </div>

      {/* Alerts */}
      <div className="mb-4 space-y-3">
        {successMessage && (
          <AlertBanner type="success" message={successMessage} />
        )}
        {serverError && <AlertBanner type="error" message={serverError} />}
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Email address
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={errors.email ? "email-error" : undefined}
            placeholder="you@company.com"
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>

        {/* Password */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="rounded text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "password-error" : undefined}
              className="pr-10"
              placeholder="Enter your password"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <FieldError message={errors.password?.message} />
        </div>

        {/* Remember me */}
        <div className="flex items-center gap-2.5">
          <input
            id="rememberMe"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary-600 dark:text-primary-400 focus:ring-primary-500"
            {...register("rememberMe")}
          />
          <label htmlFor="rememberMe" className="text-sm text-slate-600 dark:text-slate-400">
            Remember me for 30 days
          </label>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          size="lg"
          variant="gradient"
          className="w-full"
          loading={isPending}
          disabled={isPending}
        >
          <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign in
        </Button>
      </form>

      {/* Register link */}
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="rounded font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Create one free
        </Link>
      </p>
    </motion.div>
  );
}
