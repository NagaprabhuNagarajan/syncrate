"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/features/identity/schemas/auth.schemas";
import { signUpAction } from "@/features/identity/actions/auth.actions";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Password strength indicator
// ─────────────────────────────────────────────────────────────

interface PasswordRule {
  readonly label: string;
  readonly test: (pw: string) => boolean;
}

const PASSWORD_RULES: readonly PasswordRule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One number", test: (p) => /\d/.test(p) },
];

function PasswordStrengthIndicator({
  password,
}: {
  readonly password: string;
}) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const strength =
    passed === 0 ? 0 : passed <= 1 ? 1 : passed <= 2 ? 2 : passed <= 3 ? 3 : 4;

  const colors = [
    "bg-slate-200 dark:bg-slate-700",
    "bg-error-500",
    "bg-warning-500",
    "bg-warning-400",
    "bg-success-500",
  ];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i <= strength ? colors[strength] : "bg-slate-200 dark:bg-slate-700"
            )}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p
          className={cn(
            "text-xs",
            strength >= 3 ? "text-success-600 dark:text-success-400" : "text-slate-500 dark:text-slate-400"
          )}
        >
          Password strength: {labels[strength]}
        </p>
      )}
      <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const passes = rule.test(password);
          return (
            <li key={rule.label} className="flex items-center gap-1.5 text-xs">
              {passes ? (
                <Check
                  className="text-success-500 h-3 w-3"
                  aria-hidden="true"
                />
              ) : (
                <X className="h-3 w-3 text-slate-300" aria-hidden="true" />
              )}
              <span className={passes ? "text-success-700 dark:text-success-300" : "text-slate-500 dark:text-slate-400"}>
                {rule.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Field error
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

// ─────────────────────────────────────────────────────────────
// Register Form
// ─────────────────────────────────────────────────────────────

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: undefined,
    },
  });

  const password = watch("password") ?? "";

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("fullName", values.fullName);
    fd.append("email", values.email);
    fd.append("password", values.password);
    fd.append("confirmPassword", values.confirmPassword);
    fd.append("acceptTerms", "on");

    startTransition(async () => {
      const result = await signUpAction(fd);
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Start your free Syncrate account today
        </p>
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

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Full Name */}
        <div>
          <label
            htmlFor="fullName"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Full name
          </label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            aria-invalid={errors.fullName ? "true" : "false"}
            placeholder="Priya Sharma"
            {...register("fullName")}
          />
          <FieldError message={errors.fullName?.message} />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Work email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? "true" : "false"}
            placeholder="you@company.com"
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={errors.password ? "true" : "false"}
              className="pr-10"
              placeholder="Create a strong password"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {password.length > 0 && (
            <PasswordStrengthIndicator password={password} />
          )}
          {errors.password && <FieldError message={errors.password.message} />}
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Confirm password
          </label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? "true" : "false"}
              className="pr-10"
              placeholder="Confirm your password"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <FieldError message={errors.confirmPassword?.message} />
        </div>

        {/* Accept Terms */}
        <div>
          <div className="flex items-start gap-2.5">
            <input
              id="acceptTerms"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary-600 dark:text-primary-400 focus:ring-primary-500"
              {...register("acceptTerms")}
            />
            <label htmlFor="acceptTerms" className="text-sm text-slate-600 dark:text-slate-400">
              I agree to the{" "}
              <Link
                href="/terms"
                className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              >
                Privacy Policy
              </Link>
            </label>
          </div>
          <FieldError message={errors.acceptTerms?.message} />
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
          <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Success state (shown after redirect to /verify-email)
// ─────────────────────────────────────────────────────────────

export function RegistrationSuccess() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-slate-200/60 bg-white dark:bg-slate-900 dark:border-slate-800 p-6 sm:p-8 text-center shadow-lg shadow-slate-200/50 dark:shadow-none"
    >
      <div className="bg-success-50 dark:bg-success-500/10 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
        <CheckCircle2 className="text-success-600 dark:text-success-400 h-8 w-8" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Check your email</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        We&apos;ve sent a verification link to your email address. Click it to
        activate your account.
      </p>
      <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
        Didn&apos;t receive it? Check your spam folder or{" "}
        <Link
          href="/register"
          className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          try again
        </Link>
        .
      </p>
    </motion.div>
  );
}
