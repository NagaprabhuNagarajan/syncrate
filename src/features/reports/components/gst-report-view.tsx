'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Receipt,
  Download,
  Wallet,
  Percent,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatTile } from '@/components/shared/stat-tile';
import { ErrorBanner } from '@/components/shared/error-banner';
import { createClient } from '@/lib/supabase/client';
import { getGstReport } from '../services/gst-report.service';
import { ReportDateFilter } from './report-date-filter';
import { objectsToCsv } from '@/utils/csv';
import { formatCurrency } from '@/utils/format';
import type { GstReport, DateRangeFilter } from '../types/report.types';

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface GstReportViewProps {
  readonly initialData: GstReport;
  readonly orgId: string;
}

const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4'] as const;

function TableSkeleton() {
  return (
    <div className="space-y-2 p-5">
      {SKELETON_KEYS.map((key) => (
        <Skeleton key={key} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function GstReportView({ initialData, orgId }: GstReportViewProps) {
  const searchParams = useSearchParams();
  const org = searchParams.get('org');
  const reportsHref = org ? `/reports?org=${org}` : '/reports';

  const [dateRange, setDateRange] = useState<DateRangeFilter>(
    initialData.dateRange
  );
  const [data, setData] = useState<GstReport>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (range: DateRangeFilter) => {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const report = await getGstReport(supabase, orgId, range);
        setData(report);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report');
      } finally {
        setIsLoading(false);
      }
    },
    [orgId]
  );

  function handleDateChange(range: DateRangeFilter) {
    setDateRange(range);
    void fetchReport(range);
  }

  function handleExport() {
    const csv = objectsToCsv(
      [
        'month',
        'taxableAmount',
        'cgstAmount',
        'sgstAmount',
        'igstAmount',
        'totalTax',
      ],
      data.lines as unknown as Record<string, unknown>[]
    );
    downloadCsv('gst-report.csv', csv);
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Back to reports */}
      <Link
        href={reportsHref}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Reports
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-warning shadow-glow-primary">
            <Receipt className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              GST Summary
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              CGST, SGST, and IGST breakdown for tax compliance
            </p>
          </div>
        </div>

        <ReportDateFilter value={dateRange} onChange={handleDateChange} />
      </motion.div>

      {error !== null && <ErrorBanner message={error} className="mt-5" />}

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Wallet}
          label="Taxable Amount"
          value={data.totals.taxableAmount}
          tint="bg-gradient-brand"
          index={0}
          currency
        />
        <StatTile
          icon={Percent}
          label="Total CGST"
          value={data.totals.cgstAmount}
          tint="bg-gradient-info"
          index={1}
          currency
        />
        <StatTile
          icon={Percent}
          label="Total SGST"
          value={data.totals.sgstAmount}
          tint="bg-gradient-violet"
          index={2}
          currency
        />
        <StatTile
          icon={Percent}
          label="Total IGST"
          value={data.totals.igstAmount}
          tint="bg-gradient-warning"
          index={3}
          currency
        />
      </div>

      {/* Monthly GST breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className="mt-5"
      >
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Monthly GST breakdown
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isLoading || data.lines.length === 0}
              aria-label="Export GST CSV"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Export
            </Button>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : data.lines.length === 0 ? (
            <p className="px-5 pb-8 pt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              No GST data found for the selected period.
            </p>
          ) : (
            <Table
              aria-label="Monthly GST breakdown"
              className="[&_td]:px-5 [&_th]:px-5"
              wrapperClassName="rounded-none border-0 border-t border-slate-100 bg-transparent dark:border-slate-800"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Taxable Amount</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead className="text-right">Total Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.lines.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                      {row.month}
                    </TableCell>
                    <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(row.taxableAmount, true)}
                    </TableCell>
                    <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(row.cgstAmount, true)}
                    </TableCell>
                    <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(row.sgstAmount, true)}
                    </TableCell>
                    <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(row.igstAmount, true)}
                    </TableCell>
                    <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(row.totalTax, true)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-slate-200 font-semibold hover:bg-transparent dark:border-slate-700 dark:hover:bg-transparent">
                  <TableCell className="text-slate-900 dark:text-slate-100">
                    Total
                  </TableCell>
                  <TableCell className="nums text-right text-slate-900 dark:text-slate-100">
                    {formatCurrency(data.totals.taxableAmount, true)}
                  </TableCell>
                  <TableCell className="nums text-right text-slate-900 dark:text-slate-100">
                    {formatCurrency(data.totals.cgstAmount, true)}
                  </TableCell>
                  <TableCell className="nums text-right text-slate-900 dark:text-slate-100">
                    {formatCurrency(data.totals.sgstAmount, true)}
                  </TableCell>
                  <TableCell className="nums text-right text-slate-900 dark:text-slate-100">
                    {formatCurrency(data.totals.igstAmount, true)}
                  </TableCell>
                  <TableCell className="nums text-right text-slate-900 dark:text-slate-100">
                    {formatCurrency(data.totals.totalTax, true)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </Card>
      </motion.div>

      {isLoading && (
        <div
          className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400"
          aria-live="polite"
        >
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading report…
        </div>
      )}
    </div>
  );
}
