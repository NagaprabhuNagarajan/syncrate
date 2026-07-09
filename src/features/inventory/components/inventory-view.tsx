"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Boxes,
  IndianRupee,
  AlertTriangle,
  PackageX,
  Search,
  ArrowLeftRight,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  History,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { AdjustStockDialog } from "@/features/inventory/components/adjust-stock-dialog";
import { TransferStockDialog } from "@/features/inventory/components/transfer-stock-dialog";
import {
  getStockStatus,
  STOCK_STATUS_LABEL,
  STOCK_STATUS_VARIANT,
  TX_LABEL,
  TX_VARIANT,
} from "@/features/inventory/utils/inventory-display";
import { formatCurrency } from "@/utils/format";
import type {
  InventoryLevel,
  InventoryLevelListResult,
  InventoryStats,
  InventoryTransaction,
  ProductOption,
} from "@/features/inventory/types/inventory.types";
import type { BranchOption } from "@/features/organization/server/branch-options";
import { cn } from "@/utils/cn";

// ─────────────────────────────────────────────────────────────
// Stock filter pills
// ─────────────────────────────────────────────────────────────

const STOCK_FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "All stock" },
  { value: "1", label: "Low stock" },
];

// ─────────────────────────────────────────────────────────────
// Formatters (quantity-specific, not covered by @/utils/format)
// ─────────────────────────────────────────────────────────────

const numberFormatter = new Intl.NumberFormat("en-IN");

function formatQuantity(value: number): string {
  return numberFormatter.format(value);
}

function formatSignedQuantity(value: number): string {
  const formatted = numberFormatter.format(Math.abs(value));
  return value < 0 ? `−${formatted}` : `+${formatted}`;
}

function formatDateTime(value: Date): string {
  return value.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─────────────────────────────────────────────────────────────
// Stat tile
// ─────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  formatter,
  tint,
  index,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: number;
  readonly formatter?: (value: number) => string;
  readonly tint: string;
  readonly index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Card className="relative overflow-hidden p-4">
        <div
          className={cn(
            "absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl",
            tint
          )}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm",
              tint
            )}
          >
            <Icon className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatter ? (
                formatter(value)
              ) : (
                <AnimatedNumber value={value} />
              )}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

interface InventoryViewProps {
  readonly organizationId: string;
  readonly result: InventoryLevelListResult;
  readonly stats: InventoryStats;
  readonly transactions: readonly InventoryTransaction[];
  readonly products: readonly ProductOption[];
  readonly branches: readonly BranchOption[];
  readonly filters: {
    readonly search?: string;
    readonly branchId?: string;
    readonly lowStockOnly?: boolean;
  };
  readonly canAdjust: boolean;
  readonly canTransfer: boolean;
}

