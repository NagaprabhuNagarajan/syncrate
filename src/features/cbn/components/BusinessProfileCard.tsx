"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { MapPin, Link2, UserCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrustScoreBadge } from "@/features/cbn/components/TrustScoreBadge";
import { VerificationBadge } from "@/features/cbn/components/VerificationBadge";
import { formatBusinessId } from "@/features/cbn/utils/business-id";
import type { BusinessSearchResult } from "@/features/cbn/types/cbn.types";

interface BusinessProfileCardProps {
  readonly business: BusinessSearchResult;
  readonly onConnect?: (orgId: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function ConnectionStatusBadge({ status }: { readonly status: string | null }) {
  if (!status) {return null;}
  const variants: Record<string, "warning" | "success" | "muted" | "destructive"> = {
    pending: "warning",
    accepted: "success",
    rejected: "destructive",
    blocked: "destructive",
    disconnected: "muted",
  };
  const labels: Record<string, string> = {
    pending: "Request Sent",
    accepted: "Connected",
    rejected: "Rejected",
    blocked: "Blocked",
    disconnected: "Disconnected",
  };
  return (
    <Badge variant={variants[status] ?? "muted"}>
      {labels[status] ?? status}
    </Badge>
  );
}

/**
 * Compact card for a business discovered via CBN search.
 * Shows key identity info, trust score, and a connect action.
 */
export function BusinessProfileCard({
  business,
  onConnect,
}: BusinessProfileCardProps) {
  const initials = getInitials(business.name);
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  const handleConnect = (): void => {
    startTransition(() => {
      setSent(true);
      onConnect?.(business.id);
    });
  };

  const alreadyConnected =
    business.isConnected ||
    sent ||
    (business.connectionStatus !== null &&
      business.connectionStatus !== "rejected" &&
      business.connectionStatus !== "disconnected");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={{ y: -2 }}
      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {business.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.logoUrl}
            alt={`${business.name} logo`}
            className="h-10 w-10 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-sm font-bold text-teal-700">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {business.displayName ?? business.name}
          </h3>
          <p className="text-[11px] font-mono text-slate-400">
            {formatBusinessId(business.businessId)}
          </p>
        </div>

        <TrustScoreBadge score={business.trustScore} size="sm" />
      </div>

      {/* Meta */}
      <div className="mt-3 space-y-1.5">
        {(business.city ?? business.state) && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{[business.city, business.state].filter(Boolean).join(", ")}</span>
          </div>
        )}
        {business.gstNumber && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="font-mono">{business.gstNumber}</span>
          </div>
        )}
        {business.businessType && (
          <p className="text-xs text-slate-500 capitalize">
            {business.businessType.replace(/_/g, " ")}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <VerificationBadge level={business.verificationLevel} />

        {alreadyConnected ? (
          business.connectionStatus === "accepted" || business.isConnected ? (
            <Badge variant="success" className="gap-1">
              <UserCheck className="h-3 w-3" aria-hidden="true" />
              Connected
            </Badge>
          ) : (
            <ConnectionStatusBadge status={business.connectionStatus} />
          )
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-teal-200 text-teal-700 hover:bg-teal-50"
            onClick={handleConnect}
            disabled={isPending || sent}
            aria-label={`Connect with ${business.name}`}
          >
            {sent ? (
              <>
                <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
                Pending
              </>
            ) : (
              "Connect"
            )}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
