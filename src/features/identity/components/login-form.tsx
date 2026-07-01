"use client";

import { useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  otpRequestSchema,
  otpVerifySchema,
  type OtpRequestFormValues,
  type OtpVerifyFormValues,
} from "@/features/identity/schemas/auth.schemas";
import {
  requestOtpAction,
  verifyOtpAction,
} from "@/features/identity/actions/auth.actions";
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

const cardClass =
  "rounded-2xl border border-slate-200/60 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 sm:p-6 shadow-lg shadow-slate-200/50 dark:shadow-none";

// ─────────────────────────────────────────────────────────────
// Step 1 — email entry
// ─────────────────────────────────────────────────────────────

interface EmailStepProps {
  readonly onSent: (email: string) => void;
}

function EmailStep({ onSent }: EmailStepProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpRequestFormValues>({
    resolver: zodResolver(otpRequestSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    const fd = new FormData();
    fd.append("email", values.email);

    startTransition(async () => {
      const result = await requestOtpAction(fd);
      if (result.success) {
        onSent(values.email);
      } else {
        setServerError(result.error.message);
      }
    });
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cardClass}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Welcome to Syncrate
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Enter your email and we&apos;ll send you a login code — no password
          needed.
        </p>
      </div>

      {serverError && (
        <div className="mb-4">
          <AlertBanner type="error" message={serverError} />
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
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
            autoFocus
            aria-invalid={errors.email ? "true" : "false"}
            placeholder="you@company.com"
            {...register("email")}
          />
          <FieldError message={errors.email?.message} />
        </div>

        <Button
          type="submit"
          size="lg"
          variant="gradient"
          className="w-full"
          loading={isPending}
          disabled={isPending}
        >
          <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
          Send login code
        </Button>
      </form>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step 2 — code entry
// ─────────────────────────────────────────────────────────────

interface CodeStepProps {
  readonly email: string;
  readonly redirectTo: string;
  readonly onChangeEmail: () => void;
}

function CodeStep({ email, redirectTo, onChangeEmail }: CodeStepProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [resentNote, setResentNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isResending, startResend] = useTransition();
  const submittedRef = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    setFocus,
    formState: { errors },
  } = useForm<OtpVerifyFormValues>({
    resolver: zodResolver(otpVerifySchema),
    defaultValues: { email, token: "" },
  });

  const token = watch("token");

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    setResentNote(null);
    const fd = new FormData();
    fd.append("email", values.email);
    fd.append("token", values.token);
    fd.append("redirectTo", redirectTo);

    startTransition(async () => {
      const result = await verifyOtpAction(fd);
      // On success verifyOtpAction redirects, so control only returns on error.
      if (result && !result.success) {
        setServerError(result.error.message);
      }
    });
  });

  const onResend = () => {
    setServerError(null);
    setResentNote(null);
    const fd = new FormData();
    fd.append("email", email);
    startResend(async () => {
      const result = await requestOtpAction(fd);
      if (result.success) {
        setResentNote("A new code is on its way to your inbox.");
        setFocus("token");
      } else {
        setServerError(result.error.message);
      }
    });
  };

  // Auto-submit once a full 6-digit code has been entered.
  if (/^\d{6}$/.test(token ?? "") && !submittedRef.current && !isPending) {
    submittedRef.current = true;
    void onSubmit();
  }
  if (!/^\d{6}$/.test(token ?? "")) {
    submittedRef.current = false;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cardClass}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Check your email
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {email}
          </span>
          .
        </p>
      </div>

      <div className="mb-4 space-y-3">
        {resentNote && <AlertBanner type="success" message={resentNote} />}
        {serverError && <AlertBanner type="error" message={serverError} />}
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <input type="hidden" {...register("email")} />
        <div>
          <label
            htmlFor="token"
            className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Login code
          </label>
          <Input
            id="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            aria-invalid={errors.token ? "true" : "false"}
            placeholder="123456"
            className="text-center text-lg tracking-[0.5em] font-semibold nums"
            {...register("token")}
          />
          <FieldError message={errors.token?.message} />
        </div>

        <Button
          type="submit"
          size="lg"
          variant="gradient"
          className="w-full"
          loading={isPending}
          disabled={isPending}
        >
          <ArrowRight className="mr-2 h-4 w-4" aria-hidden="true" />
          Verify &amp; continue
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onChangeEmail}
          className="inline-flex items-center gap-1.5 rounded font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Change email
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={isResending}
          className="rounded font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {isResending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Login Form — passwordless, two-step (email → code)
// ─────────────────────────────────────────────────────────────

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const [email, setEmail] = useState<string | null>(null);

  if (email) {
    return (
      <CodeStep
        email={email}
        redirectTo={redirectTo}
        onChangeEmail={() => setEmail(null)}
      />
    );
  }

  return <EmailStep onSent={setEmail} />;
}
