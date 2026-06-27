'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { getOutstandingReport } from '../services/outstanding-report.service';
import { objectsToCsv } from '@/utils/csv';
import type { OutstandingReport } from '../types/report.types';

type TabId = 'customers' | 'suppliers';

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

interface OutstandingReportViewProps {
  readonly initialData: OutstandingReport;
  readonly orgId: string;
}

const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'] as const;

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

export function OutstandingReportView({ initialData, orgId }: OutstandingReportViewProps) {
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
          <h1 className="text-2xl font-bold text-gray-900">Outstanding Report</h1>
          <p className="mt-1 text-sm text-gray-500">Customer receivables and supplier payables</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchReport()} disabled={isLoading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-green-700">Total Receivable</p>
            <p className="mt-1 text-2xl font-bold text-green-900">{fmt(data.totalReceivable)}</p>
            <p className="mt-0.5 text-xs text-green-600">{data.customers.length} customers</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-red-700">Total Payable</p>
            <p className="mt-1 text-2xl font-bold text-red-900">{fmt(data.totalPayable)}</p>
            <p className="mt-0.5 text-xs text-red-600">{data.suppliers.length} suppliers</p>
          </CardContent>
        </Card>
      </div>

      {error !== null && (
        <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tab navigation */}
      <div
        className="flex gap-1 rounded-lg border bg-gray-50 p-1"
        role="tablist"
        aria-label="Outstanding report tabs"
      >
        {(
          [
            { id: 'customers' as TabId, label: `Customer Receivables (${data.customers.length})` },
            { id: 'suppliers' as TabId, label: `Supplier Payables (${data.suppliers.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Customer Receivables */}
      {activeTab === 'customers' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Customer Receivables</CardTitle>
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
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton />
            ) : data.customers.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No outstanding receivables.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Customer receivables">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase text-gray-500">
                      <th className="pb-2 pr-4">Code</th>
                      <th className="pb-2 pr-4">Customer</th>
                      <th className="pb-2 pr-4 text-right">Outstanding</th>
                      <th className="pb-2 text-right">Overdue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.customers.map((row) => (
                      <tr key={row.customerId} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-mono text-xs text-gray-500">
                          {row.customerCode}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">{row.customerName}</td>
                        <td className="py-2.5 pr-4 text-right font-medium">
                          {fmt(row.outstanding)}
                        </td>
                        <td
                          className={`py-2.5 text-right font-medium ${
                            row.overdue > 0 ? 'text-red-700' : 'text-gray-400'
                          }`}
                        >
                          {row.overdue > 0 ? fmt(row.overdue) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Supplier Payables */}
      {activeTab === 'suppliers' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Supplier Payables</CardTitle>
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
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton />
            ) : data.suppliers.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No outstanding payables.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Supplier payables">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase text-gray-500">
                      <th className="pb-2 pr-4">Code</th>
                      <th className="pb-2 pr-4">Supplier</th>
                      <th className="pb-2 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.suppliers.map((row) => (
                      <tr key={row.supplierId} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-4 font-mono text-xs text-gray-500">
                          {row.supplierCode}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">{row.supplierName}</td>
                        <td className="py-2.5 text-right font-medium text-red-700">
                          {fmt(row.outstanding)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
