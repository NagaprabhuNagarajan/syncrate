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
import type { WarehouseOption } from "@/features/warehouse/types/warehouse.types";

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
  readonly warehouses: readonly WarehouseOption[];
  readonly filters: {
    readonly search?: string;
    readonly warehouseId?: string;
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
  warehouses,
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

  const handleWarehouseChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    pushWith({ warehouse: event.target.value || undefined });
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
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Inventory"
        description="Track stock levels and movements across your warehouses"
        icon={Boxes}
      >
        <div className="flex flex-wrap items-center gap-2">
          {canTransfer && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferOpen(true)}
              disabled={products.length === 0 || warehouses.length < 2}
            >
              <ArrowLeftRight className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Transfer
            </Button>
          )}
          {canAdjust && (
            <Button
              type="button"
              onClick={() => setAdjustOpen(true)}
              disabled={products.length === 0 || warehouses.length === 0}
            >
              <SlidersHorizontal className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Adjust stock
            </Button>
          )}
        </div>
      </PageHeader>

      <p className="mt-4 text-sm text-muted-foreground">
        Total stock value:{" "}
        <span className="font-semibold text-slate-900">
          {currencyFormatter.format(stockValue)}
        </span>
      </p>

      {adjustOpen && (
        <AdjustStockDialog
          organizationId={organizationId}
          products={products}
          warehouses={warehouses}
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
          warehouses={warehouses}
          onClose={() => setTransferOpen(false)}
          onDone={() => {
            setTransferOpen(false);
            refresh();
          }}
        />
      )}

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          className="relative flex-1"
        >
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search stock by product"
            placeholder="Search by product name or code"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </form>
        <select
          aria-label="Filter by warehouse"
          value={filters.warehouseId ?? ""}
          onChange={handleWarehouseChange}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition-colors hover:border-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All warehouses</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            checked={filters.lowStockOnly ?? false}
            onChange={handleLowStockToggle}
          />
          Low stock only
        </label>
      </div>

      {/* Stock levels */}
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No stock to show"
            description={
              filters.search || filters.warehouseId || filters.lowStockOnly
                ? "No stock matches your current filters."
                : "Stock appears here once you record opening stock, purchases or adjustments."
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Product
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Warehouse
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Quantity
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Reorder level
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((level: InventoryLevel) => {
                    const isLow = level.quantity <= level.reorderLevel;
                    return (
                      <tr
                        key={level.id}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {level.productName}
                          </div>
                          <div className="font-mono text-xs text-slate-500">
                            {level.productCode}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {level.warehouseName}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                          {formatQuantity(level.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                          {formatQuantity(level.reorderLevel)}
                        </td>
                        <td className="px-4 py-3">
                          {isLow ? (
                            <Badge variant="warning">
                              <AlertTriangle
                                className="mr-1 h-3 w-3"
                                aria-hidden="true"
                              />
                              Reorder
                            </Badge>
                          ) : (
                            <Badge variant="success">In stock</Badge>
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
      <div className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900">
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
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">
                      When
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Type
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Product
                    </th>
                    <th scope="col" className="px-4 py-3 font-medium">
                      Warehouse
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Change
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-medium"
                    >
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx: InventoryTransaction) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {formatDateTime(tx.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={TX_VARIANT[tx.type]}>
                          {TX_LABEL[tx.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {tx.productName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {tx.warehouseName ?? "—"}
                      </td>
                      <td
                        className={
                          tx.quantity < 0
                            ? "text-error-600 px-4 py-3 text-right tabular-nums font-medium"
                            : "text-success-700 px-4 py-3 text-right tabular-nums font-medium"
                        }
                      >
                        {formatSignedQuantity(tx.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">
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
