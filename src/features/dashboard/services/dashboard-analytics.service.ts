import type { AppSupabaseClient } from "@/lib/supabase/types";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface MonthlyTrendPoint {
  /** Short month label, e.g. "Jan". */
  readonly month: string;
  readonly sales: number;
  readonly purchases: number;
}

export interface AgingBucket {
  readonly bucket: string;
  readonly receivable: number;
  readonly payable: number;
}

export interface StatusSlice {
  readonly status: string;
  readonly label: string;
  readonly count: number;
  readonly amount: number;
}

export interface TopEntity {
  readonly name: string;
  readonly amount: number;
}

export interface DashboardAnalytics {
  readonly trend: MonthlyTrendPoint[];
  readonly aging: AgingBucket[];
  readonly invoiceStatus: StatusSlice[];
  readonly topCustomers: TopEntity[];
  readonly topProducts: TopEntity[];
}

// ─────────────────────────────────────────────────────────────
// Helpers (pure — unit tested directly)
// ─────────────────────────────────────────────────────────────

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface InvoiceRow {
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  customers: { name: string } | null;
}

interface PurchaseRow {
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
}

interface ItemRow {
  line_total: number;
  products: { name: string } | null;
}

/** Builds the last `count` months (oldest→newest) as {key:"YYYY-MM", label}. */
export function buildMonthBuckets(
  now: Date,
  count: number
): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: MONTH_LABELS[d.getMonth()] ?? "" });
  }
  return out;
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7); // "YYYY-MM"
}

/** Days a balance is past its due date relative to `now` (negative = not due). */
export function agingBucketOf(dueDate: string | null, invoiceDate: string, now: Date): string {
  const ref = dueDate ?? invoiceDate;
  const days = Math.floor(
    (now.getTime() - new Date(ref).getTime()) / 86_400_000
  );
  if (days <= 30) {
    return "0-30";
  }
  if (days <= 60) {
    return "31-60";
  }
  if (days <= 90) {
    return "61-90";
  }
  return "90+";
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  partial: "Partial",
  unpaid: "Unpaid",
  pending: "Unpaid",
};

export function computeTrend(
  invoices: InvoiceRow[],
  purchases: PurchaseRow[],
  now: Date
): MonthlyTrendPoint[] {
  const buckets = buildMonthBuckets(now, 6);
  const salesByMonth = new Map<string, number>();
  const purchByMonth = new Map<string, number>();
  for (const inv of invoices) {
    const k = monthKey(inv.invoice_date);
    salesByMonth.set(k, (salesByMonth.get(k) ?? 0) + Number(inv.total_amount));
  }
  for (const p of purchases) {
    const k = monthKey(p.invoice_date);
    purchByMonth.set(k, (purchByMonth.get(k) ?? 0) + Number(p.total_amount));
  }
  return buckets.map((b) => ({
    month: b.label,
    sales: Math.round(salesByMonth.get(b.key) ?? 0),
    purchases: Math.round(purchByMonth.get(b.key) ?? 0),
  }));
}

export function computeAging(
  invoices: InvoiceRow[],
  purchases: PurchaseRow[],
  now: Date
): AgingBucket[] {
  const order = ["0-30", "31-60", "61-90", "90+"];
  const rec = new Map<string, number>();
  const pay = new Map<string, number>();
  for (const inv of invoices) {
    const bal = Number(inv.total_amount) - Number(inv.amount_paid);
    if (bal <= 0) {
      continue;
    }
    const b = agingBucketOf(inv.due_date, inv.invoice_date, now);
    rec.set(b, (rec.get(b) ?? 0) + bal);
  }
  for (const p of purchases) {
    const bal = Number(p.total_amount) - Number(p.amount_paid);
    if (bal <= 0) {
      continue;
    }
    const b = agingBucketOf(p.due_date, p.invoice_date, now);
    pay.set(b, (pay.get(b) ?? 0) + bal);
  }
  return order.map((bucket) => ({
    bucket,
    receivable: Math.round(rec.get(bucket) ?? 0),
    payable: Math.round(pay.get(bucket) ?? 0),
  }));
}

export function computeInvoiceStatus(invoices: InvoiceRow[]): StatusSlice[] {
  const byStatus = new Map<string, { count: number; amount: number }>();
  for (const inv of invoices) {
    const key = inv.payment_status === "partial"
      ? "partial"
      : inv.payment_status === "paid"
        ? "paid"
        : "unpaid";
    const cur = byStatus.get(key) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += Number(inv.total_amount);
    byStatus.set(key, cur);
  }
  return (["paid", "partial", "unpaid"] as const)
    .map((status) => ({
      status,
      label: PAYMENT_STATUS_LABELS[status] ?? status,
      count: byStatus.get(status)?.count ?? 0,
      amount: Math.round(byStatus.get(status)?.amount ?? 0),
    }))
    .filter((s) => s.count > 0);
}

function topBy(
  rows: { name: string; amount: number }[],
  limit: number
): TopEntity[] {
  const agg = new Map<string, number>();
  for (const r of rows) {
    agg.set(r.name, (agg.get(r.name) ?? 0) + r.amount);
  }
  return [...agg.entries()]
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export async function getDashboardAnalytics(
  supabase: AppSupabaseClient,
  orgId: string
): Promise<DashboardAnalytics> {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    .toISOString()
    .slice(0, 10);

  const [invRes, purchRes, itemRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("invoice_date, due_date, total_amount, amount_paid, payment_status, customers(name)")
      .eq("organization_id", orgId)
      .eq("status", "posted")
      .is("deleted_at", null)
      .gte("invoice_date", sixMonthsAgo),

    supabase
      .from("purchase_invoices")
      .select("invoice_date, due_date, total_amount, amount_paid")
      .eq("organization_id", orgId)
      .eq("status", "posted")
      .is("deleted_at", null)
      .gte("invoice_date", sixMonthsAgo),

    supabase
      .from("invoice_items")
      .select("line_total, products(name), invoices!inner(status, invoice_date)")
      .eq("organization_id", orgId)
      .eq("invoices.status", "posted")
      .gte("invoices.invoice_date", sixMonthsAgo),
  ]);

  const invoices = (invRes.data ?? []) as unknown as InvoiceRow[];
  const purchases = (purchRes.data ?? []) as unknown as PurchaseRow[];
  const items = (itemRes.data ?? []) as unknown as ItemRow[];

  const topCustomers = topBy(
    invoices.map((i) => ({
      name: i.customers?.name ?? "—",
      amount: Number(i.total_amount),
    })),
    5
  );

  const topProducts = topBy(
    items.map((i) => ({
      name: i.products?.name ?? "—",
      amount: Number(i.line_total),
    })),
    5
  );

  return {
    trend: computeTrend(invoices, purchases, now),
    aging: computeAging(invoices, purchases, now),
    invoiceStatus: computeInvoiceStatus(invoices),
    topCustomers,
    topProducts,
  };
}
