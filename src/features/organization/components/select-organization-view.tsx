"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import { switchOrganizationAction } from "@/features/organization/actions/organization.actions";
import type { Organization } from "@/features/organization/types/organization.types";
import { cn } from "@/utils/cn";
import { BrandLogo } from "@/components/shared/logo";

const PLAN_BADGE: Record<Organization["plan"], string> = {
  free: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  starter: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  professional:
    "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300",
  enterprise:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
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
        "hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/10",
        isPending
          ? "cursor-wait border-primary-200 bg-primary-50/30 dark:border-primary-500/30 dark:bg-primary-500/10"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      )}
      aria-label={`Select ${org.name}`}
    >
      {/* Logo / Avatar */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-indigo-100 dark:from-primary-500/20 dark:to-indigo-500/20">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={org.logoUrl}
            alt={org.name}
            className="h-10 w-10 rounded-lg object-contain"
          />
        ) : (
          <Building2 className="h-6 w-6 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
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
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {[org.city, org.state].filter(Boolean).join(", ")}
          </p>
        )}
        {org.gstNumber && (
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">GST: {org.gstNumber}</p>
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
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-primary-500 dark:text-slate-500" />
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
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
        className="relative z-10 mb-8 flex flex-col items-center"
      >
        <BrandLogo size={140} priority />
      </motion.div>

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-2xl border border-slate-200/60 bg-white px-6 py-7 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Select organization
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
          <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
            <a
              href="/create-organization"
              className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
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
