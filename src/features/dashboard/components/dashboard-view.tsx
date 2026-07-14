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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnimatedNumber } from "@/components/shared/animated-number";
import type { Organization } from "@/features/organization/types/organization.types";
import type {
  DashboardKpis,
  RecentActivityItem,
} from "@/features/dashboard/services/dashboard.service";
import type { DashboardAnalytics } from "@/features/dashboard/services/dashboard-analytics.service";
import {
  SalesTrendChart,
  AgingChart,
  InvoiceStatusChart,
  TopList,
} from "@/features/dashboard/components/dashboard-charts";
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
  readonly value: number;
  /** Currency formats with a ₹ prefix + thousands grouping; count is plain. */
  readonly kind?: "currency" | "count";
  readonly sub?: string;
  readonly subPositive?: boolean;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly gradient: string;
  readonly tint: string;
  readonly index: number;
  readonly badge?: string;
}

function KpiCard({
  label,
  value,
  kind = "currency",
  sub,
  subPositive,
  icon: Icon,
  gradient,
  tint,
  index,
  badge,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Card hover className="relative overflow-hidden p-4">
        {/* Faint gradient tint accent */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl",
            tint
          )}
        />
        <div className="relative flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              <AnimatedNumber
                value={value}
                prefix={kind === "currency" ? "₹" : ""}
              />
            </p>
          </div>
          <div className="relative">
            <div className={cn("rounded-xl p-2.5 shadow-sm", gradient)}>
              <Icon className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            {badge !== undefined && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-error px-1 text-[10px] font-semibold text-white shadow-sm">
                {badge}
              </span>
            )}
          </div>
        </div>
        {sub !== undefined && (
          <div className="relative mt-3 flex items-center gap-1.5">
            {subPositive === true ? (
              <TrendingUp
                className="h-3.5 w-3.5 text-emerald-500"
                aria-hidden="true"
              />
            ) : subPositive === false ? (
              <TrendingDown
                className="h-3.5 w-3.5 text-red-500"
                aria-hidden="true"
              />
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
              <span className="text-xs text-slate-400 dark:text-slate-500">
                vs last month
              </span>
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
  invoice: {
    bg: "bg-blue-50 dark:bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-300",
  },
  purchase_invoice: {
    bg: "bg-purple-50 dark:bg-purple-500/10",
    text: "text-purple-700 dark:text-purple-300",
  },
  customer_payment: {
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
  },
};

// Detail route for each activity kind — the reference links straight to it.
const ACTIVITY_HREF_BASE: Record<RecentActivityItem["type"], string> = {
  invoice: "/invoices",
  purchase_invoice: "/bills",
  customer_payment: "/payments",
};

function ActivityTable({
  items,
  orgId,
}: {
  readonly items: RecentActivityItem[];
  readonly orgId: string;
}) {
  const activityHref = (item: RecentActivityItem): string => {
    const base = `${ACTIVITY_HREF_BASE[item.type]}/${item.id}`;
    return orgId ? `${base}?org=${orgId}` : base;
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
          <Zap
            className="h-5 w-5 text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          />
        </div>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          No activity yet
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Recent transactions will appear here
        </p>
      </div>
    );
  }

  return (
    <Table wrapperClassName="rounded-none border-0 bg-transparent">
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Party</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const colors = ACTIVITY_COLORS[item.type];
          return (
            <TableRow key={`${item.type}-${item.id}`}>
              <TableCell>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    colors.bg,
                    colors.text
                  )}
                >
                  {ACTIVITY_LABELS[item.type]}
                </span>
              </TableCell>
              <TableCell>
                <Link
                  href={activityHref(item)}
                  className="font-mono text-xs text-primary-600 hover:underline dark:text-primary-400"
                >
                  {item.reference}
                </Link>
              </TableCell>
              <TableCell className="max-w-[180px] truncate text-slate-700 dark:text-slate-300">
                {item.partyName}
              </TableCell>
              <TableCell className="text-slate-500 dark:text-slate-400">
                {new Date(item.date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </TableCell>
              <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                {formatINR(item.amount)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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

function QuickAction({
  label,
  description,
  icon: Icon,
  href,
  color,
}: QuickActionProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/30"
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm",
          color
        )}
      >
        <Icon className="h-5 w-5 text-white" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
          {label}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      <ArrowUpRight
        className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-slate-600"
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
    href: "/invoices/new",
    color: "bg-gradient-info",
  },
  {
    label: "New Purchase Invoice",
    description: "Record a supplier bill",
    icon: ShoppingCart,
    href: "/bills/new",
    color: "bg-gradient-violet",
  },
  {
    label: "View Payments",
    description: "See customer and supplier payments",
    icon: CreditCard,
    href: "/payments",
    color: "bg-gradient-success",
  },
  {
    label: "View Inventory",
    description: "Check stock levels",
    icon: Package,
    href: "/inventory",
    color: "bg-gradient-warning",
  },
];

// ─────────────────────────────────────────────────────────────
// Panel (chart section wrapper)
// ─────────────────────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  delay = 0,
  className,
  children,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly delay?: number;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay }}
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900",
        className
      )}
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Dashboard View
// ─────────────────────────────────────────────────────────────

