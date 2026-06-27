import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DateRangeFilter,
  SalesReport,
  SalesSummaryRow,
  SalesByCustomerRow,
} from '../types/report.types';

type InvoiceRow = {
  invoice_date: string;
  total_amount: number;
  amount_paid: number;
  subtotal: number;
  tax_amount: number;
  customer_id: string;
  customers: { id: string; name: string; code: string };
};

export async function getSalesReport(
  supabase: SupabaseClient,
  orgId: string,
  dateRange: DateRangeFilter
): Promise<SalesReport> {
  const { data, error } = await supabase
    .from('invoices')
    .select('invoice_date, total_amount, amount_paid, subtotal, tax_amount, customer_id, customers!inner(id, name, code)')
    .eq('organization_id', orgId)
    .eq('status', 'posted')
    .is('deleted_at', null)
    .gte('invoice_date', dateRange.from)
    .lte('invoice_date', dateRange.to);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as InvoiceRow[];

  const summaryMap = new Map<string, SalesSummaryRow>();
  const customerMap = new Map<string, SalesByCustomerRow>();

  for (const row of rows) {
    const period = row.invoice_date.slice(0, 7);
    const outstanding = row.total_amount - row.amount_paid;

    const existing = summaryMap.get(period);
    if (existing) {
      existing.invoiceCount += 1;
      existing.subtotal += row.subtotal;
      existing.taxAmount += row.tax_amount;
      existing.totalAmount += row.total_amount;
      existing.amountPaid += row.amount_paid;
      existing.outstanding += outstanding;
    } else {
      summaryMap.set(period, {
        period,
        invoiceCount: 1,
        subtotal: row.subtotal,
        taxAmount: row.tax_amount,
        totalAmount: row.total_amount,
        amountPaid: row.amount_paid,
        outstanding,
      });
    }

    const customer = row.customers;
    const custExisting = customerMap.get(row.customer_id);
    if (custExisting) {
      custExisting.invoiceCount += 1;
      custExisting.totalAmount += row.total_amount;
      custExisting.amountPaid += row.amount_paid;
      custExisting.outstanding += outstanding;
    } else {
      customerMap.set(row.customer_id, {
        customerId: row.customer_id,
        customerName: customer.name,
        customerCode: customer.code,
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
  const byCustomer = Array.from(customerMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  const totals = summary.reduce(
    (acc, s) => ({
      subtotal: acc.subtotal + s.subtotal,
      taxAmount: acc.taxAmount + s.taxAmount,
      totalAmount: acc.totalAmount + s.totalAmount,
      amountPaid: acc.amountPaid + s.amountPaid,
      outstanding: acc.outstanding + s.outstanding,
    }),
    { subtotal: 0, taxAmount: 0, totalAmount: 0, amountPaid: 0, outstanding: 0 }
  );

  return { summary, byCustomer, totals, dateRange };
}
