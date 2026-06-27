import { describe, it, expect, vi } from 'vitest';
import { getPurchaseReport } from './purchase-report.service';
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

describe('getPurchaseReport', () => {
  it('returns correct aggregated data for happy path', async () => {
    const mockData = [
      {
        invoice_date: '2026-01-05',
        total_amount: 5000,
        amount_paid: 3000,
        supplier_id: 'sup-1',
        suppliers: { id: 'sup-1', name: 'Supplier One', code: 'SUP1' },
      },
      {
        invoice_date: '2026-01-15',
        total_amount: 2000,
        amount_paid: 2000,
        supplier_id: 'sup-2',
        suppliers: { id: 'sup-2', name: 'Supplier Two', code: 'SUP2' },
      },
    ];

    const supabase = createMockSupabase(mockData);
    const report = await getPurchaseReport(supabase, 'org-1', dateRange);

    expect(report.summary).toHaveLength(1);
    expect(report.summary[0].invoiceCount).toBe(2);
    expect(report.summary[0].totalAmount).toBe(7000);
    expect(report.summary[0].amountPaid).toBe(5000);
    expect(report.summary[0].outstanding).toBe(2000);

    expect(report.bySupplier).toHaveLength(2);
    // Sorted desc by totalAmount: sup-1 first
    expect(report.bySupplier[0].supplierId).toBe('sup-1');
    expect(report.bySupplier[0].outstanding).toBe(2000);

    expect(report.totals.totalAmount).toBe(7000);
    expect(report.totals.outstanding).toBe(2000);
  });

  it('returns empty report when no purchases found', async () => {
    const supabase = createMockSupabase([]);
    const report = await getPurchaseReport(supabase, 'org-1', dateRange);

    expect(report.summary).toHaveLength(0);
    expect(report.bySupplier).toHaveLength(0);
    expect(report.totals).toEqual({ totalAmount: 0, amountPaid: 0, outstanding: 0 });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = createMockSupabase(null, { message: 'Purchase DB error' });
    await expect(
      getPurchaseReport(supabase, 'org-1', dateRange)
    ).rejects.toThrow('Purchase DB error');
  });
});
