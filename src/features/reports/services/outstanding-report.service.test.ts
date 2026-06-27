import { describe, it, expect, vi } from 'vitest';
import { getOutstandingReport } from './outstanding-report.service';
import type { SupabaseClient } from '@supabase/supabase-js';

function createTwoCallSupabase(
  invoiceData: unknown,
  purchaseData: unknown,
  invoiceError: unknown = null,
  purchaseError: unknown = null
) {
  let callCount = 0;

  const makeThenable = (data: unknown, error: unknown) => {
    const t = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      in: vi.fn(),
      then(
        resolve: (value: { data: unknown; error: unknown }) => void,
        _reject?: (reason?: unknown) => void
      ) {
        resolve({ data, error });
      },
    };
    t.select.mockReturnValue(t);
    t.eq.mockReturnValue(t);
    t.is.mockReturnValue(t);
    t.in.mockReturnValue(t);
    return t;
  };

  const invoiceThenable = makeThenable(invoiceData, invoiceError);
  const purchaseThenable = makeThenable(purchaseData, purchaseError);

  return {
    from: vi.fn().mockImplementation(() => {
      callCount += 1;
      return callCount === 1 ? invoiceThenable : purchaseThenable;
    }),
  } as unknown as SupabaseClient;
}

describe('getOutstandingReport', () => {
  it('calculates customer receivables and supplier payables correctly', async () => {
    const today = new Date().toISOString().split('T')[0];
    const pastDate = '2020-01-01';

    const invoiceData = [
      {
        customer_id: 'cust-1',
        total_amount: 1000,
        amount_paid: 400,
        due_date: pastDate,
        customers: { id: 'cust-1', name: 'Acme Corp', code: 'ACM' },
      },
      {
        customer_id: 'cust-1',
        total_amount: 500,
        amount_paid: 0,
        due_date: null,
        customers: { id: 'cust-1', name: 'Acme Corp', code: 'ACM' },
      },
      {
        customer_id: 'cust-2',
        total_amount: 2000,
        amount_paid: 1500,
        due_date: today,
        customers: { id: 'cust-2', name: 'Beta Ltd', code: 'BET' },
      },
    ];

    const purchaseData = [
      {
        supplier_id: 'sup-1',
        total_amount: 3000,
        amount_paid: 1000,
        suppliers: { id: 'sup-1', name: 'Supplier One', code: 'SUP1' },
      },
      {
        supplier_id: 'sup-1',
        total_amount: 500,
        amount_paid: 500,
        suppliers: { id: 'sup-1', name: 'Supplier One', code: 'SUP1' },
      },
    ];

    const supabase = createTwoCallSupabase(invoiceData, purchaseData);
    const report = await getOutstandingReport(supabase, 'org-1');

    expect(report.customers).toHaveLength(2);
    const cust1 = report.customers.find((c) => c.customerId === 'cust-1');
    // outstanding = (1000-400) + (500-0) = 600 + 500 = 1100
    expect(cust1?.outstanding).toBe(1100);
    // overdue = 600 (only first invoice has past due_date)
    expect(cust1?.overdue).toBe(600);

    const cust2 = report.customers.find((c) => c.customerId === 'cust-2');
    // outstanding = 500; due_date = today => not overdue (today >= today is false with strict <)
    expect(cust2?.outstanding).toBe(500);

    expect(report.suppliers).toHaveLength(1);
    // Only first sup-1 invoice has outstanding (3000-1000=2000)
    expect(report.suppliers[0].outstanding).toBe(2000);

    expect(report.totalReceivable).toBe(1600);
    expect(report.totalPayable).toBe(2000);
  });

  it('returns empty report when no outstanding', async () => {
    const supabase = createTwoCallSupabase([], []);
    const report = await getOutstandingReport(supabase, 'org-1');

    expect(report.customers).toHaveLength(0);
    expect(report.suppliers).toHaveLength(0);
    expect(report.totalReceivable).toBe(0);
    expect(report.totalPayable).toBe(0);
  });

  it('throws on invoice query error', async () => {
    const supabase = createTwoCallSupabase(null, [], { message: 'Invoice error' });
    await expect(getOutstandingReport(supabase, 'org-1')).rejects.toThrow(
      'Invoice error'
    );
  });

  it('throws on purchase query error', async () => {
    const supabase = createTwoCallSupabase([], null, null, {
      message: 'Purchase error',
    });
    await expect(getOutstandingReport(supabase, 'org-1')).rejects.toThrow(
      'Purchase error'
    );
  });
});
