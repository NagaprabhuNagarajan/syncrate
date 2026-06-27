import { describe, it, expect, vi } from 'vitest';
import { getGstReport } from './gst-report.service';
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

describe('getGstReport', () => {
  it('aggregates GST amounts by month correctly', async () => {
    const mockData = [
      {
        cgst_amount: 90,
        sgst_amount: 90,
        igst_amount: 0,
        line_total: 1000,
        invoices: { invoice_date: '2026-01-10' },
      },
      {
        cgst_amount: 45,
        sgst_amount: 45,
        igst_amount: 0,
        line_total: 500,
        invoices: { invoice_date: '2026-01-20' },
      },
    ];

    const supabase = createMockSupabase(mockData);
    const report = await getGstReport(supabase, 'org-1', dateRange);

    expect(report.lines).toHaveLength(1);
    expect(report.lines[0].month).toBe('2026-01');
    expect(report.lines[0].cgstAmount).toBe(135);
    expect(report.lines[0].sgstAmount).toBe(135);
    expect(report.lines[0].igstAmount).toBe(0);
    expect(report.lines[0].totalTax).toBe(270);
    // taxable = (1000 - 90 - 90 - 0) + (500 - 45 - 45 - 0) = 820 + 410 = 1230
    expect(report.lines[0].taxableAmount).toBe(1230);

    expect(report.totals.cgstAmount).toBe(135);
    expect(report.totals.totalTax).toBe(270);
  });

  it('returns empty report when no invoice items found', async () => {
    const supabase = createMockSupabase([]);
    const report = await getGstReport(supabase, 'org-1', dateRange);

    expect(report.lines).toHaveLength(0);
    expect(report.totals).toEqual({
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTax: 0,
    });
  });

  it('throws when supabase returns an error', async () => {
    const supabase = createMockSupabase(null, { message: 'GST DB error' });
    await expect(getGstReport(supabase, 'org-1', dateRange)).rejects.toThrow(
      'GST DB error'
    );
  });
});