export function InventoryView({
  organizationId,
  result,
  stats,
  transactions,
  products,
  branches,
  filters,
  canAdjust,
  canTransfer,
}: InventoryViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const { items, total, page, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);
  const hasFilters = Boolean(
    filters.search || filters.branchId || filters.lowStockOnly
  );
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
    router.push(query ? `/inventory?${query}` : "/inventory");
  };

  const clearFilters = (): void => {
    router.push(org ? `/inventory?org=${org}` : "/inventory");
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushWith({ search: searchInput.trim() || undefined, page: undefined });
  };

  const handleSearchChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const value = event.target.value;
    setSearchInput(value);
    // Clearing the field (native ✕ or deleting the text) resets the list
    // immediately, without waiting for a submit.
    if (value === "" && filters.search) {
      pushWith({ search: undefined, page: undefined });
    }
  };

  const handleBranchChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    pushWith({ branch: event.target.value || undefined, page: undefined });
  };

  const refresh = (): void => {
    router.refresh();
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
            <Boxes className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Inventory
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {stats.totalSkus}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Track stock levels and movements across your branches
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canTransfer && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferOpen(true)}
              disabled={products.length === 0 || branches.length < 2}
            >
              <ArrowLeftRight className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Transfer
            </Button>
          )}
          {canAdjust && (
            <Button
              type="button"
              variant="gradient"
              onClick={() => setAdjustOpen(true)}
              disabled={products.length === 0 || branches.length === 0}
            >
              <SlidersHorizontal
                className="mr-1.5 h-4 w-4"
                aria-hidden="true"
              />
              Adjust stock
            </Button>
          )}
        </div>
      </motion.div>

      {adjustOpen && (
        <AdjustStockDialog
          organizationId={organizationId}
          products={products}
          branches={branches}
          onClose={() => setAdjustOpen(false)}
          onDone={() => {
            setAdjustOpen(false);
            refresh();
          }}
        />
      )}

      {transferOpen && (
        <TransferStockDialog
          organizationId={organizationId}
          products={products}
          branches={branches}
          onClose={() => setTransferOpen(false)}
          onDone={() => {
            setTransferOpen(false);
            refresh();
          }}
        />
      )}

      {/* Stat tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Boxes}
          label="Total SKUs"
          value={stats.totalSkus}
          tint="bg-gradient-brand"
          index={0}
        />
        <StatTile
          icon={IndianRupee}
          label="Stock value"
          value={stats.stockValue}
          formatter={formatCurrency}
          tint="bg-gradient-info"
          index={1}
        />
        <StatTile
          icon={AlertTriangle}
          label="Low stock"
          value={stats.lowStock}
          tint="bg-gradient-warning"
          index={2}
        />
        <StatTile
          icon={PackageX}
          label="Out of stock"
          value={stats.outOfStock}
          tint="bg-gradient-error"
          index={3}
        />
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center lg:flex-1">
          <form
            onSubmit={handleSearchSubmit}
            role="search"
            className="relative w-full sm:max-w-sm"
          >
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Search stock by product"
              placeholder="Search by product name or code"
              value={searchInput}
              onChange={handleSearchChange}
              className="pl-9"
            />
          </form>
          <select
            aria-label="Filter by branch"
            value={filters.branchId ?? ""}
            onChange={handleBranchChange}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label="Filter by stock level"
        >
          {STOCK_FILTERS.map((option) => {
            const active = (filters.lowStockOnly ? "1" : "") === option.value;
            return (
              <button
                key={option.value || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  pushWith({ low: option.value || undefined, page: undefined })
                }
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-transparent bg-gradient-brand text-white shadow-glow-primary"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stock levels table / empty state */}
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={hasFilters ? "No matching stock" : "No stock to show"}
            description={
              hasFilters
                ? "No stock matches your current filters. Try adjusting your search or clearing the filters."
                : "Stock appears here once you record opening stock, purchases or adjustments."
            }
            action={
              hasFilters
                ? { label: "Clear filters", onClick: clearFilters }
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
                  <TableHead>Product</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Reorder level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((level: InventoryLevel) => {
                  const status = getStockStatus(level);
                  return (
                    <TableRow key={level.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                            {level.productName}
                          </span>
                          <span className="block truncate font-mono text-xs text-slate-400 dark:text-slate-500">
                            {level.productCode}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {level.branchName}
                      </TableCell>
                      <TableCell className="nums text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatQuantity(level.quantity)}
                      </TableCell>
                      <TableCell className="nums text-right text-slate-500 dark:text-slate-400">
                        {formatQuantity(level.reorderLevel)}
                      </TableCell>
                      <TableCell>
                        <Badge dot variant={STOCK_STATUS_VARIANT[status]}>
                          {STOCK_STATUS_LABEL[status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
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

      {/* Ledger / transactions */}
      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <History
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent stock movements
          </h2>
        </div>
        {transactions.length === 0 ? (
          <EmptyState
            icon={History}
            title="No movements yet"
            description="Inventory events are recorded here as an immutable ledger."
          />
        ) : (
          <Table wrapperClassName="shadow-card">
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx: InventoryTransaction) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {formatDateTime(tx.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge dot variant={TX_VARIANT[tx.type]}>
                      {TX_LABEL[tx.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-700 dark:text-slate-300">
                    {tx.productName ?? "—"}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">
                    {tx.branchName ?? "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "nums text-right font-medium",
                      tx.quantity < 0
                        ? "text-error-600 dark:text-error-400"
                        : "text-success-700 dark:text-success-300"
                    )}
                  >
                    {formatSignedQuantity(tx.quantity)}
                  </TableCell>
                  <TableCell className="nums text-right text-slate-900 dark:text-slate-100">
                    {formatQuantity(tx.runningBalance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

InventoryView.displayName = "InventoryView";
