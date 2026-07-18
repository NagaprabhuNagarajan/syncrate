"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Layers,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Archive,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatTile } from "@/components/shared/stat-tile";
import { BatchFormDialog } from "@/features/inventory/components/batch-form";
import {
  BATCH_STATUS_LABEL,
  BATCH_STATUS_VARIANT,
} from "@/features/inventory/utils/inventory-display";
import { formatDate } from "@/utils/format";
import type {
  Batch,
  BatchListResult,
  BatchStats,
} from "@/features/inventory/types/batch.types";
import type { ProductOption } from "@/features/inventory/types/inventory.types";

const numberFormatter = new Intl.NumberFormat("en-IN");

function productName(
  products: readonly ProductOption[],
  productId: string
): string {
  const match = products.find((product) => product.id === productId);
  return match ? `${match.name} (${match.code})` : "—";
}

function formatBatchDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  return formatDate(new Date(value));
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface BatchesViewProps {
  readonly organizationId: string;
  readonly result: BatchListResult;
  readonly stats: BatchStats;
  readonly products: readonly ProductOption[];
  readonly filters: {
    readonly productId?: string;
  };
  readonly canManage: boolean;
}

export function BatchesView({
  organizationId,
  result,
  stats,
  products,
  filters,
  canManage,
}: BatchesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);
  const hasFilters = Boolean(filters.productId);
  const org = searchParams.get("org");

  const pushWith = (patch: Record<string, string | undefined>): void => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const query = params.toString();
    router.push(query ? `/inventory/batches?${query}` : "/inventory/batches");
  };

  const clearFilters = (): void => {
    router.push(org ? `/inventory/batches?org=${org}` : "/inventory/batches");
  };

  const handleProductChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    pushWith({ product: event.target.value || undefined, page: undefined });
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand shadow-glow-primary">
            <Layers className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Batches
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {stats.total}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Track products by manufacturing batch and expiry
            </p>
          </div>
        </div>

        {canManage && (
          <Button
            type="button"
            variant="gradient"
            onClick={() => setFormOpen(true)}
            disabled={products.length === 0}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add batch
          </Button>
        )}
      </motion.div>

      {formOpen && (
        <BatchFormDialog
          organizationId={organizationId}
          products={products}
          onClose={() => setFormOpen(false)}
          onDone={() => {
            setFormOpen(false);
            router.refresh();
          }}
        />
      )}

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Layers}
          label="Total"
          value={stats.total}
          tint="bg-gradient-brand"
          index={0}
        />
        <StatTile
          icon={CheckCircle2}
          label="Active"
          value={stats.active}
          tint="bg-gradient-success"
          index={1}
        />
        <StatTile
          icon={AlertTriangle}
          label="Expired"
          value={stats.expired}
          tint="bg-gradient-error"
          index={2}
        />
        <StatTile
          icon={Archive}
          label="Depleted"
          value={stats.depleted}
          tint="bg-gradient-info"
          index={3}
        />
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          aria-label="Filter by product"
          value={filters.productId ?? ""}
          onChange={handleProductChange}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.code})
            </option>
          ))}
        </select>
      </div>

      {/* Table / empty state */}
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={hasFilters ? "No matching batches" : "No batches yet"}
            description={
              hasFilters
                ? "No batches match your current filters. Try clearing the filter."
                : "Add a batch to track manufacturing dates, expiry and remaining quantities."
            }
            action={
              hasFilters
                ? { label: "Clear filters", onClick: clearFilters }
                : canManage && products.length > 0
                  ? {
                      label: "Add batch",
                      icon: Plus,
                      onClick: () => setFormOpen(true),
                    }
                  : undefined
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Table wrapperClassName="shadow-card">
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Mfg date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((batch: Batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-mono text-xs text-slate-700 dark:text-slate-300">
                      {batch.batchNumber}
                    </TableCell>
                    <TableCell className="text-slate-700 dark:text-slate-300">
                      {productName(products, batch.productId)}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {formatBatchDate(batch.manufacturingDate)}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">
                      {formatBatchDate(batch.expiryDate)}
                    </TableCell>
                    <TableCell className="nums text-right text-slate-700 dark:text-slate-300">
                      {numberFormatter.format(batch.receivedQuantity)}
                    </TableCell>
                    <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                      {numberFormatter.format(batch.remainingQuantity)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={BATCH_STATUS_VARIANT[batch.status]}
                        label={BATCH_STATUS_LABEL[batch.status]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      {items.length > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">{rangeStart}</span>–
            <span className="font-medium text-foreground">{rangeEnd}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() =>
                pushWith({ page: page <= 2 ? undefined : String(page - 1) })
              }
            >
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => pushWith({ page: String(page + 1) })}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

BatchesView.displayName = "BatchesView";
