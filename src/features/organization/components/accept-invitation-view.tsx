"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { acceptInvitationAction } from "@/features/organization/actions/organization.actions";
import type { Organization } from "@/features/organization/types/organization.types";

interface AcceptInvitationViewProps {
  readonly token: string;
}

type ViewState =
  | { readonly status: "idle" }
  | { readonly status: "success"; readonly organization: Organization }
  | { readonly status: "error"; readonly message: string };

export function AcceptInvitationView({ token }: AcceptInvitationViewProps) {
  const [state, setState] = useState<ViewState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  const handleAccept = () => {
    setState({ status: "idle" });
    startTransition(async () => {
      const result = await acceptInvitationAction(token);
      if (result.success) {
        setState({ status: "success", organization: result.data });
      } else {
        setState({ status: "error", message: result.error.message });
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-slate-200/60 bg-white px-6 py-7 shadow-xl shadow-slate-200/50">
          {isPending ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <LoadingSpinner size="lg" label="Accepting invitation..." />
              <p className="text-sm text-slate-500">
                Accepting your invitation…
              </p>
            </div>
          ) : state.status === "success" ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="bg-success-50 flex h-12 w-12 items-center justify-center rounded-full">
                <CheckCircle2
                  className="text-success-600 h-6 w-6"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  You&apos;ve joined {state.organization.name}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Your invitation has been accepted successfully.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
          ) : state.status === "error" ? (
            <ErrorState
              title="Could not accept invitation"
              message={state.message}
              onRetry={handleAccept}
            />
          ) : (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
                <MailCheck
                  className="h-6 w-6 text-primary-600"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  Accept your invitation
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  You&apos;ve been invited to join an organization on Syncrate.
                  Confirm below to get started.
                </p>
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={handleAccept}
                loading={isPending}
                disabled={isPending}
              >
                Accept invitation
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
