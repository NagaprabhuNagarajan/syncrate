"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import { switchOrganizationAction } from "@/features/organization/actions/organization.actions";
import type { Organization } from "@/features/organization/types/organization.types";
import { cn } from "@/utils/cn";

const PLAN_BADGE: Record<Organization["plan"], string> = {
  free: "bg-slate-100 text-slate-600",
  starter: "bg-blue-50 text-blue-700",
  professional: "bg-purple-50 text-purple-700",
  enterprise: "bg-amber-50 text-amber-700",
};

const PLAN_LABEL: Record<Organization["plan"], string> = {
  free: "Free",
  starter: "Starter",
  professional: "Professional",
  enterprise: "Enterprise",
};

interface OrgCardProps {
  readonly org: Organization;
  readonly index: number;
}

function OrgCard({ org, index }: OrgCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleSelect = () => {
    startTransition(async () => {
      await switchOrganizationAction(org.id);
    });
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.06 }}
      onClick={handleSelect}
      disabled={isPending}
      className={cn(
        "group relative flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all duration-150",
        "hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        isPending
          ? "cursor-wait border-primary-200 bg-primary-50/30"
          : "border-slate-200 bg-white"
      )}
      aria-label={`Select ${org.name}`}
    >
      {/* Logo / Avatar */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-indigo-100">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.logoUrl}
            alt={org.name}
            className="h-10 w-10 rounded-lg object-contain"
          />
        ) : (
          <Building2 className="h-6 w-6 text-primary-600" aria-hidden="true" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">
            {org.name}
          </p>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
              PLAN_BADGE[org.plan]
            )}
          >
            {PLAN_LABEL[org.plan]}
          </span>
        </div>
        {(org.city ?? org.state) && (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {[org.city, org.state].filter(Boolean).join(", ")}
          </p>
        )}
        {org.gstNumber && (
          <p className="mt-0.5 text-xs text-slate-400">GST: {org.gstNumber}</p>
        )}
      </div>

      {/* Arrow */}
      <div
        className={cn(
          "shrink-0 transition-transform duration-150",
          "group-hover:translate-x-0.5"
        )}
        aria-hidden="true"
      >
        {isPending ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
        ) : (
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-primary-500" />
        )}
      </div>
    </motion.button>
  );
}

interface SelectOrganizationViewProps {
  readonly organizations: Organization[];
  readonly userId: string;
}

export function SelectOrganizationView({
  organizations,
  userId: _userId,
}: SelectOrganizationViewProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-12">
      {/* Background blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-100/60 blur-3xl" />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mb-8 flex flex-col items-center gap-2"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-600/20">
          <span className="text-xl font-bold text-white">S</span>
        </div>
        <span className="text-xl font-semibold text-slate-800">Syncrate</span>
      </motion.div>

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-2xl border border-slate-200/60 bg-white px-6 py-7 shadow-xl shadow-slate-200/50">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-slate-900">
              Select organization
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              You belong to {organizations.length} organizations — choose one to
              continue
            </p>
          </div>

          <div className="space-y-3">
            {organizations.map((org, i) => (
              <OrgCard key={org.id} org={org} index={i} />
            ))}
          </div>

          {/* Create new */}
          <div className="mt-5 border-t border-slate-100 pt-5">
            <a
              href="/create-organization"
              className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Create a new organization
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
