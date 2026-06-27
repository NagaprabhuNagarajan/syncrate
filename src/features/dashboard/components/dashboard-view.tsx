"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  Users,
  FileText,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Building2,
  Zap,
} from "lucide-react";
import type { Organization } from "@/features/organization/types/organization.types";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────

interface StatCardProps {
  readonly label: string;
  readonly value: string;
  readonly change: string;
  readonly changeType: "up" | "down" | "neutral";
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly color: "blue" | "green" | "orange" | "purple";
  readonly index: number;
}

const COLOR_MAP = {
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-600",
    badge: "text-blue-700 bg-blue-50",
  },
  green: {
    bg: "bg-green-50",
    icon: "text-green-600",
    badge: "text-green-700 bg-green-50",
  },
  orange: {
    bg: "bg-orange-50",
    icon: "text-orange-600",
    badge: "text-orange-700 bg-orange-50",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-600",
    badge: "text-purple-700 bg-purple-50",
  },
};

function StatCard({
  label,
  value,
  change,
  changeType,
  icon: Icon,
  color,
  index,
}: StatCardProps) {
  const colors = COLOR_MAP[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className={cn("rounded-lg p-2.5", colors.bg)}>
          <Icon className={cn("h-5 w-5", colors.icon)} aria-hidden="true" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {changeType === "up" && (
          <ArrowUpRight
            className="text-success-500 h-3.5 w-3.5"
            aria-hidden="true"
          />
        )}
        {changeType === "down" && (
          <ArrowDownRight
            className="text-error-500 h-3.5 w-3.5"
            aria-hidden="true"
          />
        )}
        <span
          className={cn(
            "text-xs font-medium",
            changeType === "up"
              ? "text-success-600"
              : changeType === "down"
                ? "text-error-600"
                : "text-slate-500"
          )}
        >
          {change}
        </span>
        <span className="text-xs text-slate-400">vs last month</span>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Activity item (empty state placeholder)
// ─────────────────────────────────────────────────────────────

function EmptyActivity() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Zap className="h-6 w-6 text-slate-400" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-slate-600">No activity yet</p>
      <p className="mt-1 text-xs text-slate-400">
        Your recent transactions and events will appear here
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Quick action card
// ─────────────────────────────────────────────────────────────

interface QuickActionProps {
  readonly label: string;
  readonly description: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly href: string;
  readonly color: string;
}

function QuickAction({
  label,
  description,
  icon: Icon,
  href,
  color,
}: QuickActionProps) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-150 hover:border-primary-200 hover:shadow-md"
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          color
        )}
      >
        <Icon className="h-5 w-5 text-white" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 group-hover:text-primary-700">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{description}</p>
      </div>
      <ArrowUpRight
        className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-primary-500"
        aria-hidden="true"
      />
    </a>
  );
}

// ─────────────────────────────────────────────────────────────
// Dashboard View
// ─────────────────────────────────────────────────────────────

interface DashboardViewProps {
  readonly organization: Organization;
  readonly organizations: Organization[];
  readonly userId: string;
}

const STAT_CARDS: Omit<StatCardProps, "index">[] = [
  {
    label: "Total Revenue",
    value: "—",
    change: "No data yet",
    changeType: "neutral",
    icon: TrendingUp,
    color: "blue",
  },
  {
    label: "Active Customers",
    value: "—",
    change: "No data yet",
    changeType: "neutral",
    icon: Users,
    color: "green",
  },
  {
    label: "Open Invoices",
    value: "—",
    change: "No data yet",
    changeType: "neutral",
    icon: FileText,
    color: "orange",
  },
  {
    label: "Payments Received",
    value: "—",
    change: "No data yet",
    changeType: "neutral",
    icon: CreditCard,
    color: "purple",
  },
];

const QUICK_ACTIONS: QuickActionProps[] = [
  {
    label: "New Invoice",
    description: "Create and send an invoice",
    icon: FileText,
    href: "/invoices/new",
    color: "bg-primary-600",
  },
  {
    label: "Add Customer",
    description: "Register a new customer",
    icon: Users,
    href: "/customers/new",
    color: "bg-green-600",
  },
  {
    label: "Record Payment",
    description: "Log a received payment",
    icon: CreditCard,
    href: "/payments/new",
    color: "bg-purple-600",
  },
  {
    label: "Add Product",
    description: "Add to your product catalog",
    icon: Package,
    href: "/products/new",
    color: "bg-orange-600",
  },
];

export function DashboardView({
  organization,
  organizations: _organizations,
  userId: _userId,
}: DashboardViewProps) {
  return (
    <div className="p-6 lg:p-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
            <Building2
              className="h-5 w-5 text-primary-600"
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {organization.name}
            </h1>
            <p className="text-sm text-slate-500">
              Welcome back — here&apos;s your business overview
            </p>
          </div>
        </div>
      </motion.div>

      {/* Setup Banner (shown when org is new) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        className="mb-8 rounded-xl border border-primary-200 bg-gradient-to-r from-primary-50 to-indigo-50 px-5 py-4"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600/10">
            <Zap className="h-5 w-5 text-primary-600" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-primary-900">
              Get started with Syncrate
            </p>
            <p className="mt-0.5 text-xs text-primary-700">
              Complete your setup by inviting team members, configuring
              settings, and connecting with your business network.
            </p>
          </div>
          <a
            href="/settings"
            className="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700"
          >
            Complete setup
          </a>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((card, i) => (
          <StatCard key={card.label} {...card} index={i} />
        ))}
      </div>

      {/* Two-column: Activity + Quick actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          className="rounded-xl border border-slate-200 bg-white"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent Activity
            </h2>
            <a
              href="/reports"
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              View all
            </a>
          </div>
          <EmptyActivity />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.25 }}
          className="rounded-xl border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            {QUICK_ACTIONS.map((action) => (
              <QuickAction key={action.label} {...action} />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
