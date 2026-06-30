'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedNumber } from '@/components/shared/animated-number';
import { createClient } from '@/lib/supabase/client';
import { getInventoryReport } from '../services/inventory-report.service';
import { objectsToCsv } from '@/utils/csv';
import type { InventoryReport, InventoryRow } from '../types/report.types';

type FilterTab = 'all' | 'low_stock' | 'out_of_stock';

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { readonly status: InventoryRow['status'] }) {
  if (status === 'in_stock') {
    return (
      <Badge dot variant="success">In Stock</Badge>
    );
  }
  if (status === 'low_stock') {
    return (
      <Badge dot variant="warning">Low Stock</Badge>
    );
  }
  return (
    <Badge dot variant="destructive">Out of Stock</Badge>
  );
}

interface InventoryReportViewProps {
  readonly initialData: InventoryReport;
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

const TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Low Stock', value: 'low_stock' },
  { label: 'Out of Stock', value: 'out_of_stock' },
];

export function InventoryReportView({ initialData, orgId }: InventoryReportViewProps) {
  const [data, setData] = useState<InventoryReport>(initialData);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const report = await getInventoryReport(supabase, orgId);
      setData(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  const filteredItems =
    activeTab === 'all' ? data.items : data.items.filter((i) => i.status === activeTab);

  function handleExport() {
    const csv = objectsToCsv(
      ['productCode', 'productName', 'currentStock', 'reorderLevel', 'status'],
      filteredItems as unknown as Record<string, unknown>[]
    );
    downloadCsv('inventory-report.csv', csv);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Inventory Report</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Current stock levels across all branches</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchReport()} disabled={isLoading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Products', value: data.totals.totalProducts, color: 'text-gray-900 dark:text-slate-100' },
          { label: 'In Stock', value: data.totals.inStock, color: 'text-green-700 dark:text-green-400' },
          { label: 'Low Stock', value: data.totals.lowStock, color: 'text-orange-700 dark:text-orange-400' },
          { label: 'Out of Stock', value: data.totals.outOfStock, color: 'text-red-700 dark:text-red-400' },
        ].map((card) => (
          <Card key={card.label} hover>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 dark:text-slate-400">{card.label}</p>
              <p className={`mt-1 text-2xl font-bold ${card.color}`}>
                <AnimatedNumber value={card.value} />
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
          <div className="flex gap-1" role="tablist" aria-label="Filter by stock status">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={isLoading || filteredItems.length === 0}
            aria-label="Export inventory CSV"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton />
          ) : filteredItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-slate-400">No products found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="Inventory stock levels">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase text-gray-500 dark:border-slate-800 dark:text-slate-400">
                    <th className="pb-2 pr-4">Code</th>
                    <th className="pb-2 pr-4">Product</th>
                    <th className="pb-2 pr-4 text-right">Stock</th>
                    <th className="pb-2 pr-4 text-right">Reorder Level</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-800">
                  {filteredItems.map((row) => (
                    <tr key={row.productId} className="transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      <td className="nums py-2.5 pr-4 font-mono text-xs text-gray-500 dark:text-slate-400">
                        {row.productCode}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{row.productName}</td>
                      <td className="nums py-2.5 pr-4 text-right">{row.currentStock}</td>
                      <td className="nums py-2.5 pr-4 text-right">{row.reorderLevel}</td>
                      <td className="py-2.5">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
