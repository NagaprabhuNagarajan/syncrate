import type { AppSupabaseClient } from "@/lib/supabase/types";

export interface RecentActivityItem {
  readonly type: "invoice" | "purchase_invoice" | "customer_payment";
  readonly id: string;
  readonly reference: string;
  readonly amount: number;
  readonly date: string;
  readonly partyName: string;
}

export interface DashboardKpis {
  readonly salesThisMonth: number;
  readonly salesLastMonth: number;
  readonly purchasesThisMonth: number;
  readonly outstandingReceivable: number;
  readonly outstandingPayable: number;
  readonly lowStockCount: number;
  readonly outOfStockCount: number;
  readonly openInvoiceCount: number;
  readonly recentActivity: RecentActivityItem[];
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(year, month, day).toISOString().slice(0, 10);
}

export async function getDashboardKpis(
  supabase: AppSupabaseClient,
  orgId: string
): Promise<DashboardKpis> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const thisMonthStart = isoDate(year, month, 1);
  const lastMonthStart = isoDate(year, month - 1, 1);

  const [
    salesThisMonthRes,
    salesLastMonthRes,
    purchasesThisMonthRes,
    receivableRes,
    payableRes,
    inventoryRes,
    openInvoiceRes,
    recentInvRes,
    recentPurchRes,
    recentPayRes,
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("total_amount")
      .eq("organization_id", orgId)
      .eq("status", "posted")
      .gte("invoice_date", thisMonthStart)
      .is("deleted_at", null),

    supabase
      .from("invoices")
      .select("total_amount")
      .eq("organization_id", orgId)
      .eq("status", "posted")
      .gte("invoice_date", lastMonthStart)
      .lt("invoice_date", thisMonthStart)
      .is("deleted_at", null),

    supabase
      .from("purchase_invoices")
      .select("total_amount")
      .eq("organization_id", orgId)
      .eq("status", "posted")
      .gte("invoice_date", thisMonthStart)
      .is("deleted_at", null),

    supabase
      .from("invoices")
      .select("total_amount, amount_paid")
      .eq("organization_id", orgId)
      .eq("status", "posted")
      .in("payment_status", ["unpaid", "partial"])
      .is("deleted_at", null),

    supabase
      .from("purchase_invoices")
      .select("total_amount, amount_paid")
      .eq("organization_id", orgId)
      .eq("status", "posted")
      .is("deleted_at", null),

    supabase
      .from("inventory")
      .select("quantity, products(track_inventory, reorder_level)")
      .eq("organization_id", orgId),

    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "posted")
      .neq("payment_status", "paid")
      .is("deleted_at", null),

    supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, invoice_date, created_at, customers(name)")
      .eq("organization_id", orgId)
      .eq("status", "posted")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("purchase_invoices")
      .select("id, invoice_number, total_amount, invoice_date, created_at, suppliers(name)")
      .eq("organization_id", orgId)
      .eq("status", "posted")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("customer_payments")
      .select("id, payment_number, amount, payment_date, created_at, customers(name)")
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const sum = (rows: Array<{ total_amount: number }> | null): number =>
    (rows ?? []).reduce((acc, r) => acc + Number(r.total_amount), 0);

  const salesThisMonth = sum(salesThisMonthRes.data);
  const salesLastMonth = sum(salesLastMonthRes.data);
  const purchasesThisMonth = sum(purchasesThisMonthRes.data);

  const outstandingReceivable = (receivableRes.data ?? []).reduce(
    (acc, r) => acc + (Number(r.total_amount) - Number(r.amount_paid)),
    0
  );

  const outstandingPayable = (payableRes.data ?? [])
    .filter((r) => Number(r.amount_paid) < Number(r.total_amount))
    .reduce(
      (acc, r) => acc + (Number(r.total_amount) - Number(r.amount_paid)),
      0
    );

  type InventoryWithProduct = {
    quantity: number;
    products: { track_inventory: boolean; reorder_level: number } | null;
  };
  const inventoryRows = (inventoryRes.data ?? []) as InventoryWithProduct[];
  const lowStockCount = inventoryRows.filter((r) => {
    const p = r.products;
    return (
      p !== null &&
      p.track_inventory &&
      p.reorder_level > 0 &&
      r.quantity > 0 &&
      r.quantity <= p.reorder_level
    );
  }).length;
  const outOfStockCount = inventoryRows.filter((r) => {
    const p = r.products;
    return p !== null && p.track_inventory && r.quantity === 0;
  }).length;

  const openInvoiceCount = openInvoiceRes.count ?? 0;

  type InvRow = {
    id: string;
    invoice_number: string;
    total_amount: number;
    invoice_date: string;
    created_at: string;
    customers: { name: string } | null;
  };
  type PurchRow = {
    id: string;
    invoice_number: string;
    total_amount: number;
    invoice_date: string;
    created_at: string;
    suppliers: { name: string } | null;
  };
  type PayRow = {
    id: string;
    payment_number: string;
    amount: number;
    payment_date: string;
    created_at: string;
    customers: { name: string } | null;
  };

  const invRows = (recentInvRes.data ?? []) as InvRow[];
  const purchRows = (recentPurchRes.data ?? []) as PurchRow[];
  const payRows = (recentPayRes.data ?? []) as PayRow[];

  const activity: RecentActivityItem[] = [
    ...invRows.map(
      (r): RecentActivityItem => ({
        type: "invoice",
        id: r.id,
        reference: r.invoice_number,
        amount: Number(r.total_amount),
        date: r.invoice_date,
        partyName: r.customers?.name ?? "—",
      })
    ),
    ...purchRows.map(
      (r): RecentActivityItem => ({
        type: "purchase_invoice",
        id: r.id,
        reference: r.invoice_number,
        amount: Number(r.total_amount),
        date: r.invoice_date,
        partyName: r.suppliers?.name ?? "—",
      })
    ),
    ...payRows.map(
      (r): RecentActivityItem => ({
        type: "customer_payment",
        id: r.id,
        reference: r.payment_number,
        amount: Number(r.amount),
        date: r.payment_date,
        partyName: r.customers?.name ?? "—",
      })
    ),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 10);

  return {
    salesThisMonth,
    salesLastMonth,
    purchasesThisMonth,
    outstandingReceivable,
    outstandingPayable,
    lowStockCount,
    outOfStockCount,
    openInvoiceCount,
    recentActivity: activity,
  };
}
