/**
 * Domain types for AI Business-Intelligence Insights (spec §13).
 *
 * The AI *output* shapes live in `../schemas/insight.schema.ts` (Zod v4).
 * These types describe the compact business snapshot the service derives from
 * existing repositories and feeds to the gateway.
 */
import type { AiError } from "@/features/ai/types/ai.types";
import type { InsightOutput } from "../schemas/insight.schema";

/** Revenue aggregated for a single calendar month (YYYY-MM). */
export interface MonthlyRevenue {
  readonly month: string;
  readonly revenue: number;
  readonly invoiceCount: number;
}

/** A slow-moving product distilled to the figures that explain the risk. */
export interface SlowMovingSummary {
  readonly code: string;
  readonly name: string;
  readonly sellingPrice: number;
  readonly purchasePrice: number;
}

/** A compact, tenant-scoped BI snapshot for the model. */
export interface InsightSnapshot {
  readonly currency: string;
  readonly monthlyRevenue: readonly MonthlyRevenue[];
  readonly totalRevenue: number;
  readonly outstandingAmount: number;
  readonly overdueInvoiceCount: number;
  readonly inventoryValue: number;
  readonly lowStockCount: number;
  readonly slowMovingCount: number;
  readonly slowMovingProducts: readonly SlowMovingSummary[];
  readonly avgGrossMarginPercent: number | null;
  readonly customerCount: number;
  readonly inactiveCustomerCount: number;
  readonly supplierCount: number;
  readonly avgSupplierRating: number | null;
}

export type InsightServiceResult =
  | { readonly success: true; readonly data: InsightOutput }
  | { readonly success: false; readonly error: AiError };
