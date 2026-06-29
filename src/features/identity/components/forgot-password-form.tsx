"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/features/identity/schemas/auth.schemas";
import { forgotPasswordAction } from "@/features/identity/actions/auth.actions";
import { cn } from "@/utils/cn";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);

    const fd = new FormData();
    fd.append("email", values.email);

    startTransition(async () => {
      const result = await forgotPasswordAction(fd);
      if (result.success) {
        setSent(true);
      } else {
        setServerError(result.error.message);
      }
    });
  });

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border border-slate-200/60 bg-white px-8 py-10 text-center shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-500/10">
          <Mail className="h-8 w-8 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Check your inbox
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          If an account exists for{" "}
          <strong className="font-medium text-slate-700 dark:text-slate-300">
            {getValues("email")}
          </strong>
          , we sent a password reset link. It expires in 24 hours.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-2xl border border-slate-200/60 bg-white px-8 py-8 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Reset your password
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Enter your email and we&apos;ll send you a reset link
        </p>
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
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? "true" : "false"}
            className={cn(
              "block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors",
              "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500",
              errors.email
                ? "border-error-400 bg-error-50/30"
                : "border-slate-300 bg-white hover:border-slate-400"
            )}
            placeholder="you@company.com"
            {...register("email")}
          />
          {errors.email && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-error-600 mt-1.5 flex items-center gap-1.5 text-xs"
              role="alert"
            >
              <AlertCircle
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              {errors.email.message}
            </motion.p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isPending}
          disabled={isPending}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
          Send reset link
        </Button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>
    </motion.div>
  );
}
