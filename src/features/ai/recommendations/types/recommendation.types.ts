/**
 * Domain types for the AI Recommendation Engine (spec §9).
 *
 * The AI *output* shapes live in `../schemas/recommendation.schema.ts`
 * (Zod v4). These types describe the compact business snapshot the service
 * derives from existing repositories and feeds to the gateway.
 */
import type { AiError } from "@/features/ai/types/ai.types";
import type { RecommendationOutput } from "../schemas/recommendation.schema";

/** A low-stock product line distilled from inventory levels. */
export interface LowStockSummary {
  readonly code: string;
  readonly name: string;
  readonly quantity: number;
  readonly reorderLevel: number;
  readonly purchasePrice: number;
}

/** A supplier distilled to the figures relevant to sourcing decisions. */
export interface SupplierSummary {
  readonly name: string;
  readonly rating: number | null;
  readonly paymentTermsDays: number;
}

/** Per-customer purchasing aggregate derived from posted invoices. */
export interface CustomerActivitySummary {
  readonly name: string;
  readonly totalBilled: number;
  readonly invoiceCount: number;
  readonly overdueCount: number;
  readonly lastInvoiceDate: string | null;
}

/** A compact, tenant-scoped snapshot of the business for the model. */
export interface RecommendationSnapshot {
  readonly currency: string;
  readonly activeProductCount: number;
  readonly lowStockCount: number;
  readonly lowStockItems: readonly LowStockSummary[];
  readonly supplierCount: number;
  readonly topSuppliers: readonly SupplierSummary[];
  readonly customerCount: number;
  readonly topCustomers: readonly CustomerActivitySummary[];
  readonly postedInvoiceCount: number;
  readonly totalRevenue: number;
  readonly outstandingAmount: number;
  readonly overdueInvoiceCount: number;
}

export type RecommendationResult =
  | { readonly success: true; readonly data: RecommendationOutput }
  | { readonly success: false; readonly error: AiError };
