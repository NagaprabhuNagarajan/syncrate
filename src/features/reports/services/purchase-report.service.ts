import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DateRangeFilter,
  PurchaseReport,
  PurchaseSummaryRow,
  PurchaseBySupplierRow,
} from '../types/report.types';

type PurchaseRow = {
  invoice_date: string;
  total_amount: number;
  amount_paid: number;
  supplier_id: string;
  suppliers: { id: string; name: string; code: string };
};

export async function getPurchaseReport(
  supabase: SupabaseClient,
  orgId: string,
  dateRange: DateRangeFilter
): Promise<PurchaseReport> {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('invoice_date, total_amount, amount_paid, supplier_id, suppliers!inner(id, name, code)')
    .eq('organization_id', orgId)
    .eq('status', 'posted')
    .is('deleted_at', null)
    .gte('invoice_date', dateRange.from)
    .lte('invoice_date', dateRange.to);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as PurchaseRow[];

  const summaryMap = new Map<string, PurchaseSummaryRow>();
  const supplierMap = new Map<string, PurchaseBySupplierRow>();

  for (const row of rows) {
    const period = row.invoice_date.slice(0, 7);
    const outstanding = row.total_amount - row.amount_paid;

    const existing = summaryMap.get(period);
    if (existing) {
      existing.invoiceCount += 1;
      existing.totalAmount += row.total_amount;
      existing.amountPaid += row.amount_paid;
      existing.outstanding += outstanding;
    } else {
      summaryMap.set(period, {
        period,
        invoiceCount: 1,
        totalAmount: row.total_amount,
        amountPaid: row.amount_paid,
        outstanding,
      });
    }

    const supplier = row.suppliers;
    const supExisting = supplierMap.get(row.supplier_id);
    if (supExisting) {
      supExisting.invoiceCount += 1;
      supExisting.totalAmount += row.total_amount;
      supExisting.amountPaid += row.amount_paid;
      supExisting.outstanding += outstanding;
    } else {
      supplierMap.set(row.supplier_id, {
        supplierId: row.supplier_id,
        supplierName: supplier.name,
        supplierCode: supplier.code,
        invoiceCount: 1,
        totalAmount: row.total_amount,
        amountPaid: row.amount_paid,
        outstanding,
      });
    }
  }

  const summary = Array.from(summaryMap.values()).sort((a, b) =>
    a.period.localeCompare(b.period)
  );
  const bySupplier = Array.from(supplierMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  const totals = summary.reduce(
    (acc, s) => ({
      totalAmount: acc.totalAmount + s.totalAmount,
      amountPaid: acc.amountPaid + s.amountPaid,
      outstanding: acc.outstanding + s.outstanding,
    }),
    { totalAmount: 0, amountPaid: 0, outstanding: 0 }
  );

  return { summary, bySupplier, totals, dateRange };
}
