"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  MailCheck,
  MailX,
  XCircle,
  Building2,
  ShieldCheck,
  AtSign,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import {
  acceptInvitationAction,
  declineInvitationAction,
} from "@/features/organization/actions/organization.actions";
import type {
  InvitationDetails,
  Organization,
} from "@/features/organization/types/organization.types";
import { formatDate } from "@/utils/format";

interface AcceptInvitationViewProps {
  readonly token: string | null;
  readonly details?: InvitationDetails | null;
  /** Set when the token is missing/expired/already used — renders an error card. */
  readonly detailsError?: string | null;
}

type ViewState =
  | { readonly status: "idle" }
  | { readonly status: "success"; readonly organization: Organization }
  | { readonly status: "declined" }
  | { readonly status: "error"; readonly message: string };

// ─────────────────────────────────────────────────────────────
// Card shell
// ─────────────────────────────────────────────────────────────

function Card({ children }: { readonly children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none sm:p-7"
    >
      {children}
    </motion.div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-slate-900 dark:text-slate-100">
        {children}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View
// ─────────────────────────────────────────────────────────────

export function AcceptInvitationView({
  token,
  details = null,
  detailsError = null,
}: AcceptInvitationViewProps) {
  const [state, setState] = useState<ViewState>({ status: "idle" });
  const [isAccepting, startAccept] = useTransition();
  const [isDeclining, startDecline] = useTransition();
  const isPending = isAccepting || isDeclining;

  const orgName = details?.organizationName ?? "the organization";

  const handleAccept = () => {
    if (!token) {
      return;
    }
    setState({ status: "idle" });
    startAccept(async () => {
      const result = await acceptInvitationAction(token);
      if (result.success) {
        setState({ status: "success", organization: result.data });
      } else {
        setState({ status: "error", message: result.error.message });
      }
    });
  };

  const handleDecline = () => {
    if (!token) {
      return;
    }
    setState({ status: "idle" });
    startDecline(async () => {
      const result = await declineInvitationAction(token);
      if (result.success) {
        setState({ status: "declined" });
      } else {
        setState({ status: "error", message: result.error.message });
      }
    });
  };

  // ── Invalid / expired token (from the server) ──────────────
  if (detailsError && state.status === "idle") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-50 dark:bg-error-500/10">
            <MailX
              className="h-6 w-6 text-error-600 dark:text-error-400"
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Invitation unavailable
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {detailsError}
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </Card>
    );
  }

  // ── Working ────────────────────────────────────────────────
  if (isPending) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-10">
          <LoadingSpinner size="lg" label="Working…" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isDeclining
              ? "Declining invitation…"
              : "Accepting your invitation…"}
          </p>
        </div>
      </Card>
    );
  }

  // ── Accepted ───────────────────────────────────────────────
  if (state.status === "success") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 dark:bg-success-500/10">
            <CheckCircle2
              className="h-6 w-6 text-success-600 dark:text-success-400"
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              You&apos;ve joined {state.organization.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Your invitation has been accepted successfully. Welcome aboard!
            </p>
          </div>
          <Button asChild variant="gradient" className="w-full">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </Card>
    );
  }

  // ── Declined ───────────────────────────────────────────────
  if (state.status === "declined") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <XCircle
              className="h-6 w-6 text-slate-500 dark:text-slate-400"
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Invitation declined
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              You&apos;ve declined the invitation to join {orgName}. No further
              action is needed.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </Card>
    );
  }

  // ── Accept/decline failed ──────────────────────────────────
  if (state.status === "error") {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-50 dark:bg-error-500/10">
            <MailX
              className="h-6 w-6 text-error-600 dark:text-error-400"
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Something went wrong
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {state.message}
            </p>
          </div>
          <Button
            type="button"
            variant="gradient"
            className="w-full"
            onClick={handleAccept}
          >
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  // ── Idle: the invitation prompt ────────────────────────────
  return (
    <Card>
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-brand shadow-glow-primary">
          <MailCheck className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Accept your invitation
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {details ? (
              <>
                You&apos;ve been invited to join{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {details.organizationName}
                </span>{" "}
                on Syncrate.
              </>
            ) : (
              "You've been invited to join an organization on Syncrate. Confirm below to get started."
            )}
          </p>
        </div>

        {details && (
          <dl className="w-full divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/60 px-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-800/30">
            <DetailRow icon={Building2} label="Organization">
              {details.organizationName}
            </DetailRow>
            <DetailRow icon={ShieldCheck} label="Role">
              <Badge variant="info">{details.roleName}</Badge>
            </DetailRow>
            <DetailRow icon={AtSign} label="Invited email">
              {details.email}
            </DetailRow>
            <DetailRow icon={CalendarClock} label="Expires">
              {formatDate(details.expiresAt)}
            </DetailRow>
          </dl>
        )}

        <div className="flex w-full flex-col gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            variant="gradient"
            className="w-full sm:flex-1"
            onClick={handleAccept}
            disabled={isPending || !token}
          >
            <MailCheck className="mr-2 h-4 w-4" aria-hidden="true" />
            Accept invitation
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleDecline}
            disabled={isPending || !token}
          >
            <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            Decline
          </Button>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Not expecting this? You can safely decline — no account changes are
          made.
        </p>
      </div>
    </Card>
  );
}