interface DashboardViewProps {
  readonly organization: Organization;
  readonly kpis: DashboardKpis;
  readonly analytics: DashboardAnalytics;
}

export function DashboardView({
  organization,
  kpis,
  analytics,
}: DashboardViewProps) {
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
    <div className="p-4 lg:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mb-6 flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
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
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          label="Sales This Month"
          value={kpis.salesThisMonth}
          sub={growthText}
          subPositive={kpis.salesLastMonth === 0 ? undefined : growthPositive}
          icon={TrendingUp}
          gradient="bg-gradient-info"
          tint="bg-sky-400"
        />
        <KpiCard
          index={1}
          label="Outstanding Receivable"
          value={kpis.outstandingReceivable}
          sub={
            kpis.openInvoiceCount > 0
              ? `${kpis.openInvoiceCount} open invoice${kpis.openInvoiceCount === 1 ? "" : "s"}`
              : "All invoices paid"
          }
          icon={Receipt}
          gradient="bg-gradient-warning"
          tint="bg-amber-400"
          badge={
            kpis.openInvoiceCount > 0
              ? String(kpis.openInvoiceCount)
              : undefined
          }
        />
        <KpiCard
          index={2}
          label="Outstanding Payable"
          value={kpis.outstandingPayable}
          sub={`${formatINR(kpis.purchasesThisMonth)} purchased this month`}
          icon={ShoppingCart}
          gradient="bg-gradient-violet"
          tint="bg-violet-400"
        />
        <KpiCard
          index={3}
          label="Low Stock Items"
          value={kpis.lowStockCount}
          kind="count"
          sub={
            kpis.outOfStockCount > 0
              ? `${kpis.outOfStockCount} out of stock`
              : "All critical items stocked"
          }
          subPositive={kpis.outOfStockCount === 0 ? true : false}
          icon={AlertCircle}
          gradient="bg-gradient-error"
          tint="bg-rose-400"
        />
      </div>

      {/* Trend + invoice status */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Sales & purchases"
          subtitle="Last 6 months"
          delay={0.15}
          className="lg:col-span-2"
        >
          <SalesTrendChart data={analytics.trend} />
          <div className="mt-2 flex items-center justify-center gap-5 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#3b82f6]" /> Sales
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#8b5cf6]" /> Purchases
            </span>
          </div>
        </Panel>
        <Panel title="Invoice status" subtitle="Posted invoices" delay={0.2}>
          <InvoiceStatusChart data={analytics.invoiceStatus} />
        </Panel>
      </div>

      {/* Aging + top customers + top products */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Receivables vs payables" subtitle="By age" delay={0.2}>
          <AgingChart data={analytics.aging} />
          <div className="mt-2 flex items-center justify-center gap-5 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#16a34a]" /> Receivable
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Payable
            </span>
          </div>
        </Panel>
        <Panel title="Top customers" subtitle="By revenue" delay={0.25}>
          <TopList
            data={analytics.topCustomers}
            emptyLabel="No sales yet"
            accent="from-blue-500 to-indigo-500"
          />
        </Panel>
        <Panel title="Top products" subtitle="By sales value" delay={0.3}>
          <TopList
            data={analytics.topProducts}
            emptyLabel="No sales yet"
            accent="from-violet-500 to-fuchsia-500"
          />
        </Panel>
      </div>

      {/* Bottom row */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.2 }}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900 lg:col-span-2"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Activity
            </h2>
            <Badge variant="info" className="text-xs">
              {kpis.recentActivity.length} items
            </Badge>
          </div>
          <ActivityTable items={kpis.recentActivity} orgId={organization.id} />
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.25 }}
          className="rounded-xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-1">
            {QUICK_ACTIONS.map((action) => (
              <QuickAction key={action.label} {...action} />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
