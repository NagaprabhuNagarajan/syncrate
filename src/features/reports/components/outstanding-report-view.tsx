'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  Truck,
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
import { getOutstandingReport } from '../services/outstanding-report.service';
import { objectsToCsv } from '@/utils/csv';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { OutstandingReport } from '../types/report.types';

type TabId = 'customers' | 'suppliers';

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface OutstandingReportViewProps {
  readonly initialData: OutstandingReport;
  readonly orgId: string;
}

const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'] as const;

function TableSkeleton() {
  return (
    <div className="space-y-2 p-5">
      {SKELETON_KEYS.map((key) => (
        <Skeleton key={key} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function OutstandingReportView({
  initialData,
  orgId,
}: OutstandingReportViewProps) {
  const searchParams = useSearchParams();
  const org = searchParams.get('org');
  const reportsHref = org ? `/reports?org=${org}` : '/reports';

  const [data, setData] = useState<OutstandingReport>(initialData);
  const [activeTab, setActiveTab] = useState<TabId>('customers');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const report = await getOutstandingReport(supabase, orgId);
      setData(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  function handleExportCustomers() {
    const csv = objectsToCsv(
      ['customerCode', 'customerName', 'outstanding', 'overdue'],
      data.customers as unknown as Record<string, unknown>[]
    );
    downloadCsv('customer-receivables.csv', csv);
  }

  function handleExportSuppliers() {
    const csv = objectsToCsv(
      ['supplierCode', 'supplierName', 'outstanding'],
      data.suppliers as unknown as Record<string, unknown>[]
    );
    downloadCsv('supplier-payables.csv', csv);
  }

  const tabs = [
    {
      id: 'customers' as TabId,
      label: `Customer Receivables (${data.customers.length})`,
    },
    {
      id: 'suppliers' as TabId,
      label: `Supplier Payables (${data.suppliers.length})`,
    },
  ];

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
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-error shadow-glow-primary">
            <AlertCircle className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Outstanding Report
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Customer receivables and supplier payables
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchReport()}
          disabled={isLoading}
        >
          <RefreshCw
            className={cn('mr-1.5 h-3.5 w-3.5', isLoading && 'animate-spin')}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </motion.div>

      {error !== null && <ErrorBanner message={error} className="mt-5" />}

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={TrendingUp}
          label="Total Receivable"
          value={data.totalReceivable}
          tint="bg-gradient-success"
          index={0}
          currency
        />
        <StatTile
          icon={TrendingDown}
          label="Total Payable"
          value={data.totalPayable}
          tint="bg-gradient-error"
          index={1}
          currency
        />
        <StatTile
          icon={Users}
          label="Customers"
          value={data.customers.length}
          tint="bg-gradient-info"
          index={2}
        />
        <StatTile
          icon={Truck}
          label="Suppliers"
          value={data.suppliers.length}
          tint="bg-gradient-violet"
          index={3}
        />
      </div>

      {/* Tabs */}
      <div
        className="mt-5 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900"
        role="tablist"
        aria-label="Outstanding report tabs"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Customer receivables */}
      {activeTab === 'customers' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4"
        >
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Customer Receivables
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCustomers}
                disabled={isLoading || data.customers.length === 0}
                aria-label="Export customer receivables CSV"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Export
              </Button>
            </div>

            {isLoading ? (
              <TableSkeleton />
            ) : data.customers.length === 0 ? (
              <p className="px-5 pb-8 pt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                No outstanding receivables.
              </p>
            ) : (
              <Table
                aria-label="Customer receivables"
                className="[&_td]:px-5 [&_th]:px-5"
                wrapperClassName="rounded-none border-0 border-t border-slate-100 bg-transparent dark:border-slate-800"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.map((row) => (
                    <TableRow key={row.customerId}>
                      <TableCell className="nums font-mono text-xs text-slate-500 dark:text-slate-400">
                        {row.customerCode}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                        {row.customerName}
                      </TableCell>
                      <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(row.outstanding, true)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'nums text-right font-medium',
                          row.overdue > 0
                            ? 'text-error-600 dark:text-error-400'
                            : 'text-slate-400 dark:text-slate-500'
                        )}
                      >
                        {row.overdue > 0 ? formatCurrency(row.overdue, true) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </motion.div>
      )}

      {/* Supplier payables */}
      {activeTab === 'suppliers' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4"
        >
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Supplier Payables
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSuppliers}
                disabled={isLoading || data.suppliers.length === 0}
                aria-label="Export supplier payables CSV"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Export
              </Button>
            </div>

            {isLoading ? (
              <TableSkeleton />
            ) : data.suppliers.length === 0 ? (
              <p className="px-5 pb-8 pt-2 text-center text-sm text-slate-500 dark:text-slate-400">
                No outstanding payables.
              </p>
            ) : (
              <Table
                aria-label="Supplier payables"
                className="[&_td]:px-5 [&_th]:px-5"
                wrapperClassName="rounded-none border-0 border-t border-slate-100 bg-transparent dark:border-slate-800"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.suppliers.map((row) => (
                    <TableRow key={row.supplierId}>
                      <TableCell className="nums font-mono text-xs text-slate-500 dark:text-slate-400">
                        {row.supplierCode}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                        {row.supplierName}
                      </TableCell>
                      <TableCell className="nums text-right font-medium text-error-600 dark:text-error-400">
                        {formatCurrency(row.outstanding, true)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
}
