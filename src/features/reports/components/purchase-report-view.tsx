'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { getPurchaseReport } from '../services/purchase-report.service';
import { ReportDateFilter } from './report-date-filter';
import { objectsToCsv } from '@/utils/csv';
import type { PurchaseReport, DateRangeFilter } from '../types/report.types';

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

interface PurchaseReportViewProps {
  readonly initialData: PurchaseReport;
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

export function PurchaseReportView({ initialData, orgId }: PurchaseReportViewProps) {
  const [dateRange, setDateRange] = useState<DateRangeFilter>(initialData.dateRange);
  const [data, setData] = useState<PurchaseReport>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (range: DateRangeFilter) => {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const report = await getPurchaseReport(supabase, orgId, range);
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
      ['period', 'invoiceCount', 'totalAmount', 'amountPaid', 'outstanding'],
      data.summary as unknown as Record<string, unknown>[]
    );
    downloadCsv('purchase-summary.csv', csv);
  }

  function handleExportBySupplier() {
    const csv = objectsToCsv(
      ['supplierCode', 'supplierName', 'invoiceCount', 'totalAmount', 'amountPaid', 'outstanding'],
      data.bySupplier as unknown as Record<string, unknown>[]
    );
    downloadCsv('purchase-by-supplier.csv', csv);
  }

  return (
    <motion.div
      className="space-y-6 p-6"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Report</h1>
          <p className="mt-1 text-sm text-gray-500">Purchase totals and supplier breakdown</p>
        </div>
        <ReportDateFilter value={dateRange} onChange={handleDateChange} />
      </div>

      {error !== null && (
        <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">
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
            <p className="py-8 text-center text-sm text-gray-500">
              No purchase data found for the selected period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Monthly purchase summary">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-gray-500">
                    <th className="pb-2 pr-4">Month</th>
                    <th className="pb-2 pr-4 text-right">Invoices</th>
                    <th className="pb-2 pr-4 text-right">Total</th>
                    <th className="pb-2 pr-4 text-right">Paid</th>
                    <th className="pb-2 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.summary.map((row) => (
                    <tr key={row.period} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-medium">{row.period}</td>
                      <td className="py-2.5 pr-4 text-right">{row.invoiceCount}</td>
                      <td className="py-2.5 pr-4 text-right font-medium">{fmt(row.totalAmount)}</td>
                      <td className="py-2.5 pr-4 text-right text-green-700">{fmt(row.amountPaid)}</td>
                      <td className="py-2.5 text-right text-orange-700">{fmt(row.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2">
                  <tr className="font-semibold">
                    <td className="pt-2.5 pr-4">Total</td>
                    <td className="pt-2.5 pr-4" />
                    <td className="pt-2.5 pr-4 text-right">{fmt(data.totals.totalAmount)}</td>
                    <td className="pt-2.5 pr-4 text-right text-green-700">{fmt(data.totals.amountPaid)}</td>
                    <td className="pt-2.5 text-right text-orange-700">{fmt(data.totals.outstanding)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* By Supplier Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">By Supplier</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportBySupplier}
            disabled={isLoading || data.bySupplier.length === 0}
            aria-label="Export by-supplier CSV"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : data.bySupplier.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No supplier data found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Purchases by supplier">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-gray-500">
                    <th className="pb-2 pr-4">Code</th>
                    <th className="pb-2 pr-4">Supplier</th>
                    <th className="pb-2 pr-4 text-right">Invoices</th>
                    <th className="pb-2 pr-4 text-right">Total</th>
                    <th className="pb-2 pr-4 text-right">Paid</th>
                    <th className="pb-2 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.bySupplier.map((row) => (
                    <tr key={row.supplierId} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-4 font-mono text-xs text-gray-500">
                        {row.supplierCode}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{row.supplierName}</td>
                      <td className="py-2.5 pr-4 text-right">{row.invoiceCount}</td>
                      <td className="py-2.5 pr-4 text-right font-medium">{fmt(row.totalAmount)}</td>
                      <td className="py-2.5 pr-4 text-right text-green-700">{fmt(row.amountPaid)}</td>
                      <td className="py-2.5 text-right text-orange-700">{fmt(row.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500" aria-live="polite">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading report…
        </div>
      )}
    </motion.div>
  );
}
