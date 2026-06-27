import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { DashboardKpis } from "./dashboard.service";
import { getDashboardKpis } from "./dashboard.service";

// ─────────────────────────────────────────────────────────────
// Supabase mock helpers
// ─────────────────────────────────────────────────────────────

function makeQueryBuilder(overrides: {
  data?: unknown;
  count?: number;
  error?: null;
}) {
  const defaults = { data: [], count: 0, error: null };
  const resolved = { ...defaults, ...overrides };
  const builder = {
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolved),
  };
  Object.defineProperty(builder, "then", {
    get() {
      return (resolve: (v: typeof resolved) => void) => {
        resolve(resolved);
        return Promise.resolve(resolved);
      };
    },
  });
  return builder;
}

type SelectBuilder = ReturnType<typeof makeQueryBuilder>;

function makeSupabase(
  responses: Partial<Record<string, SelectBuilder>>
): SupabaseClient<Database> {
  let callIndex = 0;
  const tableBuilders: SelectBuilder[] = (
    Object.values(responses) as Array<SelectBuilder | undefined>
  ).filter((b): b is SelectBuilder => b !== undefined);

  return {
    from: (_table: string) => ({
      select: (_cols: string, _opts?: unknown) => {
        const builder =
          tableBuilders[callIndex] ?? makeQueryBuilder({ data: [], count: 0 });
        callIndex += 1;
        return builder;
      },
    }),
  } as unknown as SupabaseClient<Database>;
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("getDashboardKpis", () => {
  it("returns a correctly shaped DashboardKpis with all zeros when no data", async () => {
    const emptyBuilder = makeQueryBuilder({ data: [], count: 0 });
    const supabase = makeSupabase({
      invoicesThisMonth: emptyBuilder,
      invoicesLastMonth: emptyBuilder,
      purchasesThisMonth: emptyBuilder,
      receivable: emptyBuilder,
      payable: emptyBuilder,
      inventory: emptyBuilder,
      openInvoice: emptyBuilder,
      recentInvoices: emptyBuilder,
      recentPurchases: emptyBuilder,
      recentPayments: emptyBuilder,
    });

    const kpis: DashboardKpis = await getDashboardKpis(supabase, "org-1");

    expect(kpis.salesThisMonth).toBe(0);
    expect(kpis.salesLastMonth).toBe(0);
    expect(kpis.purchasesThisMonth).toBe(0);
    expect(kpis.outstandingReceivable).toBe(0);
    expect(kpis.outstandingPayable).toBe(0);
    expect(kpis.lowStockCount).toBe(0);
    expect(kpis.outOfStockCount).toBe(0);
    expect(kpis.openInvoiceCount).toBe(0);
    expect(kpis.recentActivity).toHaveLength(0);
  });

  it("sums sales correctly when invoice data is present", async () => {
    const salesBuilder = makeQueryBuilder({
      data: [{ total_amount: 50000 }, { total_amount: 30000 }],
      count: 2,
    });
    const emptyBuilder = makeQueryBuilder({ data: [], count: 0 });
    const supabase = makeSupabase({
      invoicesThisMonth: salesBuilder,
      invoicesLastMonth: emptyBuilder,
      purchasesThisMonth: emptyBuilder,
      receivable: emptyBuilder,
      payable: emptyBuilder,
      inventory: emptyBuilder,
      openInvoice: emptyBuilder,
      recentInvoices: emptyBuilder,
      recentPurchases: emptyBuilder,
      recentPayments: emptyBuilder,
    });

    const kpis = await getDashboardKpis(supabase, "org-1");

    expect(kpis.salesThisMonth).toBe(80000);
  });

  it("has all required keys in the returned object", async () => {
    const emptyBuilder = makeQueryBuilder({ data: [], count: 0 });
    const supabase = makeSupabase({
      a: emptyBuilder,
      b: emptyBuilder,
      c: emptyBuilder,
      d: emptyBuilder,
      e: emptyBuilder,
      f: emptyBuilder,
      g: emptyBuilder,
      h: emptyBuilder,
      i: emptyBuilder,
      j: emptyBuilder,
    });

    const kpis = await getDashboardKpis(supabase, "org-1");

    const keys: Array<keyof DashboardKpis> = [
      "salesThisMonth",
      "salesLastMonth",
      "purchasesThisMonth",
      "outstandingReceivable",
      "outstandingPayable",
      "lowStockCount",
      "outOfStockCount",
      "openInvoiceCount",
      "recentActivity",
    ];
    for (const key of keys) {
      expect(kpis).toHaveProperty(key);
    }
  });
});
