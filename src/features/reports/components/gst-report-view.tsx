'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/shared/animated-number';
import { createClient } from '@/lib/supabase/client';
import { getGstReport } from '../services/gst-report.service';
import { ReportDateFilter } from './report-date-filter';
import { objectsToCsv } from '@/utils/csv';
import type { GstReport, DateRangeFilter } from '../types/report.types';

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
}

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
    <div className="space-y-2">
      {SKELETON_KEYS.map((key) => (
        <Skeleton key={key} className="h-10 w-full" />
      ))}
    </div>
  );
}

const fadeIn = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

export function GstReportView({ initialData, orgId }: GstReportViewProps) {
  const [dateRange, setDateRange] = useState<DateRangeFilter>(initialData.dateRange);
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
      ['month', 'taxableAmount', 'cgstAmount', 'sgstAmount', 'igstAmount', 'totalTax'],
      data.lines as unknown as Record<string, unknown>[]
    );
    downloadCsv('gst-report.csv', csv);
  }

  return (
    <motion.div
      className="space-y-4 p-4 lg:p-6"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">GST Summary</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">CGST, SGST, and IGST breakdown for tax compliance</p>
        </div>
        <ReportDateFilter value={dateRange} onChange={handleDateChange} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Taxable Amount', value: data.totals.taxableAmount },
          { label: 'Total CGST', value: data.totals.cgstAmount },
          { label: 'Total SGST', value: data.totals.sgstAmount },
          { label: 'Total IGST', value: data.totals.igstAmount },
        ].map((card) => (
          <Card key={card.label} hover>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 dark:text-slate-400">{card.label}</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-slate-100">
                <AnimatedNumber value={card.value} prefix="₹" decimals={2} />
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error !== null && (
        <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Monthly GST Breakdown</CardTitle>
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : data.lines.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">
              No GST data found for the selected period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Monthly GST breakdown">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-gray-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-4">Month</th>
                    <th className="pb-2 pr-4 text-right">Taxable Amount</th>
                    <th className="pb-2 pr-4 text-right">CGST</th>
                    <th className="pb-2 pr-4 text-right">SGST</th>
                    <th className="pb-2 pr-4 text-right">IGST</th>
                    <th className="pb-2 text-right">Total Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {data.lines.map((row) => (
                    <tr key={row.month} className="transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 pr-4 font-medium">{row.month}</td>
                      <td className="nums py-2.5 pr-4 text-right">{fmt(row.taxableAmount)}</td>
                      <td className="nums py-2.5 pr-4 text-right">{fmt(row.cgstAmount)}</td>
                      <td className="nums py-2.5 pr-4 text-right">{fmt(row.sgstAmount)}</td>
                      <td className="nums py-2.5 pr-4 text-right">{fmt(row.igstAmount)}</td>
                      <td className="nums py-2.5 text-right font-medium">{fmt(row.totalTax)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 dark:border-slate-700">
                  <tr className="font-semibold">
                    <td className="pt-2.5 pr-4">Total</td>
                    <td className="nums pt-2.5 pr-4 text-right">{fmt(data.totals.taxableAmount)}</td>
                    <td className="nums pt-2.5 pr-4 text-right">{fmt(data.totals.cgstAmount)}</td>
                    <td className="nums pt-2.5 pr-4 text-right">{fmt(data.totals.sgstAmount)}</td>
                    <td className="nums pt-2.5 pr-4 text-right">{fmt(data.totals.igstAmount)}</td>
                    <td className="nums pt-2.5 text-right">{fmt(data.totals.totalTax)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-slate-400" aria-live="polite">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading report…
        </div>
      )}
    </motion.div>
  );
}
