import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/features/identity/components/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Syncrate account",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-slate-200/60 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 sm:p-6 shadow-lg">
          <Skeleton className="mb-4 h-8 w-40" />
          <Skeleton className="mb-6 h-4 w-56" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
