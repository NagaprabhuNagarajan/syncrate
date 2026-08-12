"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Unplug,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import {
  disconnectBusiness,
  removeConnection,
} from "@/features/cbn/actions/connection.actions";
import type { BusinessConnection, ConnectionStatus } from "@/features/cbn/types/cbn.types";

interface ConnectionCardProps {
  readonly connection: BusinessConnection;
  /** The current org's ID — used to determine which side is "them". */
  readonly myOrgId: string;
  /** The other org's display name (fetched separately). */
  readonly otherOrgName: string;
  /** Optional business ID of the other org. */
  readonly otherBusinessId?: string | null;
}

const STATUS_VARIANT: Record<ConnectionStatus, BadgeProps["variant"]> = {
  pending: "warning",
  accepted: "success",
  rejected: "destructive",
  blocked: "destructive",
  disconnected: "muted",
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  pending: "Pending",
  accepted: "Connected",
  rejected: "Rejected",
  blocked: "Blocked",
  disconnected: "Disconnected",
};

const STATUS_ICON: Record<
  ConnectionStatus,
  React.ComponentType<{ className?: string }>
> = {
  pending: Clock,
  accepted: CheckCircle2,
  rejected: XCircle,
  blocked: XCircle,
  disconnected: Unplug,
};

function formatDate(d: Date | null): string {
  if (!d) {return "—";}
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Compact card displaying a single business connection.
 * Clicking navigates to the connection detail page.
 */
export function ConnectionCard({
  connection,
  myOrgId,
  otherOrgName,
  otherBusinessId,
}: ConnectionCardProps) {
  const StatusIcon = STATUS_ICON[connection.status];

  // An incoming pending request is the only card the user can act on — call it
  // out so it isn't mistaken for a request they sent and are waiting on.
  const needsMyAction =
    connection.status === "pending" &&
    connection.requesterOrganizationId !== myOrgId;

  const router = useRouter();
  const [busy, startAction] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  // A live connection can be severed; a dead one can be cleared off the list.
  // The two are mutually exclusive, so one contextual button covers both.
  const canDisconnect = connection.status === "accepted";
  const canRemove =
    connection.status === "rejected" || connection.status === "disconnected";

  const handleDisconnect = (): void => {
    if (
      !window.confirm(
        `Disconnect from ${otherOrgName}? This stops all document syncing. You can send a new request later.`
      )
    ) {
      return;
    }
    setActionError(null);
    startAction(async () => {
      const result = await disconnectBusiness(connection.id, myOrgId);
      if (!result.success) {
        setActionError(result.error.message);
        return;
      }
      router.refresh();
    });
  };

  const handleRemove = (): void => {
    if (
      !window.confirm(
        `Remove ${otherOrgName} from your network list? This also clears it for ${otherOrgName}.`
      )
    ) {
      return;
    }
    setActionError(null);
    startAction(async () => {
      const result = await removeConnection(connection.id, myOrgId);
      if (!result.success) {
        setActionError(result.error.message);
        return;
      }
      router.refresh();
    });
  };

  const dateLabel =
    connection.status === "accepted"
      ? `Connected ${formatDate(connection.acceptedAt)}`
      : connection.status === "pending"
        ? needsMyAction
          ? `Received ${formatDate(connection.requestedAt)}`
          : `Requested ${formatDate(connection.requestedAt)}`
        : connection.status === "rejected"
          ? `Rejected ${formatDate(connection.rejectedAt)}`
          : connection.status === "disconnected"
            ? `Disconnected ${formatDate(connection.disconnectedAt)}`
            : `${formatDate(connection.requestedAt)}`;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
      // The row action is a sibling of the Link, not a child — nesting a button
      // inside an anchor is invalid and swallows the click.
      className="relative"
    >
      <Link
        href={`/cbn/connections/${connection.id}`}
        className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 pr-14 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
        aria-label={`View connection with ${otherOrgName}`}
      >
        {/* Org avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-sm font-bold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
          {otherOrgName.slice(0, 2).toUpperCase()}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{otherOrgName}</p>
          {otherBusinessId && (
            <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{otherBusinessId}</p>
          )}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Building2 className="h-3 w-3" aria-hidden="true" />
            <span>{dateLabel}</span>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge
            variant={STATUS_VARIANT[connection.status]}
            className="gap-1"
          >
            <StatusIcon className="h-3 w-3" aria-hidden="true" />
            {needsMyAction ? "Action needed" : STATUS_LABEL[connection.status]}
          </Badge>
          <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        </div>
      </Link>

      {(canDisconnect || canRemove) && (
        <button
          type="button"
          disabled={busy}
          onClick={canDisconnect ? handleDisconnect : handleRemove}
          aria-label={
            canDisconnect
              ? `Disconnect from ${otherOrgName}`
              : `Remove ${otherOrgName} from your network`
          }
          title={canDisconnect ? "Disconnect" : "Remove from list"}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none disabled:opacity-50 dark:hover:bg-red-500/15 dark:hover:text-red-400"
        >
          {canDisconnect ? (
            <Unplug className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      )}

      {actionError && (
        <p role="alert" className="text-error mt-1 px-4 text-xs">
          {actionError}
        </p>
      )}
    </motion.div>
  );
}
