/**
 * Domain types for AI Smart Reports (spec §11).
 */

import type {
  ReportOutput,
  ReportType,
} from "@/features/ai/reports/schemas/reportSchema";

/** Compact, repository-sourced figures fed to the model. Numbers only. */
export interface ReportSnapshot {
  readonly invoices: {
    readonly total: number;
    readonly sumTotal: number;
    readonly sumPaid: number;
    readonly outstanding: number;
    readonly unpaidCount: number;
    readonly overdueCount: number;
  };
  readonly inventory: {
    readonly totalItems: number;
    readonly lowStockCount: number;
    readonly stockValue: number;
  };
  readonly customers: { readonly total: number };
  readonly suppliers: { readonly total: number };
  readonly products: { readonly total: number };
  readonly customerPayments: {
    readonly total: number;
    readonly sumAmount: number;
  };
  readonly supplierPayments: {
    readonly total: number;
    readonly sumAmount: number;
  };
}

/** The generated report (alias of the schema-inferred output). */
export type SmartReport = ReportOutput;

export type { ReportType };
