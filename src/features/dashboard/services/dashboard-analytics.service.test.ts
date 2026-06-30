import { describe, expect, it } from "vitest";
import {
  buildMonthBuckets,
  agingBucketOf,
  computeTrend,
  computeAging,
  computeInvoiceStatus,
} from "./dashboard-analytics.service";

const NOW = new Date("2026-06-15T00:00:00Z");

describe("buildMonthBuckets", () => {
  it("returns the last N months oldest→newest ending at the current month", () => {
    const b = buildMonthBuckets(NOW, 6);
    expect(b).toHaveLength(6);
    expect(b[5]?.key).toBe("2026-06");
    expect(b[5]?.label).toBe("Jun");
    expect(b[0]?.key).toBe("2026-01");
    expect(b[0]?.label).toBe("Jan");
  });
});

describe("agingBucketOf", () => {
  it("buckets by days past due (due date preferred)", () => {
    expect(agingBucketOf("2026-06-10", "2026-01-01", NOW)).toBe("0-30");
    expect(agingBucketOf("2026-05-10", "2026-01-01", NOW)).toBe("31-60");
    expect(agingBucketOf("2026-04-10", "2026-01-01", NOW)).toBe("61-90");
    expect(agingBucketOf("2026-01-10", "2026-01-01", NOW)).toBe("90+");
  });

  it("treats not-yet-due as current (0-30) and falls back to invoice date", () => {
    expect(agingBucketOf("2026-07-01", "2026-06-01", NOW)).toBe("0-30");
    expect(agingBucketOf(null, "2026-06-10", NOW)).toBe("0-30");
  });
});

describe("computeTrend", () => {
  it("aggregates sales and purchases into month buckets", () => {
    const trend = computeTrend(
      [
        { invoice_date: "2026-06-02", due_date: null, total_amount: 100, amount_paid: 0, payment_status: "unpaid", customers: null },
        { invoice_date: "2026-06-20", due_date: null, total_amount: 50, amount_paid: 0, payment_status: "unpaid", customers: null },
        { invoice_date: "2026-05-05", due_date: null, total_amount: 70, amount_paid: 0, payment_status: "unpaid", customers: null },
      ],
      [{ invoice_date: "2026-06-01", due_date: null, total_amount: 40, amount_paid: 0 }],
      NOW
    );
    const jun = trend.find((t) => t.month === "Jun");
    const may = trend.find((t) => t.month === "May");
    expect(jun).toEqual({ month: "Jun", sales: 150, purchases: 40 });
    expect(may?.sales).toBe(70);
  });
});

describe("computeAging", () => {
  it("buckets outstanding balances and ignores fully paid", () => {
    const aging = computeAging(
      [
        { invoice_date: "2026-01-01", due_date: "2026-06-10", total_amount: 100, amount_paid: 0, payment_status: "unpaid", customers: null },
        { invoice_date: "2026-01-01", due_date: "2026-06-10", total_amount: 100, amount_paid: 100, payment_status: "paid", customers: null },
      ],
      [{ invoice_date: "2026-01-01", due_date: "2026-04-10", total_amount: 200, amount_paid: 50 }],
      NOW
    );
    const cur = aging.find((a) => a.bucket === "0-30");
    const old = aging.find((a) => a.bucket === "61-90");
    expect(cur?.receivable).toBe(100); // paid one excluded
    expect(old?.payable).toBe(150);
    expect(aging).toHaveLength(4);
  });
});

describe("computeInvoiceStatus", () => {
  it("groups by payment status and drops empty buckets", () => {
    const status = computeInvoiceStatus([
      { invoice_date: "2026-06-01", due_date: null, total_amount: 100, amount_paid: 100, payment_status: "paid", customers: null },
      { invoice_date: "2026-06-01", due_date: null, total_amount: 80, amount_paid: 40, payment_status: "partial", customers: null },
      { invoice_date: "2026-06-01", due_date: null, total_amount: 60, amount_paid: 0, payment_status: "unpaid", customers: null },
    ]);
    expect(status).toHaveLength(3);
    expect(status.find((s) => s.status === "paid")?.count).toBe(1);
    expect(status.find((s) => s.status === "partial")?.amount).toBe(80);
  });
});
