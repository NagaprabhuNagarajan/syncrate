'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { getSalesReport } from '../services/sales-report.service';
import { ReportDateFilter } from './report-date-filter';
import { objectsToCsv } from '@/utils/csv';
import type { SalesReport, DateRangeFilter } from '../types/report.types';

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

interface SalesReportViewProps {
  readonly initialData: SalesReport;
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

export function SalesReportView({ initialData, orgId }: SalesReportViewProps) {
  const [dateRange, setDateRange] = useState<DateRangeFilter>(initialData.dateRange);
  const [data, setData] = useState<SalesReport>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (range: DateRangeFilter) => {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const report = await getSalesReport(supabase, orgId, range);
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

  function handleExportSummary() {
    const csv = objectsToCsv(
      ['period', 'invoiceCount', 'subtotal', 'taxAmount', 'totalAmount', 'amountPaid', 'outstanding'],
      data.summary as unknown as Record<string, unknown>[]
    );
    downloadCsv('sales-summary.csv', csv);
  }

  function handleExportByCustomer() {
    const csv = objectsToCsv(
      ['customerCode', 'customerName', 'invoiceCount', 'totalAmount', 'amountPaid', 'outstanding'],
      data.byCustomer as unknown as Record<string, unknown>[]
    );
    downloadCsv('sales-by-customer.csv', csv);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Sales Report</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Sales totals and customer breakdown</p>
        </div>
        <ReportDateFilter value={dateRange} onChange={handleDateChange} />
      </div>

      {error !== null && (
        <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Summary Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Monthly Summary</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSummary}
            disabled={isLoading || data.summary.length === 0}
            aria-label="Export summary CSV"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : data.summary.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">
              No sales data found for the selected period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Monthly sales summary">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-gray-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-4">Month</th>
                    <th className="pb-2 pr-4 text-right">Invoices</th>
                    <th className="pb-2 pr-4 text-right">Subtotal</th>
                    <th className="pb-2 pr-4 text-right">Tax</th>
                    <th className="pb-2 pr-4 text-right">Total</th>
                    <th className="pb-2 pr-4 text-right">Paid</th>
                    <th className="pb-2 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {data.summary.map((row) => (
                    <tr key={row.period} className="transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 pr-4 font-medium">{row.period}</td>
                      <td className="nums py-2.5 pr-4 text-right">{row.invoiceCount}</td>
                      <td className="nums py-2.5 pr-4 text-right">{fmt(row.subtotal)}</td>
                      <td className="nums py-2.5 pr-4 text-right">{fmt(row.taxAmount)}</td>
                      <td className="nums py-2.5 pr-4 text-right font-medium">{fmt(row.totalAmount)}</td>
                      <td className="nums py-2.5 pr-4 text-right text-green-700 dark:text-green-400">{fmt(row.amountPaid)}</td>
                      <td className="nums py-2.5 text-right text-orange-700 dark:text-orange-400">{fmt(row.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 dark:border-slate-700">
                  <tr className="font-semibold">
                    <td className="pt-2.5 pr-4">Total</td>
                    <td className="pt-2.5 pr-4" />
                    <td className="nums pt-2.5 pr-4 text-right">{fmt(data.totals.subtotal)}</td>
                    <td className="nums pt-2.5 pr-4 text-right">{fmt(data.totals.taxAmount)}</td>
                    <td className="nums pt-2.5 pr-4 text-right">{fmt(data.totals.totalAmount)}</td>
                    <td className="nums pt-2.5 pr-4 text-right text-green-700 dark:text-green-400">{fmt(data.totals.amountPaid)}</td>
                    <td className="nums pt-2.5 text-right text-orange-700 dark:text-orange-400">{fmt(data.totals.outstanding)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* By Customer Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">By Customer</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportByCustomer}
            disabled={isLoading || data.byCustomer.length === 0}
            aria-label="Export by-customer CSV"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : data.byCustomer.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">No customer data found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Sales by customer">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-gray-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-4">Code</th>
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4 text-right">Invoices</th>
                    <th className="pb-2 pr-4 text-right">Total</th>
                    <th className="pb-2 pr-4 text-right">Paid</th>
                    <th className="pb-2 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {data.byCustomer.map((row) => (
                    <tr key={row.customerId} className="transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="nums py-2.5 pr-4 font-mono text-xs text-gray-500 dark:text-slate-400">
                        {row.customerCode}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{row.customerName}</td>
                      <td className="nums py-2.5 pr-4 text-right">{row.invoiceCount}</td>
                      <td className="nums py-2.5 pr-4 text-right font-medium">{fmt(row.totalAmount)}</td>
                      <td className="nums py-2.5 pr-4 text-right text-green-700 dark:text-green-400">{fmt(row.amountPaid)}</td>
                      <td className="nums py-2.5 text-right text-orange-700 dark:text-orange-400">{fmt(row.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
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
