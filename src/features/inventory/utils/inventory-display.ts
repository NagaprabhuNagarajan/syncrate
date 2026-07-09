import type { BadgeProps } from "@/components/ui/badge";
import type {
  InventoryLevel,
  InventoryTransactionType,
} from "@/features/inventory/types/inventory.types";
import type { BatchStatus } from "@/features/inventory/types/batch.types";

// ─────────────────────────────────────────────────────────────
// Stock level status
// ─────────────────────────────────────────────────────────────

export type StockStatus = "out_of_stock" | "low_stock" | "in_stock";

/** Derives a stock level's status from its quantity vs. reorder level. */
export function getStockStatus(
  level: Pick<InventoryLevel, "quantity" | "reorderLevel">
): StockStatus {
  if (level.quantity === 0) {
    return "out_of_stock";
  }
  if (level.quantity <= level.reorderLevel) {
    return "low_stock";
  }
  return "in_stock";
}

/** Badge variant used to render each stock status consistently. */
export const STOCK_STATUS_VARIANT: Record<StockStatus, BadgeProps["variant"]> = {
  out_of_stock: "destructive",
  low_stock: "warning",
  in_stock: "success",
};

/** Human-readable label for each stock status. */
export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  out_of_stock: "Out of stock",
  low_stock: "Reorder",
  in_stock: "In stock",
};

// ─────────────────────────────────────────────────────────────
// Ledger / transaction presentation
// ─────────────────────────────────────────────────────────────

export const TX_LABEL: Record<InventoryTransactionType, string> = {
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

export const TX_VARIANT: Record<InventoryTransactionType, BadgeProps["variant"]> = {
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

// ─────────────────────────────────────────────────────────────
// Batch status
// ─────────────────────────────────────────────────────────────

export const BATCH_STATUS_VARIANT: Record<BatchStatus, BadgeProps["variant"]> = {
  active: "success",
  expired: "destructive",
  depleted: "muted",
};

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  active: "Active",
  expired: "Expired",
  depleted: "Depleted",
};
