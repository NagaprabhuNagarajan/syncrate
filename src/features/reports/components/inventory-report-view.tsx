'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { getInventoryReport } from '../services/inventory-report.service';
import { objectsToCsv } from '@/utils/csv';
import { cn } from '@/utils/cn';
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
      <Badge dot variant="success">
        In Stock
      </Badge>
    );
  }
  if (status === 'low_stock') {
    return (
      <Badge dot variant="warning">
        Low Stock
      </Badge>
    );
  }
  return (
    <Badge dot variant="destructive">
      Out of Stock
    </Badge>
  );
}

interface InventoryReportViewProps {
  readonly initialData: InventoryReport;
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

const TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Low Stock', value: 'low_stock' },
  { label: 'Out of Stock', value: 'out_of_stock' },
];

export function InventoryReportView({
  initialData,
  orgId,
}: InventoryReportViewProps) {
  const searchParams = useSearchParams();
  const org = searchParams.get('org');
  const reportsHref = org ? `/reports?org=${org}` : '/reports';

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
    activeTab === 'all'
      ? data.items
      : data.items.filter((i) => i.status === activeTab);

  function handleExport() {
    const csv = objectsToCsv(
      ['productCode', 'productName', 'currentStock', 'reorderLevel', 'status'],
      filteredItems as unknown as Record<string, unknown>[]
    );
    downloadCsv('inventory-report.csv', csv);
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
        className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-success shadow-glow-primary">
            <Package className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Inventory Report
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Current stock levels across all branches
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
          icon={Package}
          label="Total Products"
          value={data.totals.totalProducts}
          tint="bg-gradient-brand"
          index={0}
        />
        <StatTile
          icon={CheckCircle2}
          label="In Stock"
          value={data.totals.inStock}
          tint="bg-gradient-success"
          index={1}
        />
        <StatTile
          icon={AlertTriangle}
          label="Low Stock"
          value={data.totals.lowStock}
          tint="bg-gradient-warning"
          index={2}
        />
        <StatTile
          icon={XCircle}
          label="Out of Stock"
          value={data.totals.outOfStock}
          tint="bg-gradient-error"
          index={3}
        />
      </div>

      {/* Stock table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className="mt-5"
      >
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="tablist"
              aria-label="Filter by stock status"
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      isActive
                        ? 'border-transparent bg-gradient-brand text-white shadow-glow-primary'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600'
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
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
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : filteredItems.length === 0 ? (
            <p className="px-5 pb-8 pt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              No products found.
            </p>
          ) : (
            <Table
              aria-label="Inventory stock levels"
              className="[&_td]:px-5 [&_th]:px-5"
              wrapperClassName="rounded-none border-0 border-t border-slate-100 bg-transparent dark:border-slate-800"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((row) => (
                  <TableRow key={row.productId}>
                    <TableCell className="nums font-mono text-xs text-slate-500 dark:text-slate-400">
                      {row.productCode}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                      {row.productName}
                    </TableCell>
                    <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                      {row.currentStock}
                    </TableCell>
                    <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                      {row.reorderLevel}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
