"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  CreditCard,
  ArrowUpRight,
  Package,
  Building2,
  Zap,
  AlertCircle,
  ShoppingCart,
  Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Organization } from "@/features/organization/types/organization.types";
import type { DashboardKpis, RecentActivityItem } from "@/features/dashboard/services/dashboard.service";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Currency formatting
// ─────────────────────────────────────────────────────────────

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatINR(value: number): string {
  return inrFormatter.format(value);
}

// ─────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────

interface KpiCardProps {
  readonly label: string;
  readonly value: string;
  readonly sub?: string;
  readonly subPositive?: boolean;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly iconBg: string;
  readonly iconColor: string;
  readonly index: number;
  readonly badge?: string;
}

function KpiCard({
  label,
  value,
  sub,
  subPositive,
  icon: Icon,
  iconBg,
  iconColor,
  index,
  badge,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {value}
            </p>
          </div>
          <div className="relative">
            <div className={cn("rounded-lg p-2.5", iconBg)}>
              <Icon className={cn("h-5 w-5", iconColor)} aria-hidden="true" />
            </div>
            {badge !== undefined && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white">
                {badge}
              </span>
            )}
          </div>
        </div>
        {sub !== undefined && (
          <div className="mt-3 flex items-center gap-1.5">
            {subPositive === true ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
            ) : subPositive === false ? (
              <TrendingDown className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
            ) : null}
            <span
              className={cn(
                "text-xs font-medium",
                subPositive === true
                  ? "text-emerald-600 dark:text-emerald-400"
                  : subPositive === false
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-500 dark:text-slate-400"
              )}
            >
              {sub}
            </span>
            {subPositive !== undefined && (
              <span className="text-xs text-slate-400 dark:text-slate-500">vs last month</span>
            )}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Recent Activity
// ─────────────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<RecentActivityItem["type"], string> = {
  invoice: "Invoice",
  purchase_invoice: "Purchase",
  customer_payment: "Payment",
};

const ACTIVITY_COLORS: Record<
  RecentActivityItem["type"],
  { bg: string; text: string }
> = {
  invoice: { bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-700 dark:text-blue-300" },
  purchase_invoice: { bg: "bg-purple-50 dark:bg-purple-500/10", text: "text-purple-700 dark:text-purple-300" },
  customer_payment: { bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300" },
};

function ActivityTable({ items }: { readonly items: RecentActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <Zap className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No activity yet</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Recent transactions will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Type
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Reference
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Party
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Date
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => {
            const colors = ACTIVITY_COLORS[item.type];
            return (
              <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      colors.bg,
                      colors.text
                    )}
                  >
                    {ACTIVITY_LABELS[item.type]}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                  {item.reference}
                </td>
                <td className="max-w-[180px] truncate px-4 py-3 text-slate-700 dark:text-slate-300">
                  {item.partyName}
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                  {new Date(item.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900 dark:text-slate-100">
                  {formatINR(item.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Quick Action
// ─────────────────────────────────────────────────────────────

interface QuickActionProps {
  readonly label: string;
  readonly description: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly href: string;
  readonly color: string;
}

function QuickAction({ label, description, icon: Icon, href, color }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-150 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/30"
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
        <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <ArrowUpRight
        className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-blue-500 dark:text-slate-600"
        aria-hidden="true"
      />
    </Link>
  );
}

const QUICK_ACTIONS: QuickActionProps[] = [
  {
    label: "New Sales Invoice",
    description: "Create and send an invoice",
    icon: FileText,
    href: "/sales/invoices/new",
    color: "bg-blue-600",
  },
  {
    label: "New Purchase Invoice",
    description: "Record a supplier bill",
    icon: ShoppingCart,
    href: "/purchases/invoices/new",
    color: "bg-purple-600",
  },
  {
    label: "Record Payment",
    description: "Log a received payment",
    icon: CreditCard,
    href: "/payments/new",
    color: "bg-emerald-600",
  },
  {
    label: "View Inventory",
    description: "Check stock levels",
    icon: Package,
    href: "/inventory",
    color: "bg-orange-600",
  },
];

// ─────────────────────────────────────────────────────────────
// Dashboard View
// ─────────────────────────────────────────────────────────────

interface DashboardViewProps {
  readonly organization: Organization;
  readonly kpis: DashboardKpis;
}

export function DashboardView({ organization, kpis }: DashboardViewProps) {
  const growthPct =
    ((kpis.salesThisMonth - kpis.salesLastMonth) /
      Math.max(kpis.salesLastMonth, 1)) *
    100;
  const growthPositive = growthPct > 0;
  const growthText =
    kpis.salesLastMonth === 0
      ? "No prior month data"
      : `${growthPositive ? "+" : ""}${growthPct.toFixed(1)}%`;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-8 flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
          <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {organization.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Welcome back — here&apos;s your business overview
          </p>
        </div>
      </motion.div>

      {/* KPI Grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          label="Sales This Month"
          value={formatINR(kpis.salesThisMonth)}
          sub={growthText}
          subPositive={kpis.salesLastMonth === 0 ? undefined : growthPositive}
          icon={TrendingUp}
          iconBg="bg-blue-50 dark:bg-blue-500/10"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          index={1}
          label="Outstanding Receivable"
          value={formatINR(kpis.outstandingReceivable)}
          sub={
            kpis.openInvoiceCount > 0
              ? `${kpis.openInvoiceCount} open invoice${kpis.openInvoiceCount === 1 ? "" : "s"}`
              : "All invoices paid"
          }
          icon={Receipt}
          iconBg="bg-amber-50 dark:bg-amber-500/10"
          iconColor="text-amber-600 dark:text-amber-400"
          badge={
            kpis.openInvoiceCount > 0
              ? String(kpis.openInvoiceCount)
              : undefined
          }
        />
        <KpiCard
          index={2}
          label="Outstanding Payable"
          value={formatINR(kpis.outstandingPayable)}
          sub={`${formatINR(kpis.purchasesThisMonth)} purchased this month`}
          icon={ShoppingCart}
          iconBg="bg-purple-50 dark:bg-purple-500/10"
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <KpiCard
          index={3}
          label="Low Stock Items"
          value={String(kpis.lowStockCount)}
          sub={
            kpis.outOfStockCount > 0
              ? `${kpis.outOfStockCount} out of stock`
              : "All critical items stocked"
          }
          subPositive={kpis.outOfStockCount === 0 ? true : false}
          icon={AlertCircle}
          iconBg="bg-red-50 dark:bg-red-500/10"
          iconColor="text-red-600 dark:text-red-400"
        />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Activity
            </h2>
            <Badge variant="secondary" className="text-xs">
              {kpis.recentActivity.length} items
            </Badge>
          </div>
          <ActivityTable items={kpis.recentActivity} />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.25 }}
          className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
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
