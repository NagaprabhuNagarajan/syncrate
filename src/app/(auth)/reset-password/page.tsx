import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/identity/components/reset-password-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your Syncrate account",
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200/60 bg-white px-8 py-8 shadow-xl">
          <Skeleton className="mb-6 h-8 w-48" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
