import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OutstandingReport,
  CustomerOutstandingRow,
  SupplierOutstandingRow,
} from '../types/report.types';

type InvoiceOutstandingRow = {
  customer_id: string;
  total_amount: number;
  amount_paid: number;
  due_date: string | null;
  customers: { id: string; name: string; code: string };
};

type PurchaseOutstandingRow = {
  supplier_id: string;
  total_amount: number;
  amount_paid: number;
  suppliers: { id: string; name: string; code: string };
};

export async function getOutstandingReport(
  supabase: SupabaseClient,
  orgId: string
): Promise<OutstandingReport> {
  const today = new Date().toISOString().split('T')[0];

  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .select('customer_id, total_amount, amount_paid, due_date, customers!inner(id, name, code)')
    .eq('organization_id', orgId)
    .eq('status', 'posted')
    .is('deleted_at', null)
    .in('payment_status', ['unpaid', 'partial']);

  if (invoiceError) {
    throw new Error(invoiceError.message);
  }

  const invoiceRows = (invoiceData ?? []) as unknown as InvoiceOutstandingRow[];
  const customerMap = new Map<string, CustomerOutstandingRow>();

  for (const row of invoiceRows) {
    const outstanding = row.total_amount - row.amount_paid;
    const isOverdue = row.due_date !== null && row.due_date < today;
    const overdue = isOverdue ? outstanding : 0;

    const existing = customerMap.get(row.customer_id);
    if (existing) {
      existing.outstanding += outstanding;
      existing.overdue += overdue;
    } else {
      const customer = row.customers;
      customerMap.set(row.customer_id, {
        customerId: row.customer_id,
        customerName: customer.name,
        customerCode: customer.code,
        outstanding,
        overdue,
      });
    }
  }

  // Fetch all posted purchase invoices; filter in JS for outstanding > 0
  // (Supabase cannot compare two columns with .lt())
  const { data: purchaseData, error: purchaseError } = await supabase
    .from('purchase_invoices')
    .select('supplier_id, total_amount, amount_paid, suppliers!inner(id, name, code)')
    .eq('organization_id', orgId)
    .eq('status', 'posted')
    .is('deleted_at', null);

  if (purchaseError) {
    throw new Error(purchaseError.message);
  }

  const purchaseRows = (purchaseData ?? []) as unknown as PurchaseOutstandingRow[];
  const supplierMap = new Map<string, SupplierOutstandingRow>();

  for (const row of purchaseRows) {
    const outstanding = row.total_amount - row.amount_paid;
    if (outstanding <= 0) {
      continue;
    }

    const existing = supplierMap.get(row.supplier_id);
    if (existing) {
      existing.outstanding += outstanding;
    } else {
      const supplier = row.suppliers;
      supplierMap.set(row.supplier_id, {
        supplierId: row.supplier_id,
        supplierName: supplier.name,
        supplierCode: supplier.code,
        outstanding,
      });
    }
  }

  const customers = Array.from(customerMap.values()).sort(
    (a, b) => b.outstanding - a.outstanding
  );
  const suppliers = Array.from(supplierMap.values()).sort(
    (a, b) => b.outstanding - a.outstanding
  );

  const totalReceivable = customers.reduce((acc, c) => acc + c.outstanding, 0);
  const totalPayable = suppliers.reduce((acc, s) => acc + s.outstanding, 0);

  return { customers, suppliers, totalReceivable, totalPayable };
}
