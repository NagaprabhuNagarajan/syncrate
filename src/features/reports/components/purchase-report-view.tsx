'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Download,
  Wallet,
  CheckCircle2,
  Clock,
  FileText,
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
import { getPurchaseReport } from '../services/purchase-report.service';
import { ReportDateFilter } from './report-date-filter';
import { objectsToCsv } from '@/utils/csv';
import { formatCurrency } from '@/utils/format';
import type { PurchaseReport, DateRangeFilter } from '../types/report.types';

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
    <div className="space-y-2 p-5">
      {SKELETON_KEYS.map((key) => (
        <Skeleton key={key} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function PurchaseReportView({
  initialData,
  orgId,
}: PurchaseReportViewProps) {
  const searchParams = useSearchParams();
  const org = searchParams.get('org');
  const reportsHref = org ? `/reports?org=${org}` : '/reports';

  const [dateRange, setDateRange] = useState<DateRangeFilter>(
    initialData.dateRange
  );
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
      [
        'supplierCode',
        'supplierName',
        'invoiceCount',
        'totalAmount',
        'amountPaid',
        'outstanding',
      ],
      data.bySupplier as unknown as Record<string, unknown>[]
    );
    downloadCsv('purchase-by-supplier.csv', csv);
  }

  const billCount = data.summary.reduce((sum, row) => sum + row.invoiceCount, 0);

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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-violet shadow-glow-primary">
            <ShoppingCart className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Purchase Report
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Purchase totals and supplier breakdown
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
          label="Total purchased"
          value={data.totals.totalAmount}
          tint="bg-gradient-brand"
          index={0}
          currency
        />
        <StatTile
          icon={CheckCircle2}
          label="Amount paid"
          value={data.totals.amountPaid}
          tint="bg-gradient-success"
          index={1}
          currency
        />
        <StatTile
          icon={Clock}
          label="Outstanding"
          value={data.totals.outstanding}
          tint="bg-gradient-warning"
          index={2}
          currency
        />
        <StatTile
          icon={FileText}
          label="Bills"
          value={billCount}
          tint="bg-gradient-info"
          index={3}
        />
      </div>

      {/* Monthly summary */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className="mt-5"
      >
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Monthly summary
            </h2>
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
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : data.summary.length === 0 ? (
            <p className="px-5 pb-8 pt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              No purchase data found for the selected period.
            </p>
          ) : (
            <Table
              aria-label="Monthly purchase summary"
              className="[&_td]:px-5 [&_th]:px-5"
              wrapperClassName="rounded-none border-0 border-t border-slate-100 bg-transparent dark:border-slate-800"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.summary.map((row) => (
                  <TableRow key={row.period}>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                      {row.period}
                    </TableCell>
                    <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                      {row.invoiceCount}
                    </TableCell>
                    <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(row.totalAmount, true)}
                    </TableCell>
                    <TableCell className="nums text-right text-success-600 dark:text-success-400">
                      {formatCurrency(row.amountPaid, true)}
                    </TableCell>
                    <TableCell className="nums text-right text-warning-600 dark:text-warning-400">
                      {formatCurrency(row.outstanding, true)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-slate-200 font-semibold hover:bg-transparent dark:border-slate-700 dark:hover:bg-transparent">
                  <TableCell className="text-slate-900 dark:text-slate-100">
                    Total
                  </TableCell>
                  <TableCell />
                  <TableCell className="nums text-right text-slate-900 dark:text-slate-100">
                    {formatCurrency(data.totals.totalAmount, true)}
                  </TableCell>
                  <TableCell className="nums text-right text-success-600 dark:text-success-400">
                    {formatCurrency(data.totals.amountPaid, true)}
                  </TableCell>
                  <TableCell className="nums text-right text-warning-600 dark:text-warning-400">
                    {formatCurrency(data.totals.outstanding, true)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </Card>
      </motion.div>

      {/* By supplier */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.15 }}
        className="mt-4"
      >
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              By supplier
            </h2>
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
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : data.bySupplier.length === 0 ? (
            <p className="px-5 pb-8 pt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              No supplier data found.
            </p>
          ) : (
            <Table
              aria-label="Purchases by supplier"
              className="[&_td]:px-5 [&_th]:px-5"
              wrapperClassName="rounded-none border-0 border-t border-slate-100 bg-transparent dark:border-slate-800"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Invoices</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bySupplier.map((row) => (
                  <TableRow key={row.supplierId}>
                    <TableCell className="nums font-mono text-xs text-slate-500 dark:text-slate-400">
                      {row.supplierCode}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                      {row.supplierName}
                    </TableCell>
                    <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                      {row.invoiceCount}
                    </TableCell>
                    <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(row.totalAmount, true)}
                    </TableCell>
                    <TableCell className="nums text-right text-success-600 dark:text-success-400">
                      {formatCurrency(row.amountPaid, true)}
                    </TableCell>
                    <TableCell className="nums text-right text-warning-600 dark:text-warning-400">
                      {formatCurrency(row.outstanding, true)}
                    </TableCell>
                  </TableRow>
                ))}
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
