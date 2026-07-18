"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/shared/error-banner";
import { formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";
import {
  approveRequestAction,
  rejectRequestAction,
} from "@/features/approvals/actions/approval.actions";
import type {
  ApprovalRequestStatus,
  EntityApproval,
} from "@/features/approvals/types/approval.types";

const STATUS_META: Record<
  ApprovalRequestStatus,
  {
    readonly label: string;
    readonly variant: BadgeProps["variant"];
    readonly icon: typeof Clock;
    readonly tone: string;
  }
> = {
  pending: {
    label: "Awaiting approval",
    variant: "warning",
    icon: Clock,
    tone: "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
  },
  approved: {
    label: "Approved",
    variant: "success",
    icon: CheckCircle2,
    tone: "border-success/30 bg-success/10",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    icon: XCircle,
    tone: "border-error/30 bg-error/10",
  },
  cancelled: {
    label: "Cancelled",
    variant: "muted",
    icon: XCircle,
    tone: "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40",
  },
};

const INPUT_CLASS =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40";

interface ApprovalRowProps {
  readonly organizationId: string;
  readonly approval: EntityApproval;
}

function ApprovalRow({ organizationId, approval }: ApprovalRowProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const meta = STATUS_META[approval.status];
  const Icon = meta.icon;

  const decide = useCallback(
    (approve: boolean) => {
      setError(null);
      const trimmed = reason.trim() || undefined;
      startTransition(async () => {
        const result = approve
          ? await approveRequestAction(organizationId, approval.id, trimmed)
          : await rejectRequestAction(organizationId, approval.id, trimmed);
        if (!result.success) {
          setError(result.error.message);
          return;
        }
        router.refresh();
      });
    },
    [organizationId, approval.id, reason, router]
  );

  const handleApprove = useCallback(() => decide(true), [decide]);
  const handleReject = useCallback(() => decide(false), [decide]);
  const handleReasonChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setReason(event.target.value),
    []
  );

  return (
    <div className={cn("rounded-lg border p-3", meta.tone)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon
            className="h-4 w-4 text-slate-600 dark:text-slate-300"
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
            {approval.ruleName ?? "Approval rule"}
          </span>
        </div>
        <Badge dot variant={meta.variant}>
          {meta.label}
        </Badge>
      </div>

      {/* People involved */}
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        Requested by {approval.requestedByName ?? "Unknown"}
        {approval.requestedByRole ? ` (${approval.requestedByRole})` : ""}{" "}
        &middot; {formatDate(approval.createdAt)}
      </p>
      {approval.decidedByName && approval.decidedAt && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {approval.status === "approved"
            ? "Approved"
            : approval.status === "rejected"
              ? "Rejected"
              : "Decided"}{" "}
          by {approval.decidedByName}
          {approval.decidedByRole ? ` (${approval.decidedByRole})` : ""} &middot;{" "}
          {formatDate(approval.decidedAt)}
        </p>
      )}

      {approval.decisionReason && (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          &ldquo;{approval.decisionReason}&rdquo;
        </p>
      )}

      {approval.status === "pending" &&
        (approval.canDecide ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor={`reason-${approval.id}`} className="sr-only">
              Decision reason
            </label>
            <input
              id={`reason-${approval.id}`}
              type="text"
              placeholder="Optional reason"
              value={reason}
              onChange={handleReasonChange}
              className={INPUT_CLASS}
            />
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="success"
                size="sm"
                loading={isPending}
                onClick={handleApprove}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                loading={isPending}
                onClick={handleReject}
              >
                Reject
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Awaiting sign-off from the designated approver.
          </p>
        ))}

      {error && <ErrorBanner message={error} className="mt-2" />}
    </div>
  );
}

interface ApprovalPanelProps {
  readonly organizationId: string;
  readonly approvals: readonly EntityApproval[];
}

/**
 * Surfaces a document's approval requests inline (bill / invoice detail), with
 * approve/reject controls for the designated approver.
 */
export function ApprovalPanel({
  organizationId,
  approvals,
}: ApprovalPanelProps) {
  if (approvals.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck
          className="h-4 w-4 text-primary-600 dark:text-primary-400"
          aria-hidden="true"
        />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Approvals
        </h2>
      </div>
      <div className="space-y-2">
        {approvals.map((approval) => (
          <ApprovalRow
            key={approval.id}
            organizationId={organizationId}
            approval={approval}
          />
        ))}
      </div>
    </motion.div>
  );
}
