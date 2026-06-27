import { describe, it, expect, vi } from 'vitest';
import { getSalesReport } from './sales-report.service';
import type { SupabaseClient } from '@supabase/supabase-js';

function createMockSupabase(returnData: unknown, error: unknown = null) {
  const thenable = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    then(
      resolve: (value: { data: unknown; error: unknown }) => void,
      _reject?: (reason?: unknown) => void
    ) {
      resolve({ data: returnData, error });
    },
  };
  thenable.select.mockReturnValue(thenable);
  thenable.eq.mockReturnValue(thenable);
  thenable.is.mockReturnValue(thenable);
  thenable.gte.mockReturnValue(thenable);
  thenable.lte.mockReturnValue(thenable);

  return {
    from: vi.fn().mockReturnValue(thenable),
  } as unknown as SupabaseClient;
}

const dateRange = { from: '2026-01-01', to: '2026-01-31' };

describe('getSalesReport', () => {
  it('returns correct aggregated data for happy path', async () => {
    const mockData = [
      {
        invoice_date: '2026-01-10',
        total_amount: 1000,
        amount_paid: 800,
        subtotal: 850,
        tax_amount: 150,
        customer_id: 'cust-1',
        customers: { id: 'cust-1', name: 'Acme Corp', code: 'ACM' },
      },
      {
        invoice_date: '2026-01-20',
        total_amount: 500,
        amount_paid: 500,
        subtotal: 440,
        tax_amount: 60,
        customer_id: 'cust-1',
        customers: { id: 'cust-1', name: 'Acme Corp', code: 'ACM' },
      },
      {
        invoice_date: '2026-01-25',
        total_amount: 2000,
        amount_paid: 0,
        subtotal: 1700,
        tax_amount: 300,
        customer_id: 'cust-2',
        customers: { id: 'cust-2', name: 'Beta Ltd', code: 'BET' },
      },
    ];

    const supabase = createMockSupabase(mockData);
    const report = await getSalesReport(supabase, 'org-1', dateRange);

    expect(report.summary).toHaveLength(1);
    expect(report.summary[0].period).toBe('2026-01');
    expect(report.summary[0].invoiceCount).toBe(3);
    expect(report.summary[0].totalAmount).toBe(3500);
    expect(report.summary[0].amountPaid).toBe(1300);
    expect(report.summary[0].outstanding).toBe(2200);

    expect(report.byCustomer).toHaveLength(2);
    // byCustomer sorted by totalAmount desc — cust-2 first (2000)
    expect(report.byCustomer[0].customerId).toBe('cust-2');
    expect(report.byCustomer[0].totalAmount).toBe(2000);
    expect(report.byCustomer[1].customerId).toBe('cust-1');
    expect(report.byCustomer[1].invoiceCount).toBe(2);
    expect(report.byCustomer[1].totalAmount).toBe(1500);

    expect(report.totals.totalAmount).toBe(3500);
    expect(report.totals.outstanding).toBe(2200);
    expect(report.dateRange).toEqual(dateRange);
  });

  it('returns empty report when no invoices found', async () => {
    const supabase = createMockSupabase([]);
    const report = await getSalesReport(supabase, 'org-1', dateRange);

    expect(report.summary).toHaveLength(0);
    expect(report.byCustomer).toHaveLength(0);
    expect(report.totals).toEqual({
      subtotal: 0,
      taxAmount: 0,
      totalAmount: 0,
      amountPaid: 0,
      outstanding: 0,
    });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = createMockSupabase(null, { message: 'DB error' });
    await expect(
      getSalesReport(supabase, 'org-1', dateRange)
    ).rejects.toThrow('DB error');
  });

  it('groups invoices by month correctly', async () => {
    const mockData = [
      {
        invoice_date: '2026-01-15',
        total_amount: 100,
        amount_paid: 100,
        subtotal: 90,
        tax_amount: 10,
        customer_id: 'cust-1',
        customers: { id: 'cust-1', name: 'A', code: 'A' },
      },
      {
        invoice_date: '2026-02-10',
        total_amount: 200,
        amount_paid: 100,
        subtotal: 170,
        tax_amount: 30,
        customer_id: 'cust-1',
        customers: { id: 'cust-1', name: 'A', code: 'A' },
      },
    ];
    const supabase = createMockSupabase(mockData);
    const report = await getSalesReport(supabase, 'org-1', {
      from: '2026-01-01',
      to: '2026-02-28',
    });

    expect(report.summary).toHaveLength(2);
    expect(report.summary[0].period).toBe('2026-01');
    expect(report.summary[1].period).toBe('2026-02');
  });
});
