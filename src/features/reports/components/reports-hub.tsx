'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  BarChart2,
  BarChart3,
  ShoppingCart,
  Package,
  Receipt,
  AlertCircle,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/utils/cn';

// ─────────────────────────────────────────────────────────────
// Live headline figures, computed server-side and passed in.
// ─────────────────────────────────────────────────────────────

export interface ReportStat {
  /** Big headline value, e.g. "₹1.18L" or "42". */
  readonly primary: string;
  /** Context line, e.g. "12 invoices · this month". */
  readonly secondary: string;
  /** Draws attention to the figure (e.g. stock alerts) when true. */
  readonly alert?: boolean;
}

export interface ReportsHubStats {
  readonly sales: ReportStat | null;
  readonly purchases: ReportStat | null;
  readonly inventory: ReportStat | null;
  readonly gst: ReportStat | null;
  readonly outstanding: ReportStat | null;
}

type ReportKey = keyof ReportsHubStats;

interface ReportRow {
  readonly key: ReportKey;
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly href: string;
  readonly tint: string;
}

interface ReportGroup {
  readonly label: string;
  readonly reports: readonly ReportRow[];
}

const GROUPS: readonly ReportGroup[] = [
  {
    label: 'Financial',
    reports: [
      {
        key: 'sales',
        title: 'Sales Report',
        description:
          'Daily, monthly, and yearly sales totals with customer breakdown',
        icon: BarChart3,
        href: '/reports/sales',
        tint: 'bg-gradient-info',
      },
      {
        key: 'purchases',
        title: 'Purchase Report',
        description: 'Purchase summary and supplier-wise breakdown',
        icon: ShoppingCart,
        href: '/reports/purchases',
        tint: 'bg-gradient-violet',
      },
      {
        key: 'gst',
        title: 'GST Summary',
        description: 'CGST, SGST, and IGST breakdowns for tax compliance',
        icon: Receipt,
        href: '/reports/gst',
        tint: 'bg-gradient-warning',
      },
      {
        key: 'outstanding',
        title: 'Outstanding Report',
        description:
          'Customer receivables and supplier payables with aging analysis',
        icon: AlertCircle,
        href: '/reports/outstanding',
        tint: 'bg-gradient-error',
      },
    ],
  },
  {
    label: 'Operations',
    reports: [
      {
        key: 'inventory',
        title: 'Inventory Report',
        description:
          'Current stock levels, low stock alerts, and out-of-stock items',
        icon: Package,
        href: '/reports/inventory',
        tint: 'bg-gradient-success',
      },
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
};

interface ReportsHubProps {
  readonly stats?: ReportsHubStats;
}

export function ReportsHub({ stats }: ReportsHubProps) {
  const searchParams = useSearchParams();
  const org = searchParams.get('org');
  const withOrg = (path: string): string => (org ? `${path}?org=${org}` : path);

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
          <BarChart2 className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Reports
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View and export business reports for insights and compliance
          </p>
        </div>
      </motion.div>

      {/* Grouped report directory */}
      <div className="mt-6 max-w-4xl space-y-6">
        {GROUPS.map((group) => (
          <section key={group.label}>
            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.label}
            </h2>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Card className="divide-y divide-slate-100 overflow-hidden p-0 dark:divide-slate-800">
                {group.reports.map((report) => {
                  const Icon = report.icon;
                  const stat = stats?.[report.key] ?? null;
                  return (
                    <motion.div key={report.key} variants={rowVariants}>
                      <Link
                        href={withOrg(report.href)}
                        className="group flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <div
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-glow-primary',
                            report.tint
                          )}
                        >
                          <Icon
                            className="h-4 w-4 text-white"
                            aria-hidden="true"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {report.title}
                          </h3>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {report.description}
                          </p>
                        </div>

                        <div className="hidden shrink-0 text-right sm:block">
                          <div
                            className={cn(
                              'nums text-base font-semibold tracking-tight',
                              stat?.alert
                                ? 'text-warning-600 dark:text-warning-400'
                                : 'text-slate-900 dark:text-slate-100'
                            )}
                          >
                            {stat ? stat.primary : '—'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {stat ? stat.secondary : 'View report'}
                          </div>
                        </div>

                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400"
                          aria-hidden="true"
                        />

                        <span className="sr-only">View report</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </Card>
            </motion.div>
          </section>
        ))}
      </div>
    </div>
  );
}
