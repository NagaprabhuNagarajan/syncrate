"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Boxes,
  Search,
  SlidersHorizontal,
  ArrowLeftRight,
  AlertTriangle,
  History,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AdjustStockDialog } from "@/features/inventory/components/adjust-stock-dialog";
import { TransferStockDialog } from "@/features/inventory/components/transfer-stock-dialog";
import type {
  InventoryLevel,
  InventoryLevelListResult,
  InventoryTransaction,
  InventoryTransactionType,
  ProductOption,
} from "@/features/inventory/types/inventory.types";
import type { BranchOption } from "@/features/organization/server/branch-options";

// ─────────────────────────────────────────────────────────────
// Ledger presentation
// ─────────────────────────────────────────────────────────────

const TX_LABEL: Record<InventoryTransactionType, string> = {
  opening: "Opening",
  purchase: "Purchase",
  sale: "Sale",
  sales_return: "Sales return",
  purchase_return: "Purchase return",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  adjustment: "Adjustment",
  damage: "Damage",
  expiry: "Expiry",
  production: "Production",
  consumption: "Consumption",
};

const TX_VARIANT: Record<InventoryTransactionType, BadgeProps["variant"]> = {
  opening: "secondary",
  purchase: "success",
  sale: "muted",
  sales_return: "success",
  purchase_return: "muted",
  transfer_in: "success",
  transfer_out: "warning",
  adjustment: "secondary",
  damage: "destructive",
  expiry: "destructive",
  production: "success",
  consumption: "muted",
};

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
// Props
// ─────────────────────────────────────────────────────────────

interface InventoryViewProps {
  readonly organizationId: string;
  readonly result: InventoryLevelListResult;
  readonly transactions: readonly InventoryTransaction[];
  readonly products: readonly ProductOption[];
  readonly branches: readonly BranchOption[];
  readonly filters: {
    readonly search?: string;
    readonly branchId?: string;
    readonly lowStockOnly?: boolean;
  };
  readonly stockValue: number;
  readonly canAdjust: boolean;
  readonly canTransfer: boolean;
}

export function InventoryView({
  organizationId,
  result,
  transactions,
  products,
  branches,
  filters,
  stockValue,
  canAdjust,
  canTransfer,
}: InventoryViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const { items } = result;

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

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushWith({ search: searchInput.trim() || undefined });
  };

  const handleBranchChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    pushWith({ branch: event.target.value || undefined });
  };

  const handleLowStockToggle = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    pushWith({ low: event.target.checked ? "1" : undefined });
  };

  const refresh = (): void => {
    router.refresh();
  };

  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Inventory"
        description="Track stock levels and movements across your branches"
        icon={Boxes}
      >
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
              <SlidersHorizontal className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Adjust stock
            </Button>
          )}
        </div>
      </PageHeader>

      <p className="mt-4 text-sm text-muted-foreground">
        Total stock value:{" "}
        <span className="nums font-semibold text-slate-900 dark:text-slate-100">
          {currencyFormatter.format(stockValue)}
        </span>
      </p>

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

      {/* Filters */}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="relative flex-1"
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
            onChange={(event) => setSearchInput(event.target.value)}
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
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-primary-600 focus:ring-primary-500"
            checked={filters.lowStockOnly ?? false}
            onChange={handleLowStockToggle}
          />
          Low stock only
        </label>
      </div>

      {/* Stock levels */}
      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No stock to show"
            description={
              filters.search || filters.branchId || filters.lowStockOnly
                ? "No stock matches your current filters."
                : "Stock appears here once you record opening stock, purchases or adjustments."
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Product
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Branch
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Quantity
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Reorder level
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((level: InventoryLevel) => {
                    const isLow = level.quantity <= level.reorderLevel;
                    return (
                      <tr
                        key={level.id}
                        className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {level.productName}
                          </div>
                          <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            {level.productCode}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                          {level.branchName}
                        </td>
                        <td className="nums px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatQuantity(level.quantity)}
                        </td>
                        <td className="nums px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                          {formatQuantity(level.reorderLevel)}
                        </td>
                        <td className="px-3 py-2">
                          {isLow ? (
                            <Badge variant="warning">
                              <AlertTriangle
                                className="mr-1 h-3 w-3"
                                aria-hidden="true"
                              />
                              Reorder
                            </Badge>
                          ) : (
                            <Badge dot variant="success">
                              In stock
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* Ledger / transactions */}
      <div className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      When
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Product
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Branch
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Change
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {transactions.map((tx: InventoryTransaction) => (
                    <tr key={tx.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500 dark:text-slate-400">
                        {formatDateTime(tx.createdAt)}
                      </td>
                      <td className="px-3 py-2">
                        <Badge dot variant={TX_VARIANT[tx.type]}>
                          {TX_LABEL[tx.type]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        {tx.productName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {tx.branchName ?? "—"}
                      </td>
                      <td
                        className={
                          tx.quantity < 0
                            ? "text-error-600 dark:text-error-400 nums px-3 py-2 text-right font-medium"
                            : "text-success-700 dark:text-success-300 nums px-3 py-2 text-right font-medium"
                        }
                      >
                        {formatSignedQuantity(tx.quantity)}
                      </td>
                      <td className="nums px-3 py-2 text-right text-slate-900 dark:text-slate-100">
                        {formatQuantity(tx.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

InventoryView.displayName = "InventoryView";
