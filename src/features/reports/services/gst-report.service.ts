import type { SupabaseClient } from '@supabase/supabase-js';
import type { DateRangeFilter, GstReport, GstLineRow } from '../types/report.types';

type InvoiceItemRow = {
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
  invoices: { invoice_date: string };
};

export async function getGstReport(
  supabase: SupabaseClient,
  orgId: string,
  dateRange: DateRangeFilter
): Promise<GstReport> {
  const { data, error } = await supabase
    .from('invoice_items')
    .select('cgst_amount, sgst_amount, igst_amount, line_total, invoices!inner(invoice_date, organization_id, status, deleted_at)')
    .eq('invoices.organization_id', orgId)
    .eq('invoices.status', 'posted')
    .is('invoices.deleted_at', null)
    .gte('invoices.invoice_date', dateRange.from)
    .lte('invoices.invoice_date', dateRange.to);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as InvoiceItemRow[];

  const monthMap = new Map<string, GstLineRow>();

  for (const row of rows) {
    const month = row.invoices.invoice_date.slice(0, 7);
    const cgst = row.cgst_amount ?? 0;
    const sgst = row.sgst_amount ?? 0;
    const igst = row.igst_amount ?? 0;
    const lineTotal = row.line_total ?? 0;
    const taxableAmount = lineTotal - cgst - sgst - igst;
    const totalTax = cgst + sgst + igst;

    const existing = monthMap.get(month);
    if (existing) {
      existing.taxableAmount += taxableAmount;
      existing.cgstAmount += cgst;
      existing.sgstAmount += sgst;
      existing.igstAmount += igst;
      existing.totalTax += totalTax;
    } else {
      monthMap.set(month, {
        month,
        taxableAmount,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        totalTax,
      });
    }
  }

  const lines = Array.from(monthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  const totals = lines.reduce(
    (acc, l) => ({
      taxableAmount: acc.taxableAmount + l.taxableAmount,
      cgstAmount: acc.cgstAmount + l.cgstAmount,
      sgstAmount: acc.sgstAmount + l.sgstAmount,
      igstAmount: acc.igstAmount + l.igstAmount,
      totalTax: acc.totalTax + l.totalTax,
    }),
    {
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTax: 0,
    }
  );

  return { lines, totals, dateRange };
}
